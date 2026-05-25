"""Dramatiq actor for sending the email side of a customer notification.

The bell row + SSE happen synchronously in the service; the email is
deferred because rendering + SES is the slow part."""

from __future__ import annotations

from uuid import UUID

import structlog

from polar.email.sender import enqueue_email
from polar.models.customer import Customer
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .notification_types import render
from .repository import CustomerNotificationRepository

log = structlog.get_logger()


@actor(actor_name="customer_notification.send_email", priority=TaskPriority.LOW)
async def send_email(notification_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        repo = CustomerNotificationRepository.from_session(session)
        notif = await repo.get_by_id(notification_id)
        if notif is None:
            log.warning(
                "customer_notification.send_email.not_found",
                notification_id=notification_id,
            )
            return

        customer = await session.get(Customer, notif.customer_id)
        if customer is None or not customer.email:
            return

        subject, body = render(notif.type, notif.payload)
        enqueue_email(
            to_email_addr=customer.email,
            subject=subject,
            html_content=body,
        )
