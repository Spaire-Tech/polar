from typing import Any

import structlog
from sqlalchemy import select, update

from polar.kit.utils import utc_now
from polar.models.email_broadcast_send import EmailBroadcastSend, EmailBroadcastSendStatus
from polar.models.email_subscriber import EmailSubscriber, EmailSubscriberStatus
from polar.worker import AsyncSessionMaker, TaskPriority, actor

log = structlog.get_logger()


@actor(actor_name="resend.webhook.process_event", priority=TaskPriority.HIGH)
async def process_resend_event(
    event_type: str, email_id: str, event_data: dict[str, Any]
) -> None:
    """Process a Resend webhook event to update broadcast send tracking."""
    async with AsyncSessionMaker() as session:
        # Find the broadcast send record by resend_email_id
        statement = select(EmailBroadcastSend).where(
            EmailBroadcastSend.resend_email_id == email_id,
            EmailBroadcastSend.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        send = result.scalar_one_or_none()

        if send is None:
            log.debug(
                "resend.webhook.send_not_found",
                email_id=email_id,
                event_type=event_type,
            )
            return

        now = utc_now()

        if event_type == "email.delivered":
            if send.status in (
                EmailBroadcastSendStatus.pending,
                EmailBroadcastSendStatus.sent,
            ):
                send.status = EmailBroadcastSendStatus.delivered

        elif event_type == "email.opened":
            send.open_count += 1
            if send.opened_at is None:
                send.opened_at = now
            # Upgrade status if not already clicked
            if send.status in (
                EmailBroadcastSendStatus.sent,
                EmailBroadcastSendStatus.delivered,
            ):
                send.status = EmailBroadcastSendStatus.opened

        elif event_type == "email.clicked":
            send.click_count += 1
            if send.clicked_at is None:
                send.clicked_at = now
            if send.opened_at is None:
                send.opened_at = now
                send.open_count += 1
            send.status = EmailBroadcastSendStatus.clicked

        elif event_type == "email.bounced":
            send.status = EmailBroadcastSendStatus.bounced
            send.bounced_at = now

            # Mark subscriber as invalid on bounce
            subscriber_stmt = (
                update(EmailSubscriber)
                .where(EmailSubscriber.id == send.subscriber_id)
                .values(status=EmailSubscriberStatus.invalid)
            )
            await session.execute(subscriber_stmt)

        elif event_type == "email.complained":
            send.unsubscribed_at = now

            # Auto-unsubscribe on spam complaint
            subscriber_stmt = (
                update(EmailSubscriber)
                .where(EmailSubscriber.id == send.subscriber_id)
                .values(
                    status=EmailSubscriberStatus.unsubscribed,
                    unsubscribed_at=now,
                )
            )
            await session.execute(subscriber_stmt)

        log.info(
            "resend.webhook.processed",
            email_id=email_id,
            event_type=event_type,
            send_id=str(send.id),
            new_status=send.status,
        )
