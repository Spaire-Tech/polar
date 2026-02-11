"""Money movement service — ACH, wire, and bank transfers."""

from __future__ import annotations

import uuid

import structlog

from polar.account.repository import AccountRepository
from polar.enums import AccountMode
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.logging import Logger
from polar.models import Account
from polar.models.financial_account import FinancialAccount
from polar.models.money_movement import (
    OutboundPaymentRecord,
    OutboundPaymentStatus,
    OutboundTransferRecord,
    OutboundTransferStatus,
    PaymentRecipient,
)
from polar.postgres import AsyncReadSession, AsyncSession
from polar.treasury.repository import FinancialAccountRepository

from .repository import (
    OutboundPaymentRepository,
    OutboundTransferRepository,
    PaymentRecipientRepository,
)
from .schemas import (
    OutboundPaymentCreate,
    OutboundPaymentRead,
    OutboundTransferCreate,
    OutboundTransferRead,
    RecipientCreate,
    RecipientRead,
    RecipientUpdate,
)

log: Logger = structlog.get_logger()


class MoneyMovementError(PolarError):
    pass


class AccountNotTreasuryEnabled(MoneyMovementError):
    def __init__(self, account_id: uuid.UUID) -> None:
        super().__init__(
            f"Account {account_id} is not treasury-enabled."
        )


class NoFinancialAccount(MoneyMovementError):
    def __init__(self, account_id: uuid.UUID) -> None:
        super().__init__(
            f"Account {account_id} has no open Financial Account."
        )


class RecipientNotFound(MoneyMovementError):
    def __init__(self, recipient_id: uuid.UUID) -> None:
        super().__init__(f"Payment recipient {recipient_id} not found.")


class InsufficientSpendableBalance(MoneyMovementError):
    def __init__(
        self, account_id: uuid.UUID, requested: int, available: int
    ) -> None:
        super().__init__(
            f"Insufficient spendable balance on account {account_id}. "
            f"Requested: {requested}, available: {available}."
        )


class NoPaymentMethodOnRecipient(MoneyMovementError):
    def __init__(self, recipient_id: uuid.UUID) -> None:
        super().__init__(
            f"Recipient {recipient_id} has no Stripe PaymentMethod configured."
        )


class OutboundPaymentNotFound(MoneyMovementError):
    def __init__(self, payment_id: uuid.UUID) -> None:
        super().__init__(f"Outbound payment {payment_id} not found.")


class OutboundTransferNotFound(MoneyMovementError):
    def __init__(self, transfer_id: uuid.UUID) -> None:
        super().__init__(f"Outbound transfer {transfer_id} not found.")


class NotCancelable(MoneyMovementError):
    def __init__(self, record_id: uuid.UUID) -> None:
        super().__init__(
            f"Record {record_id} is not in a cancelable state."
        )


