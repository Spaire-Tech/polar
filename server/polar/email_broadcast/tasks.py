from uuid import UUID

from sqlalchemy import select

from polar.email.sender import enqueue_email
from polar.kit.utils import utc_now
from polar.models.email_broadcast import EmailBroadcast, EmailBroadcastStatus
from polar.models.email_broadcast_send import EmailBroadcastSend, EmailBroadcastSendStatus
from polar.models.email_subscriber import EmailSubscriber
from polar.worker import AsyncSessionMaker, TaskPriority, actor


@actor(actor_name="email_broadcast.send_emails", priority=TaskPriority.DEFAULT)
async def send_emails(broadcast_id: UUID) -> None:
    """Send all pending emails for a broadcast."""
    async with AsyncSessionMaker() as session:
        # Load broadcast
        broadcast = await session.get(EmailBroadcast, broadcast_id)
        if broadcast is None or broadcast.status != EmailBroadcastStatus.sending:
            return

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

                # Send via Resend (enqueue_email is sync)
                enqueue_email(
                    to_email_addr=subscriber.email,
                    subject=broadcast.subject,
                    html_content=broadcast.content_html or "<p>No content</p>",
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
            except Exception:
                send.status = EmailBroadcastSendStatus.failed

        # Mark broadcast as sent
        broadcast.status = EmailBroadcastStatus.sent
        broadcast.sent_at = utc_now()
