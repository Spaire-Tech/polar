from uuid import UUID

from polar.worker import AsyncSessionMaker, TaskPriority, actor


@actor(actor_name="email_subscriber.subscribe_from_order", priority=TaskPriority.LOW)
async def subscribe_from_order(
    organization_id: UUID,
    email: str,
    name: str | None,
    customer_id: UUID | None,
) -> None:
    from .service import email_subscriber as email_subscriber_service

    async with AsyncSessionMaker() as session:
        await email_subscriber_service.subscribe_from_purchase(
            session,
            organization_id=organization_id,
            email=email,
            name=name,
            customer_id=customer_id,
        )