class MoneyMovementService:
    # ── Recipient operations ──

    async def create_recipient(
        self,
        session: AsyncSession,
        account: Account,
        params: RecipientCreate,
    ) -> RecipientRead:
        """Create a new payment recipient."""
        self._assert_treasury_enabled(account)

        repo = PaymentRecipientRepository(session)
        recipient = PaymentRecipient(
            account_id=account.id,
            name=params.name,
            email=params.email,
            type=params.type,
            bank_name=params.bank_name,
            last4=params.last4,
            routing_number_last4=params.routing_number_last4,
            stripe_payment_method_id=params.stripe_payment_method_id,
            billing_address=params.billing_address,
        )
        await repo.create(recipient, flush=True)

        log.info(
            "money_movement.recipient.created",
            account_id=str(account.id),
            recipient_id=str(recipient.id),
        )
        return self._recipient_to_read(recipient)

    async def update_recipient(
        self,
        session: AsyncSession,
        account: Account,
        recipient_id: uuid.UUID,
        params: RecipientUpdate,
    ) -> RecipientRead:
        """Update a payment recipient."""
        repo = PaymentRecipientRepository(session)
        recipient = await repo.get_by_account_and_id(account.id, recipient_id)
        if recipient is None:
            raise RecipientNotFound(recipient_id)

        update_dict: dict[str, object] = {}
        if params.name is not None:
            update_dict["name"] = params.name
        if params.email is not None:
            update_dict["email"] = params.email
        if params.stripe_payment_method_id is not None:
            update_dict["stripe_payment_method_id"] = (
                params.stripe_payment_method_id
            )
        if params.billing_address is not None:
            update_dict["billing_address"] = params.billing_address

        if update_dict:
            await repo.update(recipient, update_dict=update_dict)

        return self._recipient_to_read(recipient)

    async def delete_recipient(
        self,
        session: AsyncSession,
        account: Account,
        recipient_id: uuid.UUID,
    ) -> None:
        """Delete a payment recipient."""
        repo = PaymentRecipientRepository(session)
        recipient = await repo.get_by_account_and_id(account.id, recipient_id)
        if recipient is None:
            raise RecipientNotFound(recipient_id)

        # Hard delete — recipients don't use soft delete
        await session.delete(recipient)
        await session.flush()

        log.info(
            "money_movement.recipient.deleted",
            recipient_id=str(recipient_id),
        )

    async def list_recipients(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
    ) -> list[RecipientRead]:
        """List all recipients for an account."""
        repo = PaymentRecipientRepository(session)
        recipients = await repo.get_by_account_id(account_id)
        return [self._recipient_to_read(r) for r in recipients]

    async def get_recipient(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
        recipient_id: uuid.UUID,
    ) -> RecipientRead | None:
        """Get a specific recipient."""
        repo = PaymentRecipientRepository(session)
        recipient = await repo.get_by_account_and_id(account_id, recipient_id)
        if recipient is None:
            return None
        return self._recipient_to_read(recipient)

    # ── Outbound Payment operations ──

    async def create_outbound_payment(
        self,
        session: AsyncSession,
        account: Account,
        params: OutboundPaymentCreate,
    ) -> OutboundPaymentRead:
        """Send an outbound payment (ACH/wire) to a third-party recipient."""
        self._assert_treasury_enabled(account)

        if account.stripe_id is None:
            raise MoneyMovementError(
                f"Account {account.id} has no Stripe connected account."
            )

        # Verify recipient
        recipient_repo = PaymentRecipientRepository(session)
        recipient = await recipient_repo.get_by_account_and_id(
            account.id, params.recipient_id
        )
        if recipient is None:
            raise RecipientNotFound(params.recipient_id)
        if recipient.stripe_payment_method_id is None:
            raise NoPaymentMethodOnRecipient(params.recipient_id)

        # Get Financial Account
        fa = await self._get_financial_account(session, account.id)

        # Check spendable balance
        await self._assert_sufficient_spendable(
            session, account.id, params.amount
        )

        # Create on Stripe
        stripe_op = await stripe_service.create_outbound_payment(
            stripe_account_id=account.stripe_id,
            financial_account_id=fa.stripe_financial_account_id,
            amount=params.amount,
            currency=params.currency,
            destination_payment_method=recipient.stripe_payment_method_id,
            description=params.description,
            statement_descriptor=params.statement_descriptor,
        )

        # Persist locally
        op_repo = OutboundPaymentRepository(session)
        record = OutboundPaymentRecord(
            account_id=account.id,
            financial_account_id=fa.id,
            recipient_id=recipient.id,
            stripe_outbound_payment_id=stripe_op.id,
            amount=params.amount,
            currency=params.currency,
            method=params.method,
            status=OutboundPaymentStatus.processing,
            description=params.description,
            statement_descriptor=params.statement_descriptor,
            expected_arrival_date=getattr(
                stripe_op, "expected_arrival_date", None
            ),
        )
        await op_repo.create(record, flush=True)

        log.info(
            "money_movement.outbound_payment.created",
            account_id=str(account.id),
            record_id=str(record.id),
            amount=params.amount,
            method=params.method.value,
        )

        return self._payment_to_read(record)

    async def cancel_outbound_payment(
        self,
        session: AsyncSession,
        account: Account,
        payment_id: uuid.UUID,
    ) -> OutboundPaymentRead:
        """Cancel a processing outbound payment."""
        if account.stripe_id is None:
            raise MoneyMovementError(
                f"Account {account.id} has no Stripe connected account."
            )

        op_repo = OutboundPaymentRepository(session)
        record = await op_repo.get_by_id(payment_id)
        if record is None or record.account_id != account.id:
            raise OutboundPaymentNotFound(payment_id)

        if record.status != OutboundPaymentStatus.processing:
            raise NotCancelable(payment_id)

        if record.stripe_outbound_payment_id:
            await stripe_service.cancel_outbound_payment(
                record.stripe_outbound_payment_id,
                stripe_account_id=account.stripe_id,
            )

        await op_repo.update(
            record, update_dict={"status": OutboundPaymentStatus.canceled}
        )

        log.info(
            "money_movement.outbound_payment.canceled",
            record_id=str(payment_id),
        )
        return self._payment_to_read(record)

    async def list_outbound_payments(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
    ) -> list[OutboundPaymentRead]:
        """List all outbound payments for an account."""
        repo = OutboundPaymentRepository(session)
        records = await repo.get_by_account_id(account_id)
        return [self._payment_to_read(r) for r in records]

    async def get_outbound_payment(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
        payment_id: uuid.UUID,
    ) -> OutboundPaymentRead | None:
        """Get a specific outbound payment."""
        repo = OutboundPaymentRepository(session)
        record = await repo.get_by_id(payment_id)
        if record is None or record.account_id != account_id:
            return None
        return self._payment_to_read(record)

    # ── Outbound Transfer operations ──

    async def create_outbound_transfer(
        self,
        session: AsyncSession,
        account: Account,
        params: OutboundTransferCreate,
    ) -> OutboundTransferRead:
        """Transfer funds from Financial Account to merchant's own bank."""
        self._assert_treasury_enabled(account)

        if account.stripe_id is None:
            raise MoneyMovementError(
                f"Account {account.id} has no Stripe connected account."
            )

        fa = await self._get_financial_account(session, account.id)

        # Check spendable balance
        await self._assert_sufficient_spendable(
            session, account.id, params.amount
        )

        # Create on Stripe
        stripe_ot = await stripe_service.create_outbound_transfer(
            stripe_account_id=account.stripe_id,
            financial_account_id=fa.stripe_financial_account_id,
            amount=params.amount,
            currency=params.currency,
            destination_payment_method=params.destination_payment_method_id,
            description=params.description,
        )

        # Persist locally
        ot_repo = OutboundTransferRepository(session)
        record = OutboundTransferRecord(
            account_id=account.id,
            financial_account_id=fa.id,
            stripe_outbound_transfer_id=stripe_ot.id,
            amount=params.amount,
            currency=params.currency,
            method=params.method,
            status=OutboundTransferStatus.processing,
            description=params.description,
            expected_arrival_date=getattr(
                stripe_ot, "expected_arrival_date", None
            ),
        )
        await ot_repo.create(record, flush=True)

        log.info(
            "money_movement.outbound_transfer.created",
            account_id=str(account.id),
            record_id=str(record.id),
            amount=params.amount,
        )

        return self._transfer_to_read(record)

    async def cancel_outbound_transfer(
        self,
        session: AsyncSession,
        account: Account,
        transfer_id: uuid.UUID,
    ) -> OutboundTransferRead:
        """Cancel a processing outbound transfer."""
        if account.stripe_id is None:
            raise MoneyMovementError(
                f"Account {account.id} has no Stripe connected account."
            )

        ot_repo = OutboundTransferRepository(session)
        record = await ot_repo.get_by_id(transfer_id)
        if record is None or record.account_id != account.id:
            raise OutboundTransferNotFound(transfer_id)

        if record.status != OutboundTransferStatus.processing:
            raise NotCancelable(transfer_id)

        if record.stripe_outbound_transfer_id:
            await stripe_service.cancel_outbound_transfer(
                record.stripe_outbound_transfer_id,
                stripe_account_id=account.stripe_id,
            )

        await ot_repo.update(
            record, update_dict={"status": OutboundTransferStatus.canceled}
        )

        log.info(
            "money_movement.outbound_transfer.canceled",
            record_id=str(transfer_id),
        )
        return self._transfer_to_read(record)

    async def list_outbound_transfers(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
    ) -> list[OutboundTransferRead]:
        """List all outbound transfers for an account."""
        repo = OutboundTransferRepository(session)
        records = await repo.get_by_account_id(account_id)
        return [self._transfer_to_read(r) for r in records]

    async def get_outbound_transfer(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
        transfer_id: uuid.UUID,
    ) -> OutboundTransferRead | None:
        """Get a specific outbound transfer."""
        repo = OutboundTransferRepository(session)
        record = await repo.get_by_id(transfer_id)
        if record is None or record.account_id != account_id:
            return None
        return self._transfer_to_read(record)

    # ── Webhook handlers ──

    async def handle_outbound_payment_updated(
        self,
        session: AsyncSession,
        stripe_outbound_payment_id: str,
        stripe_account_id: str,
    ) -> OutboundPaymentRecord | None:
        """Handle treasury.outbound_payment webhook events."""
        repo = OutboundPaymentRepository(session)
        record = await repo.get_by_stripe_id(stripe_outbound_payment_id)
        if record is None:
            log.warning(
                "money_movement.webhook.outbound_payment_not_found",
                stripe_id=stripe_outbound_payment_id,
            )
            return None

        # Fetch latest from Stripe
        account_repo = AccountRepository(session)
        account = await account_repo.get_by_id(record.account_id)
        if account is None or account.stripe_id is None:
            return None

        stripe_op = await stripe_service.retrieve_outbound_payment(
            stripe_outbound_payment_id,
            stripe_account_id=account.stripe_id,
        )

        update_dict: dict[str, object] = {}
        if stripe_op.status:
            try:
                update_dict["status"] = OutboundPaymentStatus(stripe_op.status)
            except ValueError:
                pass

        if hasattr(stripe_op, "expected_arrival_date"):
            update_dict["expected_arrival_date"] = (
                stripe_op.expected_arrival_date
            )

        if (
            stripe_op.status in ("failed", "returned")
            and hasattr(stripe_op, "returned_details")
            and stripe_op.returned_details
        ):
            update_dict["failure_reason"] = getattr(
                stripe_op.returned_details, "code", "unknown"
            )

        if update_dict:
            await repo.update(record, update_dict=update_dict)

        log.info(
            "money_movement.outbound_payment.updated",
            record_id=str(record.id),
            status=stripe_op.status,
        )
        return record

    async def handle_outbound_transfer_updated(
        self,
        session: AsyncSession,
        stripe_outbound_transfer_id: str,
        stripe_account_id: str,
    ) -> OutboundTransferRecord | None:
        """Handle treasury.outbound_transfer webhook events."""
        repo = OutboundTransferRepository(session)
        record = await repo.get_by_stripe_id(stripe_outbound_transfer_id)
        if record is None:
            log.warning(
                "money_movement.webhook.outbound_transfer_not_found",
                stripe_id=stripe_outbound_transfer_id,
            )
            return None

        account_repo = AccountRepository(session)
        account = await account_repo.get_by_id(record.account_id)
        if account is None or account.stripe_id is None:
            return None

        stripe_ot = await stripe_service.retrieve_outbound_transfer(
            stripe_outbound_transfer_id,
            stripe_account_id=account.stripe_id,
        )

        update_dict: dict[str, object] = {}
        if stripe_ot.status:
            try:
                update_dict["status"] = OutboundTransferStatus(
                    stripe_ot.status
                )
            except ValueError:
                pass

        if hasattr(stripe_ot, "expected_arrival_date"):
            update_dict["expected_arrival_date"] = (
                stripe_ot.expected_arrival_date
            )

        if (
            stripe_ot.status in ("failed", "returned")
            and hasattr(stripe_ot, "returned_details")
            and stripe_ot.returned_details
        ):
            update_dict["failure_reason"] = getattr(
                stripe_ot.returned_details, "code", "unknown"
            )

        if update_dict:
            await repo.update(record, update_dict=update_dict)

        log.info(
            "money_movement.outbound_transfer.updated",
            record_id=str(record.id),
            status=stripe_ot.status,
        )
        return record

    # ── Helpers ──

    @staticmethod
    def _assert_treasury_enabled(account: Account) -> None:
        if account.account_mode != AccountMode.custom:
            raise AccountNotTreasuryEnabled(account.id)
        if not account.treasury_enabled:
            raise AccountNotTreasuryEnabled(account.id)

    async def _get_financial_account(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
    ) -> FinancialAccount:
        fa_repo = FinancialAccountRepository(session)
        fa = await fa_repo.get_by_account_id(account_id)
        if fa is None or not fa.is_open():
            raise NoFinancialAccount(account_id)
        return fa

    async def _assert_sufficient_spendable(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
        amount: int,
    ) -> None:
        """Check that the account has enough spendable balance."""
        from polar.fund_lifecycle.repository import FundStateSnapshotRepository

        snapshot_repo = FundStateSnapshotRepository(session)
        snapshot = await snapshot_repo.get_by_account(account_id)

        if snapshot is None:
            raise InsufficientSpendableBalance(account_id, amount, 0)

        if snapshot.spendable_amount < amount:
            raise InsufficientSpendableBalance(
                account_id, amount, snapshot.spendable_amount
            )

    @staticmethod
    def _recipient_to_read(r: PaymentRecipient) -> RecipientRead:
        return RecipientRead(
            id=r.id,
            created_at=r.created_at,
            modified_at=r.modified_at,
            account_id=r.account_id,
            name=r.name,
            email=r.email,
            type=r.type,
            bank_name=r.bank_name,
            last4=r.last4,
            routing_number_last4=r.routing_number_last4,
            billing_address=r.billing_address,
        )

    @staticmethod
    def _payment_to_read(r: OutboundPaymentRecord) -> OutboundPaymentRead:
        return OutboundPaymentRead(
            id=r.id,
            created_at=r.created_at,
            modified_at=r.modified_at,
            account_id=r.account_id,
            financial_account_id=r.financial_account_id,
            recipient_id=r.recipient_id,
            stripe_outbound_payment_id=r.stripe_outbound_payment_id,
            amount=r.amount,
            currency=r.currency,
            method=r.method,
            status=r.status,
            description=r.description,
            statement_descriptor=r.statement_descriptor,
            expected_arrival_date=r.expected_arrival_date,
            failure_reason=r.failure_reason,
        )

    @staticmethod
    def _transfer_to_read(r: OutboundTransferRecord) -> OutboundTransferRead:
        return OutboundTransferRead(
            id=r.id,
            created_at=r.created_at,
            modified_at=r.modified_at,
            account_id=r.account_id,
            financial_account_id=r.financial_account_id,
            stripe_outbound_transfer_id=r.stripe_outbound_transfer_id,
            amount=r.amount,
            currency=r.currency,
            method=r.method,
            status=r.status,
            description=r.description,
            expected_arrival_date=r.expected_arrival_date,
            failure_reason=r.failure_reason,
        )


money_movement_service = MoneyMovementService()
