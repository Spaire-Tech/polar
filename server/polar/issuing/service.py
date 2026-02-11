"""Issuing service — business logic for cardholders, cards, and authorization."""

from __future__ import annotations

import uuid

import structlog

from polar.account.repository import AccountRepository
from polar.enums import AccountMode, IssuingStatus
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.logging import Logger
from polar.models import Account
from polar.models.financial_account import FinancialAccount
from polar.models.issuing import (
    Cardholder,
    CardholderStatus,
    IssuedCard,
    IssuedCardStatus,
    IssuedCardType,
)
from polar.postgres import AsyncReadSession, AsyncSession
from polar.treasury.repository import FinancialAccountRepository

from .repository import CardholderRepository, IssuedCardRepository
from .schemas import (
    AuthorizationDecision,
    CardholderCreate,
    CardholderRead,
    CardholderUpdate,
    IssuedCardCreate,
    IssuedCardRead,
    IssuedCardUpdate,
)

log: Logger = structlog.get_logger()


class IssuingError(PolarError):
    pass


class AccountNotIssuingReady(IssuingError):
    def __init__(self, account_id: uuid.UUID) -> None:
        super().__init__(
            f"Account {account_id} is not issuing-ready. "
            "Requires a Custom account with issuing_status=issuing_active."
        )


class CardholderNotFound(IssuingError):
    def __init__(self, cardholder_id: uuid.UUID) -> None:
        super().__init__(f"Cardholder {cardholder_id} not found.")


class IssuedCardNotFound(IssuingError):
    def __init__(self, card_id: uuid.UUID) -> None:
        super().__init__(f"Issued card {card_id} not found.")


class NoFinancialAccount(IssuingError):
    def __init__(self, account_id: uuid.UUID) -> None:
        super().__init__(
            f"Account {account_id} has no open Financial Account. "
            "Cards require a Treasury Financial Account to fund from."
        )


