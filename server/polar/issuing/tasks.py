"""Background tasks for Stripe Issuing (cards, authorization, webhooks)."""

import structlog

from polar.exceptions import PolarError
from polar.logging import Logger
from polar.worker import AsyncSessionMaker, TaskPriority, actor

log: Logger = structlog.get_logger()


class IssuingTaskError(PolarError):
    pass


@actor(
    actor_name="issuing.handle_authorization_request",
    priority=TaskPriority.HIGH,
)
async def handle_authorization_request(
    stripe_authorization_id: str,
    stripe_card_id: str,
    stripe_account_id: str,
    amount: int,
    currency: str,
    merchant_data: dict[str, object] | None = None,
) -> None:
    """Handle an issuing_authorization.request webhook.

    NOTE: The real-time authorization path should ideally be handled
    synchronously in the webhook endpoint for fastest response (<2s).
    This task exists as a fallback or for post-authorization processing.
    """
    from polar.integrations.stripe.service import stripe as stripe_service

    from .service import issuing_service

    async with AsyncSessionMaker() as session:
        decision = await issuing_service.evaluate_authorization(
            session,
            stripe_card_id=stripe_card_id,
            amount=amount,
            currency=currency,
            merchant_data=merchant_data,
        )

        if decision.approved:
            await stripe_service.approve_authorization(
                stripe_authorization_id,
                stripe_account_id=stripe_account_id,
                amount=decision.amount,
            )
            log.info(
                "issuing.authorization.approved",
                authorization_id=stripe_authorization_id,
                amount=amount,
            )
        else:
            await stripe_service.decline_authorization(
                stripe_authorization_id,
                stripe_account_id=stripe_account_id,
            )
            log.info(
                "issuing.authorization.declined",
                authorization_id=stripe_authorization_id,
                reason=decision.reason,
            )


@actor(
    actor_name="issuing.handle_card_webhook",
    priority=TaskPriority.DEFAULT,
)
async def handle_card_webhook(
    stripe_card_id: str,
    stripe_account_id: str,
) -> None:
    """Handle issuing_card.created / issuing_card.updated webhooks."""
    from .service import issuing_service

    async with AsyncSessionMaker() as session:
        await issuing_service.handle_card_updated(
            session,
            stripe_card_id=stripe_card_id,
            stripe_account_id=stripe_account_id,
        )


@actor(
    actor_name="issuing.handle_cardholder_webhook",
    priority=TaskPriority.DEFAULT,
)
async def handle_cardholder_webhook(
    stripe_cardholder_id: str,
    stripe_account_id: str,
) -> None:
    """Handle issuing_cardholder.created / issuing_cardholder.updated webhooks."""
    from .service import issuing_service

    async with AsyncSessionMaker() as session:
        await issuing_service.handle_cardholder_updated(
            session,
            stripe_cardholder_id=stripe_cardholder_id,
            stripe_account_id=stripe_account_id,
        )


@actor(
    actor_name="issuing.handle_transaction_webhook",
    priority=TaskPriority.DEFAULT,
)
async def handle_transaction_webhook(
    stripe_transaction_id: str,
    stripe_card_id: str,
    stripe_account_id: str,
    amount: int,
    currency: str,
) -> None:
    """Handle issuing_transaction.created / updated webhooks.

    Records the card spend in the local ledger and triggers
    a targeted fund state recalculation.
    """
    from .repository import IssuedCardRepository

    async with AsyncSessionMaker() as session:
        card_repo = IssuedCardRepository(session)
        card = await card_repo.get_by_stripe_id(stripe_card_id)
        if card is None:
            log.warning(
                "issuing.transaction.card_not_found",
                stripe_card_id=stripe_card_id,
            )
            return

        log.info(
            "issuing.transaction.recorded",
            stripe_transaction_id=stripe_transaction_id,
            card_id=str(card.id),
            amount=amount,
        )
