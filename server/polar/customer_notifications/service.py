"""Customer notification service.

`send_to_customer` is the one entry point — it inserts a customer_notifications
row, publishes an SSE event on the customer's channel (for the bell badge to
update live), and enqueues an email if the customer's prefs allow it AND the
notification type is in the email allowlist."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from polar.email.sender import enqueue_email
from polar.eventstream.service import publish as publish_event
from polar.models.customer import Customer
from polar.models.customer_notification import CustomerNotification
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .notification_types import EMAIL_TYPES, render
from .repository import (
    CustomerNotificationPreferencesRepository,
    CustomerNotificationRepository,
)


class CustomerNotificationService:
    async def send_to_customer(
        self,
        session: AsyncSession,
        *,
        customer_id: UUID,
        notification_type: str,
        payload: dict,
    ) -> CustomerNotification:
        """Insert a notification row + publish SSE + queue email.

        Returns the inserted row. Email is enqueued via dramatiq so the
        request thread isn't blocked on render."""
        repo = CustomerNotificationRepository.from_session(session)
        notif = CustomerNotification(
            customer_id=customer_id,
            type=notification_type,
            payload=payload,
        )
        await repo.create(notif, flush=True)

        # Live bell badge — fire and forget. The receiver simply
        # increments its unread count, then refetches the list when
        # the dropdown is opened.
        try:
            await publish_event(
                key="customer_notification.created",
                payload={
                    "notification_id": str(notif.id),
                    "type": notification_type,
                },
                customer_id=customer_id,
            )
        except Exception:
            # SSE is best-effort; don't break the write path.
            pass

        # Email channel — gated by per-customer prefs + the type allowlist.
        if notification_type in EMAIL_TYPES:
            prefs_repo = CustomerNotificationPreferencesRepository.from_session(
                session
            )
            if await prefs_repo.email_enabled(customer_id):
                enqueue_job(
                    "customer_notification.send_email",
                    notification_id=notif.id,
                )

        return notif

    async def send_to_customers(
        self,
        session: AsyncSession,
        *,
        customer_ids: Sequence[UUID],
        notification_type: str,
        payload: dict,
    ) -> None:
        for cid in customer_ids:
            await self.send_to_customer(
                session,
                customer_id=cid,
                notification_type=notification_type,
                payload=payload,
            )

    async def list_for_customer(
        self,
        session: AsyncSession,
        *,
        customer_id: UUID,
        limit: int = 50,
    ) -> list[CustomerNotification]:
        repo = CustomerNotificationRepository.from_session(session)
        return list(await repo.list_for_customer(customer_id, limit=limit))

    async def unread_count(
        self, session: AsyncSession, *, customer_id: UUID
    ) -> int:
        repo = CustomerNotificationRepository.from_session(session)
        return await repo.unread_count(customer_id)

    async def mark_read(
        self,
        session: AsyncSession,
        *,
        customer_id: UUID,
        notification_id: UUID,
    ) -> None:
        repo = CustomerNotificationRepository.from_session(session)
        await repo.mark_read(customer_id, notification_id)

    async def mark_all_read(
        self,
        session: AsyncSession,
        *,
        customer_id: UUID,
    ) -> None:
        repo = CustomerNotificationRepository.from_session(session)
        await repo.mark_all_read(customer_id)


customer_notifications = CustomerNotificationService()

# Re-export so tasks can import without reaching into notification_types directly
_render = render

# Quiet ruff: Customer is type-only in this file but is referenced in callers.
_ = Customer
# enqueue_email is re-exported for the dramatiq actor in tasks.py
__all__ = [
    "CustomerNotificationService",
    "customer_notifications",
    "enqueue_email",
]
