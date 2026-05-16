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
            await _apply_broadcast_event(
                session, broadcast_send, event_type, now, event_data
            )
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
    event_data: dict[str, Any] | None = None,
) -> None:
    if event_type == "email.delivered":
        # Don't downgrade an already opened/clicked row — Resend can emit
        # events out of order and we don't want a late `delivered` to hide
        # the engagement bucket from status-based reporting.
        if send.status in (
            EmailBroadcastSendStatus.pending,
            EmailBroadcastSendStatus.sent,
        ):
            send.status = EmailBroadcastSendStatus.delivered

    elif event_type == "email.opened":
        send.open_count += 1
        if send.opened_at is None:
            send.opened_at = now
        # Promote to `opened` from any pre-engagement state. Resend
        # sometimes delivers `email.opened` before `email.delivered`, and
        # if the send-batch transaction hasn't committed yet we may still
        # see `pending`. Don't overwrite `clicked` (a stronger signal) or
        # terminal states.
        if send.status in (
            EmailBroadcastSendStatus.pending,
            EmailBroadcastSendStatus.sent,
            EmailBroadcastSendStatus.delivered,
        ):
            send.status = EmailBroadcastSendStatus.opened
        ua = _extract_user_agent(event_data)
        if ua:
            send.last_user_agent = ua[:500]

    elif event_type == "email.clicked":
        send.click_count += 1
        if send.clicked_at is None:
            send.clicked_at = now
        if send.opened_at is None:
            send.opened_at = now
            send.open_count += 1
        # Click is the strongest engagement signal — always promote
        # unless we're in a terminal failure state.
        if send.status not in (
            EmailBroadcastSendStatus.bounced,
            EmailBroadcastSendStatus.failed,
        ):
            send.status = EmailBroadcastSendStatus.clicked
        ua = _extract_user_agent(event_data)
        if ua:
            send.last_user_agent = ua[:500]
        url = _extract_click_url(event_data)
        if url:
            # Append to clicked_links so we can aggregate top URLs later.
            existing = list(send.clicked_links or [])
            existing.append({"url": url, "at": now.isoformat()})
            send.clicked_links = existing

    elif event_type == "email.bounced":
        send.bounced_at = now
        # Preserve engagement status if the recipient already opened/clicked
        # before the bounce landed — otherwise we'd silently erase real
        # opens from analytics.
        if send.status not in (
            EmailBroadcastSendStatus.opened,
            EmailBroadcastSendStatus.clicked,
        ):
            send.status = EmailBroadcastSendStatus.bounced
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
        # Don't overwrite a row that's already opened/clicked.
        if send.status in (
            EmailSequenceStepSendStatus.pending,
            EmailSequenceStepSendStatus.sent,
        ):
            send.status = EmailSequenceStepSendStatus.delivered

    elif event_type == "email.opened":
        send.open_count += 1
        if send.opened_at is None:
            send.opened_at = now
        # Allow `pending` → `opened` for out-of-order webhook delivery.
        if send.status in (
            EmailSequenceStepSendStatus.pending,
            EmailSequenceStepSendStatus.sent,
            EmailSequenceStepSendStatus.delivered,
        ):
            send.status = EmailSequenceStepSendStatus.opened

    elif event_type == "email.clicked":
        send.click_count += 1
        if send.clicked_at is None:
            send.clicked_at = now
        if send.opened_at is None:
            send.opened_at = now
            send.open_count += 1
        if send.status not in (
            EmailSequenceStepSendStatus.bounced,
            EmailSequenceStepSendStatus.failed,
        ):
            send.status = EmailSequenceStepSendStatus.clicked

    elif event_type == "email.bounced":
        send.bounced_at = now
        if send.status not in (
            EmailSequenceStepSendStatus.opened,
            EmailSequenceStepSendStatus.clicked,
        ):
            send.status = EmailSequenceStepSendStatus.bounced
        await session.execute(_update_subscriber_on_bounce(session, send.subscriber_id))

    elif event_type == "email.complained":
        send.unsubscribed_at = now
        await session.execute(_update_subscriber_on_complaint(session, send.subscriber_id, now))


def _extract_click_url(event_data: dict[str, Any] | None) -> str | None:
    """Resend's email.clicked payload places the URL under data.click.link."""
    if not event_data:
        return None
    click = event_data.get("click") or {}
    link = click.get("link") or event_data.get("link")
    if isinstance(link, str) and link:
        return link
    return None


def _extract_user_agent(event_data: dict[str, Any] | None) -> str | None:
    """Pull a User-Agent string from the typical Resend event shapes."""
    if not event_data:
        return None
    for path in (
        ("click", "userAgent"),
        ("open", "userAgent"),
        ("userAgent",),
    ):
        cur: Any = event_data
        for key in path:
            if not isinstance(cur, dict):
                cur = None
                break
            cur = cur.get(key)
        if isinstance(cur, str) and cur:
            return cur
    return None
