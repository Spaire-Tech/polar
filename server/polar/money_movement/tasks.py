"""Background tasks for money movement (outbound payments/transfers)."""

import structlog

from polar.exceptions import PolarError
from polar.logging import Logger
from polar.worker import AsyncSessionMaker, TaskPriority, actor

log: Logger = structlog.get_logger()


class MoneyMovementTaskError(PolarError):
    pass


@actor(
    actor_name="money_movement.handle_outbound_payment_webhook",
    priority=TaskPriority.DEFAULT,
)
async def handle_outbound_payment_webhook(
    stripe_outbound_payment_id: str,
    stripe_account_id: str,
) -> None:
    """Handle treasury.outbound_payment.* webhook events."""
    from .service import money_movement_service

    async with AsyncSessionMaker() as session:
        await money_movement_service.handle_outbound_payment_updated(
            session,
            stripe_outbound_payment_id=stripe_outbound_payment_id,
            stripe_account_id=stripe_account_id,
        )


@actor(
    actor_name="money_movement.handle_outbound_transfer_webhook",
    priority=TaskPriority.DEFAULT,
)
async def handle_outbound_transfer_webhook(
    stripe_outbound_transfer_id: str,
    stripe_account_id: str,
) -> None:
    """Handle treasury.outbound_transfer.* webhook events."""
    from .service import money_movement_service

    async with AsyncSessionMaker() as session:
        await money_movement_service.handle_outbound_transfer_updated(
            session,
            stripe_outbound_transfer_id=stripe_outbound_transfer_id,
            stripe_account_id=stripe_account_id,
        )
