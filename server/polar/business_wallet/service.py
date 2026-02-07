"""Business Wallet service.

Orchestrates financial account creation, card management, and treasury operations.
"""

import uuid
from collections.abc import Sequence

import structlog

from polar.auth.models import AuthSubject, User
from polar.config import settings
from polar.exceptions import PolarError
from polar.logging import Logger
from polar.models import Organization
from polar.models.financial_account import FinancialAccount, FinancialAccountStatus
from polar.models.issuing_card import IssuingCard, IssuingCardStatus, IssuingCardType
from polar.models.treasury_transaction import (
    TreasuryTransaction,
    TreasuryTransactionStatus,
    TreasuryTransactionType,
)
from polar.postgres import AsyncSession

from .repository import (
    FinancialAccountRepository,
    IssuingCardRepository,
    TreasuryTransactionRepository,
)
from .stripe_treasury_service import stripe_treasury_service

log: Logger = structlog.get_logger()


class BusinessWalletError(PolarError): ...


class FinancialAccountAlreadyExists(BusinessWalletError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        message = "A financial account already exists for this organization."
        super().__init__(message, 409)


class FinancialAccountNotFound(BusinessWalletError):
    def __init__(self) -> None:
        message = "Financial account not found."
        super().__init__(message, 404)


class FinancialAccountNotActive(BusinessWalletError):
    def __init__(self) -> None:
        message = "Financial account is not active yet. Please complete onboarding."
        super().__init__(message, 400)


class CardLimitReached(BusinessWalletError):
    def __init__(self) -> None:
        message = "Maximum number of active cards reached."
        super().__init__(message, 400)


class InsufficientFundsForPayment(BusinessWalletError):
    def __init__(self, available: int, requested: int) -> None:
        message = (
            f"Insufficient funds. Available: ${available / 100:.2f}, "
            f"Requested: ${requested / 100:.2f}"
        )
        super().__init__(message, 400)


MAX_ACTIVE_CARDS = 10


class BusinessWalletService:
    # -------------------------------------------------------------------
    # Financial Account
    # -------------------------------------------------------------------

    async def get_financial_account(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization_id: uuid.UUID,
    ) -> FinancialAccount | None:
        repo = FinancialAccountRepository.from_session(session)
        return await repo.get_by_organization(organization_id)

    async def create_financial_account(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        organization: Organization,
    ) -> FinancialAccount:
        repo = FinancialAccountRepository.from_session(session)

        existing = await repo.get_by_organization(organization.id)
        if existing is not None:
            raise FinancialAccountAlreadyExists(organization.id)

        # 1. Create a Custom connected account with Treasury + Issuing capabilities
        stripe_account = await stripe_treasury_service.create_custom_account(
            country="US",
            email=f"treasury+{organization.slug}@spaire.com",
            business_name=organization.name,
        )

        # 2. Create a Treasury Financial Account on that connected account
        stripe_fa = await stripe_treasury_service.create_financial_account(
            stripe_account_id=stripe_account.id,
        )

        # 3. Extract financial addresses if available
        aba_routing = None
        aba_account = None
        if hasattr(stripe_fa, "financial_addresses") and stripe_fa.financial_addresses:
            for addr in stripe_fa.financial_addresses:
                if addr.type == "aba":
                    aba_routing = addr.aba.routing_number if addr.aba else None
                    aba_account = addr.aba.account_number if addr.aba else None

        # 4. Parse features
        features = stripe_fa.active_features if hasattr(stripe_fa, "active_features") else []

        # 5. Persist locally
        fa = FinancialAccount(
            stripe_financial_account_id=stripe_fa.id,
            status=FinancialAccountStatus.from_stripe(stripe_fa.status),
            currency="usd",
            balance_cash=0,
            balance_inbound_pending=0,
            balance_outbound_pending=0,
            aba_routing_number=aba_routing,
            aba_account_number=aba_account,
            features_card_issuing="card_issuing" in features,
            features_deposit_insurance="deposit_insurance" in features,
            features_inbound_transfers_ach="inbound_transfers.ach" in features,
            features_outbound_payments_ach="outbound_payments.ach" in features,
            features_outbound_transfers_ach="outbound_transfers.ach" in features,
            stripe_connected_account_id=stripe_account.id,
            organization_id=organization.id,
        )

        fa = await repo.create(fa)
        await session.flush()

        log.info(
            "business_wallet.financial_account.created",
            organization_id=str(organization.id),
            stripe_fa_id=stripe_fa.id,
            stripe_account_id=stripe_account.id,
        )

        return fa

    async def get_onboarding_link(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        organization: Organization,
        return_path: str,
    ) -> str:
        repo = FinancialAccountRepository.from_session(session)
        fa = await repo.get_by_organization(organization.id)
        if fa is None:
            raise FinancialAccountNotFound()

        return_url = settings.generate_frontend_url(return_path)
        refresh_url = settings.generate_external_url(
            f"/v1/integrations/stripe/refresh?return_path={return_path}"
        )

        account_link = await stripe_treasury_service.create_account_link(
            fa.stripe_connected_account_id,
            return_url=return_url,
            refresh_url=refresh_url,
        )
        return account_link.url

    async def sync_financial_account_from_stripe(
        self,
        session: AsyncSession,
        stripe_fa_id: str,
        stripe_account_id: str,
    ) -> FinancialAccount | None:
        """Sync a financial account from Stripe webhook data."""
        repo = FinancialAccountRepository.from_session(session)
        fa = await repo.get_by_stripe_id(stripe_fa_id)
        if fa is None:
            return None

        stripe_fa = await stripe_treasury_service.retrieve_financial_account(
            stripe_fa_id,
            stripe_account_id=stripe_account_id,
        )

        # Update balance
        balance = stripe_fa.balance
        if balance:
            fa.balance_cash = balance.cash.get("usd", 0) if balance.cash else 0
            fa.balance_inbound_pending = (
                balance.inbound_pending.get("usd", 0)
                if balance.inbound_pending
                else 0
            )
            fa.balance_outbound_pending = (
                balance.outbound_pending.get("usd", 0)
                if balance.outbound_pending
                else 0
            )

        fa.status = FinancialAccountStatus.from_stripe(stripe_fa.status)

        # Update features
        features = stripe_fa.active_features if hasattr(stripe_fa, "active_features") else []
        fa.features_card_issuing = "card_issuing" in features
        fa.features_deposit_insurance = "deposit_insurance" in features
        fa.features_inbound_transfers_ach = "inbound_transfers.ach" in features
        fa.features_outbound_payments_ach = "outbound_payments.ach" in features
        fa.features_outbound_transfers_ach = "outbound_transfers.ach" in features

        fa = await repo.update(fa)
        await session.flush()

        log.info(
            "business_wallet.financial_account.synced",
            stripe_fa_id=stripe_fa_id,
            status=fa.status,
            balance_cash=fa.balance_cash,
        )
        return fa

    async def get_onboarding_status(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization_id: uuid.UUID,
    ) -> dict:
        fa_repo = FinancialAccountRepository.from_session(session)
        card_repo = IssuingCardRepository.from_session(session)

        fa = await fa_repo.get_by_organization(organization_id)
        has_fa = fa is not None

        card_count = 0
        if fa is not None:
            cards = await card_repo.get_by_financial_account(fa.id)
            card_count = len([c for c in cards if c.status != IssuingCardStatus.canceled])

        requirements: list[str] = []
        stripe_account_id = None

        if fa is not None:
            stripe_account_id = fa.stripe_connected_account_id
            try:
                account = await stripe_treasury_service.retrieve_account(
                    fa.stripe_connected_account_id
                )
                if account.requirements and account.requirements.currently_due:
                    requirements = list(account.requirements.currently_due)
            except Exception:
                pass

        return {
            "has_financial_account": has_fa,
            "financial_account_status": fa.status if fa else None,
            "has_cards": card_count > 0,
            "card_count": card_count,
            "is_fully_onboarded": (
                has_fa
                and fa is not None
                and fa.is_active
                and len(requirements) == 0
            ),
            "stripe_connected_account_id": stripe_account_id,
            "requirements_pending": requirements,
        }

    # -------------------------------------------------------------------
    # Issuing Cards
    # -------------------------------------------------------------------

    async def list_cards(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization_id: uuid.UUID,
    ) -> list[IssuingCard]:
        card_repo = IssuingCardRepository.from_session(session)
        return await card_repo.get_by_organization(organization_id)

    async def get_card(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        card_id: uuid.UUID,
    ) -> IssuingCard | None:
        card_repo = IssuingCardRepository.from_session(session)
        return await card_repo.get_by_id(card_id)

    async def create_card(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        financial_account: FinancialAccount,
        organization: Organization,
        cardholder_name: str,
        card_type: IssuingCardType = IssuingCardType.virtual,
        card_color: str = "#0062FF",
        spending_limit_amount: int | None = None,
        spending_limit_interval: str | None = None,
    ) -> IssuingCard:
        if not financial_account.is_active:
            raise FinancialAccountNotActive()

        card_repo = IssuingCardRepository.from_session(session)

        # Check card limit
        active_cards = await card_repo.get_by_financial_account(
            financial_account.id, status=IssuingCardStatus.active
        )
        if len(active_cards) >= MAX_ACTIVE_CARDS:
            raise CardLimitReached()

        # Create cardholder (or reuse if exists)
        user = auth_subject.subject
        cardholder = await stripe_treasury_service.create_cardholder(
            stripe_account_id=financial_account.stripe_connected_account_id,
            name=cardholder_name,
            email=user.email,
            billing_address={
                "line1": "354 Oyster Point Blvd",
                "city": "South San Francisco",
                "state": "CA",
                "postal_code": "94080",
                "country": "US",
            },
        )

        # Create the card on Stripe
        stripe_card = await stripe_treasury_service.create_card(
            stripe_account_id=financial_account.stripe_connected_account_id,
            cardholder_id=cardholder.id,
            financial_account_id=financial_account.stripe_financial_account_id,
            card_type=card_type.value,
            spending_limit_amount=spending_limit_amount,
            spending_limit_interval=spending_limit_interval,
        )

        # Store metadata for card color
        await stripe_treasury_service.update_card(
            stripe_card.id,
            stripe_account_id=financial_account.stripe_connected_account_id,
            metadata={"card_color": card_color},
        )

        # Persist locally
        card = IssuingCard(
            stripe_card_id=stripe_card.id,
            stripe_cardholder_id=cardholder.id,
            status=IssuingCardStatus.from_stripe(stripe_card.status),
            card_type=IssuingCardType(card_type),
            last4=stripe_card.last4,
            exp_month=stripe_card.exp_month,
            exp_year=stripe_card.exp_year,
            brand=stripe_card.brand or "Visa",
            currency=stripe_card.currency,
            cardholder_name=cardholder_name,
            card_color=card_color,
            spending_limit_amount=spending_limit_amount,
            spending_limit_interval=spending_limit_interval,
            total_spent=0,
            financial_account_id=financial_account.id,
            organization_id=organization.id,
        )

        card = await card_repo.create(card)
        await session.flush()

        log.info(
            "business_wallet.card.created",
            card_id=str(card.id),
            stripe_card_id=stripe_card.id,
            card_type=card_type,
        )

        return card

    async def update_card(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        card: IssuingCard,
        status: IssuingCardStatus | None = None,
        card_color: str | None = None,
        spending_limit_amount: int | None = None,
        spending_limit_interval: str | None = None,
    ) -> IssuingCard:
        card_repo = IssuingCardRepository.from_session(session)
        fa_repo = FinancialAccountRepository.from_session(session)

        fa = await fa_repo.get_by_id(card.financial_account_id)
        if fa is None:
            raise FinancialAccountNotFound()

        # Update on Stripe
        stripe_status = status.value if status else None
        stripe_limit = spending_limit_amount
        stripe_interval = spending_limit_interval

        if stripe_status or stripe_limit is not None:
            await stripe_treasury_service.update_card(
                card.stripe_card_id,
                stripe_account_id=fa.stripe_connected_account_id,
                status=stripe_status,
                spending_limit_amount=stripe_limit,
                spending_limit_interval=stripe_interval,
            )

        # Update card color metadata
        if card_color is not None:
            await stripe_treasury_service.update_card(
                card.stripe_card_id,
                stripe_account_id=fa.stripe_connected_account_id,
                metadata={"card_color": card_color},
            )
            card.card_color = card_color

        if status is not None:
            card.status = status
        if spending_limit_amount is not None:
            card.spending_limit_amount = spending_limit_amount
        if spending_limit_interval is not None:
            card.spending_limit_interval = spending_limit_interval

        card = await card_repo.update(card)
        await session.flush()

        return card

    async def get_card_details(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        card: IssuingCard,
    ) -> dict:
        fa_repo = FinancialAccountRepository.from_session(session)
        fa = await fa_repo.get_by_id(card.financial_account_id)
        if fa is None:
            raise FinancialAccountNotFound()

        stripe_card = await stripe_treasury_service.retrieve_card_details(
            card.stripe_card_id,
            stripe_account_id=fa.stripe_connected_account_id,
        )

        return {
            "number": stripe_card.number or "",
            "cvc": stripe_card.cvc or "",
            "exp_month": stripe_card.exp_month,
            "exp_year": stripe_card.exp_year,
        }

    # -------------------------------------------------------------------
    # Treasury Transactions
    # -------------------------------------------------------------------

    async def list_transactions(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        financial_account_id: uuid.UUID,
        *,
        limit: int = 50,
        page: int = 1,
    ) -> tuple[list[TreasuryTransaction], int]:
        tx_repo = TreasuryTransactionRepository.from_session(session)
        return await tx_repo.list_by_financial_account(
            financial_account_id, limit=limit, page=page
        )

    async def sync_transactions_from_stripe(
        self,
        session: AsyncSession,
        financial_account: FinancialAccount,
    ) -> int:
        """Sync transactions from Stripe for a financial account."""
        tx_repo = TreasuryTransactionRepository.from_session(session)

        result = await stripe_treasury_service.list_financial_account_transactions(
            financial_account.stripe_financial_account_id,
            stripe_account_id=financial_account.stripe_connected_account_id,
            limit=100,
        )

        synced = 0
        for stripe_tx in result.data:
            existing = await tx_repo.get_by_stripe_id(stripe_tx.id)
            if existing is not None:
                # Update status
                existing.status = TreasuryTransactionStatus(stripe_tx.status)
                existing.amount = stripe_tx.amount
                await tx_repo.update(existing)
                continue

            flow_type = None
            flow_id = None
            if hasattr(stripe_tx, "flow_type") and stripe_tx.flow_type:
                flow_type = stripe_tx.flow_type
            if hasattr(stripe_tx, "flow") and stripe_tx.flow:
                flow_id = stripe_tx.flow

            tx_type = TreasuryTransactionType.other
            if flow_type:
                try:
                    tx_type = TreasuryTransactionType(flow_type)
                except ValueError:
                    tx_type = TreasuryTransactionType.other

            tx = TreasuryTransaction(
                stripe_transaction_id=stripe_tx.id,
                transaction_type=tx_type,
                status=TreasuryTransactionStatus(stripe_tx.status),
                amount=stripe_tx.amount,
                currency=stripe_tx.currency,
                description=stripe_tx.description or "",
                flow_type=flow_type,
                flow_id=flow_id,
                counterparty_name=None,
                financial_account_id=financial_account.id,
            )

            await tx_repo.create(tx)
            synced += 1

        await session.flush()

        log.info(
            "business_wallet.transactions.synced",
            financial_account_id=str(financial_account.id),
            synced=synced,
        )
        return synced

    # -------------------------------------------------------------------
    # Outbound Payments
    # -------------------------------------------------------------------

    async def create_outbound_payment(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        financial_account: FinancialAccount,
        amount: int,
        currency: str = "usd",
        destination_account_number: str,
        destination_routing_number: str,
        description: str = "",
        counterparty_name: str = "",
    ) -> TreasuryTransaction:
        if not financial_account.is_active:
            raise FinancialAccountNotActive()

        if financial_account.balance_cash < amount:
            raise InsufficientFundsForPayment(
                available=financial_account.balance_cash,
                requested=amount,
            )

        stripe_payment = await stripe_treasury_service.create_outbound_payment(
            stripe_account_id=financial_account.stripe_connected_account_id,
            financial_account_id=financial_account.stripe_financial_account_id,
            amount=amount,
            currency=currency,
            destination_account_number=destination_account_number,
            destination_routing_number=destination_routing_number,
            description=description,
            counterparty_name=counterparty_name,
        )

        tx_repo = TreasuryTransactionRepository.from_session(session)
        tx = TreasuryTransaction(
            stripe_transaction_id=stripe_payment.transaction or f"op_{stripe_payment.id}",
            transaction_type=TreasuryTransactionType.outbound_payment,
            status=TreasuryTransactionStatus.open,
            amount=-amount,
            currency=currency,
            description=description,
            flow_type="outbound_payment",
            flow_id=stripe_payment.id,
            counterparty_name=counterparty_name,
            financial_account_id=financial_account.id,
        )

        tx = await tx_repo.create(tx)
        await session.flush()

        return tx


business_wallet_service = BusinessWalletService()