class IssuingService:
    # ── Cardholder operations ──

    async def create_cardholder(
        self,
        session: AsyncSession,
        account: Account,
        params: CardholderCreate,
    ) -> CardholderRead:
        """Create a new cardholder for a merchant account."""
        self._assert_issuing_ready(account)

        if account.stripe_id is None:
            raise IssuingError(
                f"Account {account.id} has no Stripe connected account."
            )

        # Create on Stripe
        stripe_ch = await stripe_service.create_cardholder(
            stripe_account_id=account.stripe_id,
            name=params.name,
            email=params.email,
            phone_number=params.phone,
            cardholder_type=params.type.value,
            billing_address=params.billing_address,
        )

        repo = CardholderRepository(session)
        cardholder = Cardholder(
            account_id=account.id,
            stripe_cardholder_id=stripe_ch.id,
            name=params.name,
            email=params.email,
            phone=params.phone,
            type=params.type,
            status=CardholderStatus.active,
            billing_address=params.billing_address,
        )
        await repo.create(cardholder, flush=True)

        log.info(
            "issuing.cardholder.created",
            account_id=str(account.id),
            cardholder_id=str(cardholder.id),
        )

        return self._cardholder_to_read(cardholder)

    async def update_cardholder(
        self,
        session: AsyncSession,
        account: Account,
        cardholder_id: uuid.UUID,
        params: CardholderUpdate,
    ) -> CardholderRead:
        """Update a cardholder."""
        repo = CardholderRepository(session)
        cardholder = await repo.get_by_id(cardholder_id)
        if cardholder is None or cardholder.account_id != account.id:
            raise CardholderNotFound(cardholder_id)

        if account.stripe_id is None:
            raise IssuingError(
                f"Account {account.id} has no Stripe connected account."
            )

        # Build Stripe update params
        stripe_params: dict[str, object] = {}
        update_dict: dict[str, object] = {}

        if params.name is not None:
            stripe_params["name"] = params.name
            update_dict["name"] = params.name
        if params.email is not None:
            stripe_params["email"] = params.email
            update_dict["email"] = params.email
        if params.phone is not None:
            stripe_params["phone_number"] = params.phone
            update_dict["phone"] = params.phone
        if params.status is not None:
            stripe_params["status"] = params.status.value
            update_dict["status"] = params.status
        if params.billing_address is not None:
            stripe_params["billing"] = {"address": params.billing_address}
            update_dict["billing_address"] = params.billing_address

        if stripe_params:
            await stripe_service.update_cardholder(
                cardholder.stripe_cardholder_id,
                stripe_account_id=account.stripe_id,
                params=stripe_params,
            )

        if update_dict:
            await repo.update(cardholder, update_dict=update_dict)

        return self._cardholder_to_read(cardholder)

    async def list_cardholders(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
    ) -> list[CardholderRead]:
        """List all cardholders for an account."""
        repo = CardholderRepository(session)
        cardholders = await repo.get_by_account_id(account_id)
        return [self._cardholder_to_read(ch) for ch in cardholders]

    async def get_cardholder(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
        cardholder_id: uuid.UUID,
    ) -> CardholderRead | None:
        """Get a specific cardholder."""
        repo = CardholderRepository(session)
        cardholder = await repo.get_by_id(cardholder_id)
        if cardholder is None or cardholder.account_id != account_id:
            return None
        return self._cardholder_to_read(cardholder)

    # ── Card operations ──

    async def create_card(
        self,
        session: AsyncSession,
        account: Account,
        params: IssuedCardCreate,
    ) -> IssuedCardRead:
        """Create a new issued card."""
        self._assert_issuing_ready(account)

        if account.stripe_id is None:
            raise IssuingError(
                f"Account {account.id} has no Stripe connected account."
            )

        # Verify cardholder belongs to this account
        ch_repo = CardholderRepository(session)
        cardholder = await ch_repo.get_by_id(params.cardholder_id)
        if cardholder is None or cardholder.account_id != account.id:
            raise CardholderNotFound(params.cardholder_id)

        # Get Financial Account
        fa_repo = FinancialAccountRepository(session)
        fa = await fa_repo.get_by_account_id(account.id)
        if fa is None or not fa.is_open():
            raise NoFinancialAccount(account.id)

        # Create on Stripe
        stripe_card = await stripe_service.create_issuing_card(
            stripe_account_id=account.stripe_id,
            cardholder_id=cardholder.stripe_cardholder_id,
            currency="usd",
            card_type=params.type.value,
            status=params.status.value,
            financial_account=fa.stripe_financial_account_id,
            spending_controls=params.spending_controls,
        )

        card_repo = IssuedCardRepository(session)
        card = IssuedCard(
            cardholder_id=cardholder.id,
            financial_account_id=fa.id,
            stripe_card_id=stripe_card.id,
            type=params.type,
            status=params.status,
            last4=stripe_card.last4,
            exp_month=stripe_card.exp_month,
            exp_year=stripe_card.exp_year,
            spending_controls=params.spending_controls or {},
        )
        await card_repo.create(card, flush=True)

        log.info(
            "issuing.card.created",
            account_id=str(account.id),
            card_id=str(card.id),
            type=params.type.value,
        )

        return self._card_to_read(card)

    async def update_card(
        self,
        session: AsyncSession,
        account: Account,
        card_id: uuid.UUID,
        params: IssuedCardUpdate,
    ) -> IssuedCardRead:
        """Update an issued card (status, spending controls)."""
        card_repo = IssuedCardRepository(session)
        card = await card_repo.get_by_id(card_id)
        if card is None:
            raise IssuedCardNotFound(card_id)

        # Verify ownership via cardholder
        ch_repo = CardholderRepository(session)
        cardholder = await ch_repo.get_by_id(card.cardholder_id)
        if cardholder is None or cardholder.account_id != account.id:
            raise IssuedCardNotFound(card_id)

        if account.stripe_id is None:
            raise IssuingError(
                f"Account {account.id} has no Stripe connected account."
            )

        stripe_params: dict[str, object] = {}
        update_dict: dict[str, object] = {}

        if params.status is not None:
            stripe_params["status"] = params.status.value
            update_dict["status"] = params.status
        if params.spending_controls is not None:
            stripe_params["spending_controls"] = params.spending_controls
            update_dict["spending_controls"] = params.spending_controls

        if stripe_params:
            await stripe_service.update_issuing_card(
                card.stripe_card_id,
                stripe_account_id=account.stripe_id,
                params=stripe_params,
            )

        if update_dict:
            await card_repo.update(card, update_dict=update_dict)

        return self._card_to_read(card)

    async def list_cards(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
    ) -> list[IssuedCardRead]:
        """List all cards for an account."""
        card_repo = IssuedCardRepository(session)
        cards = await card_repo.get_active_by_account(account_id)
        return [self._card_to_read(c) for c in cards]

    async def get_card(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
        card_id: uuid.UUID,
    ) -> IssuedCardRead | None:
        """Get a specific card."""
        card_repo = IssuedCardRepository(session)
        card = await card_repo.get_by_id(card_id)
        if card is None:
            return None

        # Verify ownership
        ch_repo = CardholderRepository(session)
        cardholder = await ch_repo.get_by_id(card.cardholder_id)
        if cardholder is None or cardholder.account_id != account_id:
            return None

        return self._card_to_read(card)

    # ── Authorization (real-time) ──

    async def evaluate_authorization(
        self,
        session: AsyncReadSession,
        *,
        stripe_card_id: str,
        amount: int,
        currency: str,
        merchant_data: dict[str, object] | None = None,
    ) -> AuthorizationDecision:
        """Evaluate an issuing authorization request.

        This is called from the issuing_authorization.request webhook handler.
        It MUST complete within ~2 seconds. It reads cached snapshots only,
        never triggers a recalculation.
        """
        # 1. Look up the card
        card_repo = IssuedCardRepository(session)
        card = await card_repo.get_by_stripe_id(stripe_card_id)
        if card is None:
            return AuthorizationDecision(
                approved=False, reason="card_not_found"
            )

        if not card.is_active():
            return AuthorizationDecision(
                approved=False, reason="card_inactive"
            )

        # 2. Look up the cardholder and account
        ch_repo = CardholderRepository(session)
        cardholder = await ch_repo.get_by_id(card.cardholder_id)
        if cardholder is None:
            return AuthorizationDecision(
                approved=False, reason="cardholder_not_found"
            )

        if cardholder.status != CardholderStatus.active:
            return AuthorizationDecision(
                approved=False, reason="cardholder_not_active"
            )

        account_repo = AccountRepository(session)
        account = await account_repo.get_by_id(cardholder.account_id)
        if account is None:
            return AuthorizationDecision(
                approved=False, reason="account_not_found"
            )

        # 3. Check account issuing status
        if not account.is_issuing_active():
            return AuthorizationDecision(
                approved=False,
                reason=f"issuing_not_active:{account.issuing_status}",
            )

        # 4. Check spendable balance from fund state snapshot (fast path)
        from polar.fund_lifecycle.repository import FundStateSnapshotRepository

        snapshot_repo = FundStateSnapshotRepository(session)
        snapshot = await snapshot_repo.get_by_account(cardholder.account_id)

        if snapshot is None:
            # No snapshot yet — deny by default (funds not cleared)
            return AuthorizationDecision(
                approved=False, reason="no_fund_snapshot"
            )

        if snapshot.spendable_amount < amount:
            return AuthorizationDecision(
                approved=False,
                reason="insufficient_spendable_balance",
            )

        # 5. All checks pass
        log.info(
            "issuing.authorization.approved",
            card_id=str(card.id),
            amount=amount,
            spendable=snapshot.spendable_amount,
        )

        return AuthorizationDecision(approved=True)

    # ── Webhook handlers ──

    async def handle_card_updated(
        self,
        session: AsyncSession,
        stripe_card_id: str,
        stripe_account_id: str,
    ) -> IssuedCard | None:
        """Handle an issuing_card.updated webhook event."""
        card_repo = IssuedCardRepository(session)
        card = await card_repo.get_by_stripe_id(stripe_card_id)
        if card is None:
            log.warning(
                "issuing.webhook.card_not_found",
                stripe_card_id=stripe_card_id,
            )
            return None

        # Fetch latest from Stripe
        stripe_card = await stripe_service.retrieve_issuing_card(
            stripe_card_id, stripe_account_id=stripe_account_id
        )

        update_dict: dict[str, object] = {}
        if stripe_card.status:
            try:
                update_dict["status"] = IssuedCardStatus(stripe_card.status)
            except ValueError:
                pass
        if stripe_card.last4:
            update_dict["last4"] = stripe_card.last4
        if stripe_card.spending_controls:
            update_dict["spending_controls"] = dict(
                stripe_card.spending_controls
            )
        if hasattr(stripe_card, "shipping") and stripe_card.shipping:
            update_dict["shipping_status"] = stripe_card.shipping.status
            if stripe_card.shipping.tracking_number:
                update_dict["shipping_tracking_number"] = (
                    stripe_card.shipping.tracking_number
                )
        if hasattr(stripe_card, "cancellation_reason"):
            update_dict["canceled_reason"] = stripe_card.cancellation_reason

        if update_dict:
            await card_repo.update(card, update_dict=update_dict)

        return card

    async def handle_cardholder_updated(
        self,
        session: AsyncSession,
        stripe_cardholder_id: str,
        stripe_account_id: str,
    ) -> Cardholder | None:
        """Handle an issuing_cardholder.updated webhook event."""
        ch_repo = CardholderRepository(session)
        cardholder = await ch_repo.get_by_stripe_id(stripe_cardholder_id)
        if cardholder is None:
            log.warning(
                "issuing.webhook.cardholder_not_found",
                stripe_cardholder_id=stripe_cardholder_id,
            )
            return None

        stripe_ch = await stripe_service.retrieve_cardholder(
            stripe_cardholder_id, stripe_account_id=stripe_account_id
        )

        update_dict: dict[str, object] = {}
        if stripe_ch.name:
            update_dict["name"] = stripe_ch.name
        if stripe_ch.email:
            update_dict["email"] = stripe_ch.email
        if stripe_ch.phone_number:
            update_dict["phone"] = stripe_ch.phone_number
        if stripe_ch.status:
            try:
                update_dict["status"] = CardholderStatus(stripe_ch.status)
            except ValueError:
                pass

        if update_dict:
            await ch_repo.update(cardholder, update_dict=update_dict)

        return cardholder

    # ── Helpers ──

    @staticmethod
    def _assert_issuing_ready(account: Account) -> None:
        if account.account_mode != AccountMode.custom:
            raise AccountNotIssuingReady(account.id)
        if not account.is_issuing_active():
            raise AccountNotIssuingReady(account.id)

    @staticmethod
    def _cardholder_to_read(ch: Cardholder) -> CardholderRead:
        return CardholderRead(
            id=ch.id,
            created_at=ch.created_at,
            modified_at=ch.modified_at,
            account_id=ch.account_id,
            stripe_cardholder_id=ch.stripe_cardholder_id,
            name=ch.name,
            email=ch.email,
            phone=ch.phone,
            type=ch.type,
            status=ch.status,
            billing_address=ch.billing_address,
        )

    @staticmethod
    def _card_to_read(card: IssuedCard) -> IssuedCardRead:
        return IssuedCardRead(
            id=card.id,
            created_at=card.created_at,
            modified_at=card.modified_at,
            cardholder_id=card.cardholder_id,
            financial_account_id=card.financial_account_id,
            stripe_card_id=card.stripe_card_id,
            type=card.type,
            status=card.status,
            last4=card.last4,
            exp_month=card.exp_month,
            exp_year=card.exp_year,
            spending_controls=card.spending_controls,
            shipping_status=card.shipping_status,
            canceled_reason=card.canceled_reason,
        )


issuing_service = IssuingService()
