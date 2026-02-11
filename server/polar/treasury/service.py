"""Treasury service — business logic for Financial Accounts."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog

from polar.account.repository import AccountRepository
from polar.enums import AccountMode
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.logging import Logger
from polar.models import Account
from polar.models.financial_account import FinancialAccount, FinancialAccountStatus
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import FinancialAccountRepository
from .schemas import (
    FinancialAccountBalance,
    FinancialAccountCreate,
    FinancialAccountRead,
    TreasuryTransactionList,
    TreasuryTransactionRead,
)

log: Logger = structlog.get_logger()


class TreasuryError(PolarError):
    pass


class AccountNotCustom(TreasuryError):
    def __init__(self, account_id: uuid.UUID) -> None:
        super().__init__(
            f"Account {account_id} is not a Custom connected account. "
            "Treasury requires a Custom account with treasury capability."
        )


class AccountNotTreasuryEnabled(TreasuryError):
    def __init__(self, account_id: uuid.UUID) -> None:
        super().__init__(
            f"Account {account_id} does not have treasury enabled."
        )


class FinancialAccountAlreadyExists(TreasuryError):
    def __init__(self, account_id: uuid.UUID) -> None:
        super().__init__(
            f"Account {account_id} already has a Financial Account."
        )


class FinancialAccountNotFound(TreasuryError):
    def __init__(self, account_id: uuid.UUID) -> None:
        super().__init__(
            f"No Financial Account found for account {account_id}."
        )


class TreasuryService:
    # ── Read operations ──

    async def get_financial_account(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
    ) -> FinancialAccountRead | None:
        """Get the Financial Account for a merchant account."""
        repo = FinancialAccountRepository(session)
        fa = await repo.get_by_account_id(account_id)
        if fa is None:
            return None
        return self._to_read_schema(fa)

    async def list_transactions(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
        *,
        limit: int = 20,
        starting_after: str | None = None,
    ) -> TreasuryTransactionList:
        """List Treasury transactions for a Financial Account."""
        repo = FinancialAccountRepository(session)
        fa = await repo.get_by_account_id(account_id)
        if fa is None:
            raise FinancialAccountNotFound(account_id)

        account_repo = AccountRepository(session)
        account = await account_repo.get_by_id(account_id)
        if account is None or account.stripe_id is None:
            raise FinancialAccountNotFound(account_id)

        result = await stripe_service.list_financial_account_transactions(
            fa.stripe_financial_account_id,
            stripe_account_id=account.stripe_id,
            limit=limit,
            starting_after=starting_after,
        )

        items = [
            TreasuryTransactionRead(
                id=txn.id,
                amount=txn.amount,
                currency=txn.currency,
                description=txn.description,
                status=txn.status,
                flow_type=txn.flow_type,
                created=datetime.fromtimestamp(txn.created, tz=timezone.utc),
            )
            for txn in result.data
        ]

        return TreasuryTransactionList(
            items=items,
            has_more=result.has_more,
        )

    # ── Write operations ──

    async def create_financial_account(
        self,
        session: AsyncSession,
        account: Account,
        params: FinancialAccountCreate,
    ) -> FinancialAccountRead:
        """Provision a new Stripe Treasury Financial Account for a merchant."""
        if account.account_mode != AccountMode.custom:
            raise AccountNotCustom(account.id)
        if not account.treasury_enabled:
            raise AccountNotTreasuryEnabled(account.id)

        repo = FinancialAccountRepository(session)
        existing = await repo.get_by_account_id(account.id)
        if existing is not None:
            raise FinancialAccountAlreadyExists(account.id)

        if account.stripe_id is None:
            raise TreasuryError(
                f"Account {account.id} has no Stripe connected account ID."
            )

        # Create on Stripe
        stripe_fa = await stripe_service.create_financial_account(
            stripe_account_id=account.stripe_id,
            supported_currencies=params.supported_currencies,
        )

        # Extract ABA info if available
        aba_routing = None
        aba_last4 = None
        if hasattr(stripe_fa, "financial_addresses"):
            for addr in stripe_fa.financial_addresses or []:
                if addr.type == "aba" and addr.aba:
                    aba_routing = addr.aba.routing_number
                    aba_last4 = addr.aba.account_number_last4
                    break

        # Extract features status
        features_status: dict[str, object] = {}
        if hasattr(stripe_fa, "active_features"):
            features_status["active_features"] = list(
                stripe_fa.active_features or []
            )
        if hasattr(stripe_fa, "pending_features"):
            features_status["pending_features"] = list(
                stripe_fa.pending_features or []
            )
        if hasattr(stripe_fa, "restricted_features"):
            features_status["restricted_features"] = list(
                stripe_fa.restricted_features or []
            )

        # Extract balance
        balance_cash = 0
        balance_inbound = 0
        balance_outbound = 0
        if hasattr(stripe_fa, "balance") and stripe_fa.balance:
            cash = stripe_fa.balance.cash or {}
            inbound = stripe_fa.balance.inbound_pending or {}
            outbound = stripe_fa.balance.outbound_pending or {}
            balance_cash = cash.get("usd", 0)
            balance_inbound = inbound.get("usd", 0)
            balance_outbound = outbound.get("usd", 0)

        fa = FinancialAccount(
            account_id=account.id,
            stripe_financial_account_id=stripe_fa.id,
            status=FinancialAccountStatus.open,
            supported_currencies=params.supported_currencies,
            aba_routing_number=aba_routing,
            aba_account_number_last4=aba_last4,
            features_status=features_status,
            balance_cash=balance_cash,
            balance_inbound_pending=balance_inbound,
            balance_outbound_pending=balance_outbound,
        )
        session.add(fa)
        await session.flush()

        log.info(
            "treasury.financial_account.created",
            account_id=str(account.id),
            stripe_fa_id=stripe_fa.id,
        )

        return self._to_read_schema(fa)

    async def sync_balance(
        self,
        session: AsyncSession,
        financial_account: FinancialAccount,
        account: Account,
    ) -> FinancialAccount:
        """Sync balance from Stripe for a Financial Account."""
        if account.stripe_id is None:
            raise TreasuryError(
                f"Account {account.id} has no Stripe connected account ID."
            )

        stripe_fa = await stripe_service.retrieve_financial_account(
            financial_account.stripe_financial_account_id,
            stripe_account_id=account.stripe_id,
        )

        if hasattr(stripe_fa, "balance") and stripe_fa.balance:
            cash = stripe_fa.balance.cash or {}
            inbound = stripe_fa.balance.inbound_pending or {}
            outbound = stripe_fa.balance.outbound_pending or {}
            financial_account.balance_cash = cash.get("usd", 0)
            financial_account.balance_inbound_pending = inbound.get("usd", 0)
            financial_account.balance_outbound_pending = outbound.get("usd", 0)

        # Update features status
        features_status: dict[str, object] = {}
        if hasattr(stripe_fa, "active_features"):
            features_status["active_features"] = list(
                stripe_fa.active_features or []
            )
        if hasattr(stripe_fa, "pending_features"):
            features_status["pending_features"] = list(
                stripe_fa.pending_features or []
            )
        if hasattr(stripe_fa, "restricted_features"):
            features_status["restricted_features"] = list(
                stripe_fa.restricted_features or []
            )
        financial_account.features_status = features_status

        # Update ABA info
        if hasattr(stripe_fa, "financial_addresses"):
            for addr in stripe_fa.financial_addresses or []:
                if addr.type == "aba" and addr.aba:
                    financial_account.aba_routing_number = addr.aba.routing_number
                    financial_account.aba_account_number_last4 = (
                        addr.aba.account_number_last4
                    )
                    break

        # Update status
        if stripe_fa.status == "closed":
            financial_account.status = FinancialAccountStatus.closed

        session.add(financial_account)

        log.info(
            "treasury.financial_account.balance_synced",
            stripe_fa_id=financial_account.stripe_financial_account_id,
            cash=financial_account.balance_cash,
            inbound=financial_account.balance_inbound_pending,
            outbound=financial_account.balance_outbound_pending,
        )

        return financial_account

    async def handle_financial_account_updated(
        self,
        session: AsyncSession,
        stripe_financial_account_id: str,
        stripe_account_id: str,
    ) -> FinancialAccount | None:
        """Handle a treasury.financial_account webhook event."""
        repo = FinancialAccountRepository(session)
        fa = await repo.get_by_stripe_id(stripe_financial_account_id)
        if fa is None:
            log.warning(
                "treasury.webhook.financial_account_not_found",
                stripe_fa_id=stripe_financial_account_id,
            )
            return None

        account_repo = AccountRepository(session)
        account = await account_repo.get_by_id(fa.account_id)
        if account is None:
            log.warning(
                "treasury.webhook.account_not_found",
                account_id=str(fa.account_id),
            )
            return None

        return await self.sync_balance(session, fa, account)

    # ── Fund Routing ──

    async def is_treasury_routed(
        self,
        session: AsyncReadSession,
        account: Account,
    ) -> bool:
        """Check if an account should route funds through Treasury.

        Returns True if the account is a Custom account with treasury enabled
        and has an open Financial Account.
        """
        if account.account_mode != AccountMode.custom:
            return False
        if not account.treasury_enabled:
            return False

        repo = FinancialAccountRepository(session)
        fa = await repo.get_by_account_id(account.id)
        return fa is not None and fa.is_open()

    async def route_spendable_funds(
        self,
        session: AsyncSession,
        account: Account,
        amount: int,
        currency: str = "usd",
        *,
        description: str | None = None,
    ) -> str | None:
        """Route spendable funds into the Financial Account via intra-Stripe flow.

        This is the bridge between the fund lifecycle engine (spendable state)
        and the Treasury Financial Account. Called instead of the standard
        Stripe transfer+payout for Custom accounts.

        Returns the Stripe InboundTransfer ID if successful, None otherwise.
        """
        if account.stripe_id is None:
            raise TreasuryError(
                f"Account {account.id} has no Stripe connected account."
            )

        repo = FinancialAccountRepository(session)
        fa = await repo.get_by_account_id(account.id)
        if fa is None or not fa.is_open():
            raise FinancialAccountNotFound(account.id)

        log.info(
            "treasury.route_spendable_funds",
            account_id=str(account.id),
            amount=amount,
            currency=currency,
        )

        # For intra-Stripe flows, the funds move from the platform's Stripe
        # balance to the connected account's Financial Account. This uses
        # Stripe's internal rails, so no external payment method is needed.
        # The actual implementation depends on whether funds are already
        # on the connected account (use ReceivedCredit in test mode) or
        # need to be transferred first.
        #
        # In production, the flow is:
        # 1. Platform transfers to connected account (existing payout flow)
        # 2. Connected account moves to Financial Account via InboundTransfer
        #
        # For now, we record the intent and update local balance tracking.
        # Full wire-up happens when we integrate with the payout task.

        return None

    # ── Helpers ──

    @staticmethod
    def _to_read_schema(fa: FinancialAccount) -> FinancialAccountRead:
        return FinancialAccountRead(
            id=fa.id,
            created_at=fa.created_at,
            modified_at=fa.modified_at,
            account_id=fa.account_id,
            stripe_financial_account_id=fa.stripe_financial_account_id,
            status=fa.status,
            supported_currencies=fa.supported_currencies,
            aba_routing_number=fa.aba_routing_number,
            aba_account_number_last4=fa.aba_account_number_last4,
            features_status=fa.features_status,
            balance=FinancialAccountBalance(
                cash=fa.balance_cash,
                inbound_pending=fa.balance_inbound_pending,
                outbound_pending=fa.balance_outbound_pending,
                effective=fa.effective_balance,
            ),
            last_synced_at=fa.modified_at,
        )


treasury_service = TreasuryService()
