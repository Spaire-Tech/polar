from typing import Any

import structlog
from sqlalchemy import select, update

from polar.kit.utils import utc_now
from polar.models.email_broadcast_send import EmailBroadcastSend, EmailBroadcastSendStatus
from polar.models.email_sequence_step_send import EmailSequenceStepSend, EmailSequenceStepSendStatus
from polar.models.email_subscriber import EmailSubscriber, EmailSubscriberStatus
from polar.worker import AsyncSessionMaker, TaskPriority, actor

log = structlog.get_logger()


def _update_subscriber_on_bounce(session: Any, subscriber_id: Any) -> Any:
    return (
        update(EmailSubscriber)
        .where(EmailSubscriber.id == subscriber_id)
        .values(status=EmailSubscriberStatus.invalid)
    )


def _update_subscriber_on_complaint(session: Any, subscriber_id: Any, now: Any) -> Any:
    return (
        update(EmailSubscriber)
        .where(EmailSubscriber.id == subscriber_id)
        .values(status=EmailSubscriberStatus.unsubscribed, unsubscribed_at=now)
    )


@actor(actor_name="resend.webhook.process_event", priority=TaskPriority.HIGH)
async def process_resend_event(
    event_type: str, email_id: str, event_data: dict[str, Any]
) -> None:
    """Process a Resend webhook event to update send tracking for broadcasts and sequences."""
    async with AsyncSessionMaker() as session:
        now = utc_now()

        # ── Try broadcast send first ──────────────────────────────────────
        broadcast_stmt = select(EmailBroadcastSend).where(
            EmailBroadcastSend.resend_email_id == email_id,
            EmailBroadcastSend.deleted_at.is_(None),
        )
        result = await session.execute(broadcast_stmt)
        broadcast_send = result.scalar_one_or_none()

        if broadcast_send is not None:
            await _apply_broadcast_event(session, broadcast_send, event_type, now)
            log.info(
                "resend.webhook.processed",
                email_id=email_id,
                event_type=event_type,
                send_id=str(broadcast_send.id),
                kind="broadcast",
            )
            return

        # ── Try sequence step send ────────────────────────────────────────
        seq_stmt = select(EmailSequenceStepSend).where(
            EmailSequenceStepSend.resend_email_id == email_id,
            EmailSequenceStepSend.deleted_at.is_(None),
        )
        result = await session.execute(seq_stmt)
        seq_send = result.scalar_one_or_none()

        if seq_send is not None:
            await _apply_sequence_event(session, seq_send, event_type, now)
            log.info(
                "resend.webhook.processed",
                email_id=email_id,
                event_type=event_type,
                send_id=str(seq_send.id),
                kind="sequence",
            )
            return

        log.debug(
            "resend.webhook.send_not_found",
            email_id=email_id,
            event_type=event_type,
        )


async def _apply_broadcast_event(
    session: Any,
    send: EmailBroadcastSend,
    event_type: str,
    now: Any,
) -> None:
    if event_type == "email.delivered":
        if send.status in (EmailBroadcastSendStatus.pending, EmailBroadcastSendStatus.sent):
            send.status = EmailBroadcastSendStatus.delivered

    elif event_type == "email.opened":
        send.open_count += 1
        if send.opened_at is None:
            send.opened_at = now
        if send.status in (EmailBroadcastSendStatus.sent, EmailBroadcastSendStatus.delivered):
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
        await session.execute(_update_subscriber_on_bounce(session, send.subscriber_id))

    elif event_type == "email.complained":
        send.unsubscribed_at = now
        await session.execute(_update_subscriber_on_complaint(session, send.subscriber_id, now))


async def _apply_sequence_event(
    session: Any,
    send: EmailSequenceStepSend,
    event_type: str,
    now: Any,
) -> None:
    if event_type == "email.delivered":
        if send.status in (EmailSequenceStepSendStatus.pending, EmailSequenceStepSendStatus.sent):
            send.status = EmailSequenceStepSendStatus.delivered

    elif event_type == "email.opened":
        send.open_count += 1
        if send.opened_at is None:
            send.opened_at = now
        if send.status in (EmailSequenceStepSendStatus.sent, EmailSequenceStepSendStatus.delivered):
            send.status = EmailSequenceStepSendStatus.opened

    elif event_type == "email.clicked":
        send.click_count += 1
        if send.clicked_at is None:
            send.clicked_at = now
        if send.opened_at is None:
            send.opened_at = now
            send.open_count += 1
        send.status = EmailSequenceStepSendStatus.clicked

    elif event_type == "email.bounced":
        send.status = EmailSequenceStepSendStatus.bounced
        send.bounced_at = now
        await session.execute(_update_subscriber_on_bounce(session, send.subscriber_id))

    elif event_type == "email.complained":
        send.unsubscribed_at = now
        await session.execute(_update_subscriber_on_complaint(session, send.subscriber_id, now))
