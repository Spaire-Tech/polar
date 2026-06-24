from uuid import UUID

from polar.worker import AsyncSessionMaker, TaskPriority, actor


@actor(actor_name="email_subscriber.subscribe_from_order", priority=TaskPriority.LOW)
async def subscribe_from_order(
    organization_id: UUID,
    email: str,
    name: str | None,
    customer_id: UUID | None,
    subscription_id: str | None = None,
    product_id: str | None = None,
) -> None:
    from .service import email_subscriber as email_subscriber_service

    async with AsyncSessionMaker() as session:
        subscriber = await email_subscriber_service.subscribe_from_purchase(
            session,
            organization_id=organization_id,
            email=email,
            name=name,
            customer_id=customer_id,
        )

        # A new subscription / free trial just started — fire the
        # "Subscription started" (on_subscription_created) automations for
        # this subscriber. Gated on subscription_id so it only runs for the
        # first (subscription_create) order: one-time purchases and monthly
        # renewal cycles don't pass it, so they never re-trigger a welcome.
        if subscription_id is not None:
            from polar.email_sequence.service import (
                email_sequence as sequence_service,
            )
            from polar.models.email_sequence import EmailSequenceTriggerType

            await sequence_service.enroll_for_trigger(
                session,
                organization_id,
                EmailSequenceTriggerType.on_subscription_created,
                subscriber.id,
                trigger_filter=(
                    {"product_id": product_id} if product_id else None
                ),
            )
