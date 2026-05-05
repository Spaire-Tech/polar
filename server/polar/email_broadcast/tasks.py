from uuid import UUID

import structlog
from sqlalchemy import select

from polar.email.react import render_email_template
from polar.email.schemas import MarketingEmail, MarketingEmailProps
from polar.email.sender import email_sender
from polar.kit.utils import utc_now
from polar.models.email_broadcast import EmailBroadcast, EmailBroadcastStatus
from polar.models.email_broadcast_send import EmailBroadcastSend, EmailBroadcastSendStatus
from polar.models.email_subscriber import EmailSubscriber
from polar.models.organization import Organization
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor, enqueue_job

log = structlog.get_logger()


@actor(actor_name="email_broadcast.send_emails", priority=TaskPriority.MEDIUM)
async def send_emails(broadcast_id: UUID) -> None:
    """Send all pending emails for a broadcast."""
    async with AsyncSessionMaker() as session:
        # Load broadcast
        broadcast = await session.get(EmailBroadcast, broadcast_id)
        if broadcast is None or broadcast.status != EmailBroadcastStatus.sending:
            return

        # Load organization for branding
        organization = await session.get(Organization, broadcast.organization_id)

        # Get all pending sends
        statement = (
            select(EmailBroadcastSend)
            .where(
                EmailBroadcastSend.broadcast_id == broadcast_id,
                EmailBroadcastSend.status == EmailBroadcastSendStatus.pending,
            )
        )
        result = await session.execute(statement)
        sends = result.scalars().all()

        for send in sends:
            # Load subscriber
            subscriber = await session.get(EmailSubscriber, send.subscriber_id)
            if subscriber is None:
                send.status = EmailBroadcastSendStatus.failed
                continue

            try:
                # Build unsubscribe URL
                unsubscribe_url = f"https://space.spairehq.com/email/unsubscribe?sid={send.subscriber_id}"

                # Wrap content_html in the unified marketing email template
                wrapped_html = render_email_template(
                    MarketingEmail(
                        props=MarketingEmailProps(
                            organization_name=organization.name if organization else broadcast.sender_name,
                            organization_logo_url=organization.avatar_url if organization else None,
                            organization_website=organization.website if organization else None,
                            html_content=broadcast.content_html or "<p>No content</p>",
                            unsubscribe_url=unsubscribe_url,
                        )
                    )
                )

                # Send via Resend directly to capture email ID
                resend_email_id = await email_sender.send(
                    to_email_addr=subscriber.email,
                    subject=broadcast.subject,
                    html_content=wrapped_html,
                    from_name=broadcast.sender_name,
                    from_email_addr=broadcast.sender_email,
                    email_headers={
                        "List-Unsubscribe": f"<{unsubscribe_url}>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                    reply_to_name=broadcast.sender_name if broadcast.reply_to_email else None,
                    reply_to_email_addr=broadcast.reply_to_email,
                )

                send.status = EmailBroadcastSendStatus.sent
                send.sent_at = utc_now()
                if resend_email_id:
                    send.resend_email_id = resend_email_id
            except Exception:
                log.exception(
                    "email_broadcast.send_failed",
                    broadcast_id=str(broadcast_id),
                    subscriber_id=str(send.subscriber_id),
                )
                send.status = EmailBroadcastSendStatus.failed

        # Mark broadcast as sent
        broadcast.status = EmailBroadcastStatus.sent
        broadcast.sent_at = utc_now()


@actor(
    actor_name="email_broadcast.process_scheduled",
    cron_trigger=CronTrigger(minute="*"),
    priority=TaskPriority.MEDIUM,
)
async def process_scheduled_broadcasts() -> None:
    """Find scheduled broadcasts whose scheduled_at has passed and trigger sending."""
    async with AsyncSessionMaker() as session:
        now = utc_now()
        statement = select(EmailBroadcast).where(
            EmailBroadcast.status == EmailBroadcastStatus.scheduled,
            EmailBroadcast.scheduled_at <= now,
            EmailBroadcast.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        broadcasts = result.scalars().all()

    for broadcast in broadcasts:
        enqueue_job("email_broadcast.send_scheduled", broadcast_id=broadcast.id)


@actor(actor_name="email_broadcast.send_scheduled", priority=TaskPriority.MEDIUM)
async def send_scheduled_broadcast(broadcast_id: UUID) -> None:
    """Transition a scheduled broadcast to sending and dispatch its emails."""
    async with AsyncSessionMaker() as session:
        broadcast = await session.get(EmailBroadcast, broadcast_id)
        if broadcast is None or broadcast.status != EmailBroadcastStatus.scheduled:
            return

        from .service import email_broadcast as broadcast_service

        await broadcast_service.send(session, broadcast)
