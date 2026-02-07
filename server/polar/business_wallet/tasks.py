"""Background tasks and webhook handlers for Business Wallet (Treasury + Issuing)."""

import uuid
from typing import cast

import stripe as stripe_lib
import structlog

from polar.logging import Logger
from polar.models.financial_account import FinancialAccount
from polar.models.issuing_card import IssuingCardStatus
from polar.models.treasury_transaction import (
    TreasuryTransaction,
    TreasuryTransactionStatus,
    TreasuryTransactionType,
)
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import (
    FinancialAccountRepository,
    IssuingCardRepository,
    TreasuryTransactionRepository,
)
from .stripe_treasury_service import stripe_treasury_service

log: Logger = structlog.get_logger()


# -----------------------------------------------------------------------
# Treasury Financial Account webhooks
# -----------------------------------------------------------------------


@actor(
    actor_name="stripe.webhook.treasury.financial_account.features_status_updated",
    priority=TaskPriority.HIGH,
)
async def treasury_financial_account_updated(
    stripe_financial_account_id: str,
    stripe_account_id: str,
) -> None:
    """Handle treasury.financial_account.features_status_updated webhook."""
    async with AsyncSessionMaker() as session:
        from .service import business_wallet_service

        await business_wallet_service.sync_financial_account_from_stripe(
            session,
            stripe_financial_account_id,
            stripe_account_id,
        )


# -----------------------------------------------------------------------
# Treasury Transaction webhooks
# -----------------------------------------------------------------------


@actor(
    actor_name="stripe.webhook.treasury.received_credit",
    priority=TaskPriority.HIGH,
)
async def treasury_received_credit(
    stripe_transaction_id: str,
    stripe_account_id: str,
    amount: int,
    currency: str,
    description: str,
    financial_account_id: str,
    flow_type: str | None = None,
    flow_id: str | None = None,
) -> None:
    """Handle treasury.received_credit webhook — money arriving in FA."""
    async with AsyncSessionMaker() as session:
        fa_repo = FinancialAccountRepository.from_session(session)
        fa = await fa_repo.get_by_stripe_id(financial_account_id)
        if fa is None:
            log.warning(
                "treasury.received_credit: unknown financial account",
                stripe_fa_id=financial_account_id,
            )
            return

        tx_repo = TreasuryTransactionRepository.from_session(session)
        existing = await tx_repo.get_by_stripe_id(stripe_transaction_id)
        if existing is not None:
            return

        tx = TreasuryTransaction(
            stripe_transaction_id=stripe_transaction_id,
            transaction_type=TreasuryTransactionType.received_credit,
            status=TreasuryTransactionStatus.posted,
            amount=amount,
            currency=currency,
            description=description,
            flow_type=flow_type,
            flow_id=flow_id,
            financial_account_id=fa.id,
        )
        await tx_repo.create(tx)

        # Update balance
        fa.balance_cash += amount
        await fa_repo.update(fa)

        log.info(
            "treasury.received_credit.processed",
            amount=amount,
            financial_account_id=str(fa.id),
        )


@actor(
    actor_name="stripe.webhook.treasury.received_debit",
    priority=TaskPriority.HIGH,
)
async def treasury_received_debit(
    stripe_transaction_id: str,
    stripe_account_id: str,
    amount: int,
    currency: str,
    description: str,
    financial_account_id: str,
    flow_type: str | None = None,
    flow_id: str | None = None,
) -> None:
    """Handle treasury.received_debit webhook — money leaving FA."""
    async with AsyncSessionMaker() as session:
        fa_repo = FinancialAccountRepository.from_session(session)
        fa = await fa_repo.get_by_stripe_id(financial_account_id)
        if fa is None:
            return

        tx_repo = TreasuryTransactionRepository.from_session(session)
        existing = await tx_repo.get_by_stripe_id(stripe_transaction_id)
        if existing is not None:
            return

        tx = TreasuryTransaction(
            stripe_transaction_id=stripe_transaction_id,
            transaction_type=TreasuryTransactionType.received_debit,
            status=TreasuryTransactionStatus.posted,
            amount=-abs(amount),
            currency=currency,
            description=description,
            flow_type=flow_type,
            flow_id=flow_id,
            financial_account_id=fa.id,
        )
        await tx_repo.create(tx)

        fa.balance_cash -= abs(amount)
        await fa_repo.update(fa)

        log.info(
            "treasury.received_debit.processed",
            amount=amount,
            financial_account_id=str(fa.id),
        )


# -----------------------------------------------------------------------
# Issuing Authorization webhook (card spend)
# -----------------------------------------------------------------------


@actor(
    actor_name="stripe.webhook.issuing_authorization.created",
    priority=TaskPriority.HIGH,
)
async def issuing_authorization_created(
    authorization_id: str,
    stripe_account_id: str,
    card_id: str,
    amount: int,
    currency: str,
    merchant_name: str | None = None,
) -> None:
    """Handle issuing_authorization.created webhook — card was used."""
    async with AsyncSessionMaker() as session:
        card_repo = IssuingCardRepository.from_session(session)
        card = await card_repo.get_by_stripe_id(card_id)
        if card is None:
            log.warning(
                "issuing_authorization: unknown card",
                stripe_card_id=card_id,
            )
            return

        card.total_spent += abs(amount)
        await card_repo.update(card)

        # Also create a treasury transaction for the spend
        fa_repo = FinancialAccountRepository.from_session(session)
        fa = await fa_repo.get_by_id(card.financial_account_id)
        if fa is None:
            return

        tx_repo = TreasuryTransactionRepository.from_session(session)
        tx = TreasuryTransaction(
            stripe_transaction_id=f"auth_{authorization_id}",
            transaction_type=TreasuryTransactionType.issuing_authorization,
            status=TreasuryTransactionStatus.open,
            amount=-abs(amount),
            currency=currency,
            description=f"Card spend: {merchant_name or 'Unknown merchant'}",
            flow_type="issuing_authorization",
            flow_id=authorization_id,
            counterparty_name=merchant_name,
            financial_account_id=fa.id,
        )
        await tx_repo.create(tx)

        fa.balance_cash -= abs(amount)
        await fa_repo.update(fa)

        log.info(
            "issuing_authorization.processed",
            card_id=str(card.id),
            amount=amount,
            merchant=merchant_name,
        )


# -----------------------------------------------------------------------
# Issuing Card status update webhook
# -----------------------------------------------------------------------


@actor(
    actor_name="stripe.webhook.issuing_card.updated",
    priority=TaskPriority.LOW,
)
async def issuing_card_updated(
    stripe_card_id: str,
    stripe_account_id: str,
    status: str,
) -> None:
    """Handle issuing_card.updated webhook."""
    async with AsyncSessionMaker() as session:
        card_repo = IssuingCardRepository.from_session(session)
        card = await card_repo.get_by_stripe_id(stripe_card_id)
        if card is None:
            return

        card.status = IssuingCardStatus.from_stripe(status)
        await card_repo.update(card)

        log.info(
            "issuing_card.updated",
            card_id=str(card.id),
            status=status,
        )
