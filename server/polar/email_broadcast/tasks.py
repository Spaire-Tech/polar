from uuid import UUID, uuid4

import structlog
from sqlalchemy import select

from polar.email.react import render_email_template
from polar.email.schemas import MarketingEmail, MarketingEmailProps
from polar.email.sender import email_sender
from polar.kit.utils import utc_now
from polar.models.email_broadcast import EmailBroadcast, EmailBroadcastStatus
from polar.models.email_broadcast_ab_test import EmailBroadcastABTest
from polar.models.email_broadcast_send import (
    EmailBroadcastSend,
    EmailBroadcastSendStatus,
)
from polar.models.email_subscriber import EmailSubscriber
from polar.models.organization import Organization
from polar.quotas.definitions import QuotaKey
from polar.quotas.exceptions import QuotaExceededError
from polar.quotas.producers import emit_email_sent, enforce
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

log = structlog.get_logger()


def _render_broadcast_html(
    broadcast: EmailBroadcast,
    organization: Organization | None,
    *,
    unsubscribe_url: str,
) -> str:
    """Wrap the broadcast's content in the unified marketing email template."""
    return render_email_template(
        MarketingEmail(
            props=MarketingEmailProps(
                organization_name=organization.name
                if organization
                else broadcast.sender_name,
                organization_logo_url=organization.avatar_url
                if organization
                else None,
                organization_website=organization.website if organization else None,
                html_content=broadcast.content_html or "<p>No content</p>",
                preview_text=broadcast.preview_text,
                unsubscribe_url=unsubscribe_url,
            )
        )
    )


async def send_broadcast_email(
    broadcast: EmailBroadcast,
    organization: Organization | None,
    *,
    to_email: str,
    unsubscribe_url: str,
    extra_subject_prefix: str = "",
    subject_override: str | None = None,
) -> str | None:
    """Render and send a single broadcast email. Returns the Resend email id."""
    wrapped_html = _render_broadcast_html(
        broadcast, organization, unsubscribe_url=unsubscribe_url
    )
    base_subject = subject_override if subject_override is not None else broadcast.subject
    return await email_sender.send(
        to_email_addr=to_email,
        subject=f"{extra_subject_prefix}{base_subject}",
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


@actor(actor_name="email_broadcast.send_emails", priority=TaskPriority.MEDIUM)
async def send_emails(
    broadcast_id: UUID, variant_filter: str | None = None
) -> None:
    """Send pending emails for a broadcast.

    `variant_filter` controls what gets released this pass:
      - None: every pending row (default; non-A/B sends).
      - "ab_test_only": only rows tagged with variant 'a' or 'b' (the
        initial test slice — the remainder is held until the cron picks
        a winner).
      - "remainder": only rows with a variant set by the winner-picker
        (i.e. excludes the test slice that already went out).
    """
    async with AsyncSessionMaker() as session:
        broadcast = await session.get(EmailBroadcast, broadcast_id)
        if broadcast is None or broadcast.status != EmailBroadcastStatus.sending:
            return

        organization = await session.get(Organization, broadcast.organization_id)
        if organization is None:
            # Should never happen — broadcasts have FK to org — but bail
            # cleanly rather than crash the actor.
            log.error(
                "email_broadcast.organization_missing",
                broadcast_id=str(broadcast_id),
                organization_id=str(broadcast.organization_id),
            )
            return

        ab_test: EmailBroadcastABTest | None = None
        ab_stmt = select(EmailBroadcastABTest).where(
            EmailBroadcastABTest.broadcast_id == broadcast_id,
            EmailBroadcastABTest.deleted_at.is_(None),
        )
        ab_test = (await session.execute(ab_stmt)).scalar_one_or_none()

        statement = select(EmailBroadcastSend).where(
            EmailBroadcastSend.broadcast_id == broadcast_id,
            EmailBroadcastSend.status == EmailBroadcastSendStatus.pending,
        )
        if variant_filter == "ab_test_only":
            statement = statement.where(EmailBroadcastSend.variant.in_(["a", "b"]))
        elif variant_filter == "remainder":
            # The remainder gets sent the winning variant's subject. Skip
            # rows that don't have a variant yet (winner not picked) and
            # rows already handled in the initial test slice (status != pending).
            statement = statement.where(EmailBroadcastSend.variant.is_not(None))
        result = await session.execute(statement)
        sends = result.scalars().all()

        quota_blocked = False
        for send in sends:
            subscriber = await session.get(EmailSubscriber, send.subscriber_id)
            if subscriber is None:
                send.status = EmailBroadcastSendStatus.failed
                continue

            # Skip the rest of the batch once we hit the quota — no point
            # paying Resend to mark sends as failed afterward.
            if quota_blocked:
                send.status = EmailBroadcastSendStatus.failed
                continue

            # Per-recipient quota check. Skips the send (marks failed) if
            # this would push the org past its monthly email cap.
            try:
                await enforce(
                    session,
                    organization,
                    QuotaKey.email_sends_monthly,
                    requested_storage_units=1,
                )
            except QuotaExceededError:
                log.info(
                    "email_broadcast.send_quota_exceeded",
                    broadcast_id=str(broadcast_id),
                    organization_id=str(organization.id),
                )
                send.status = EmailBroadcastSendStatus.failed
                quota_blocked = True
                continue

            subject_override: str | None = None
            if ab_test is not None and send.variant == "b":
                subject_override = ab_test.subject_b

            try:
                from polar.email_subscriber.unsubscribe_token import (
                    build_unsubscribe_url,
                )

                unsubscribe_url = build_unsubscribe_url(send.subscriber_id)
                resend_email_id = await send_broadcast_email(
                    broadcast,
                    organization,
                    to_email=subscriber.email,
                    unsubscribe_url=unsubscribe_url,
                    subject_override=subject_override,
                )
                send.status = EmailBroadcastSendStatus.sent
                send.sent_at = utc_now()
                if resend_email_id:
                    send.resend_email_id = resend_email_id
                emit_email_sent(
                    session, organization_id=organization.id, count=1
                )
            except Exception:
                log.exception(
                    "email_broadcast.send_failed",
                    broadcast_id=str(broadcast_id),
                    subscriber_id=str(send.subscriber_id),
                )
                send.status = EmailBroadcastSendStatus.failed

        # Only mark the broadcast finished when there's nothing left pending.
        # During an A/B test the remainder stays pending until the cron job
        # releases it.
        remaining_stmt = select(EmailBroadcastSend.id).where(
            EmailBroadcastSend.broadcast_id == broadcast_id,
            EmailBroadcastSend.status == EmailBroadcastSendStatus.pending,
            EmailBroadcastSend.deleted_at.is_(None),
        )
        remaining = (await session.execute(remaining_stmt)).first()
        if remaining is None:
            broadcast.status = EmailBroadcastStatus.sent
            broadcast.sent_at = utc_now()


@actor(actor_name="email_broadcast.send_test", priority=TaskPriority.MEDIUM)
async def send_test_broadcast(broadcast_id: UUID, to_email: str) -> None:
    """Render and deliver a single test send of a broadcast.

    Wired from `EmailBroadcastService.send_test`. Runs in the worker so the
    API request returns immediately and we get Dramatiq retries on transient
    Resend failures.
    """
    from polar.email_subscriber.unsubscribe_token import (
        build_test_unsubscribe_url,
    )

    async with AsyncSessionMaker() as session:
        broadcast = await session.get(EmailBroadcast, broadcast_id)
        if broadcast is None:
            return
        organization = await session.get(Organization, broadcast.organization_id)

        try:
            await send_broadcast_email(
                broadcast,
                organization,
                to_email=to_email,
                unsubscribe_url=build_test_unsubscribe_url(),
                extra_subject_prefix="[TEST] ",
            )
        except Exception:
            log.exception(
                "email_broadcast.send_test_failed",
                broadcast_id=str(broadcast_id),
                to_email=to_email,
            )
            raise


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


# Re-exported for callers that just need a one-off id.
def _new_test_token() -> str:
    return uuid4().hex


@actor(
    actor_name="email_broadcast.process_ab_winners",
    cron_trigger=CronTrigger(minute="*"),
    priority=TaskPriority.MEDIUM,
)
async def process_ab_winners() -> None:
    """Find A/B tests whose decide_after window has elapsed and pick the winner."""
    async with AsyncSessionMaker() as session:
        from .repository import EmailBroadcastABTestRepository

        repo = EmailBroadcastABTestRepository.from_session(session)
        due = await repo.get_due_for_winner(utc_now())

    for ab_test in due:
        enqueue_job(
            "email_broadcast.pick_ab_winner",
            ab_test_id=ab_test.id,
        )


# Minimum opens/clicks per variant before we'll commit to a winner.
# 30 events per arm is the rule-of-thumb floor for ~95% CI on a typical
# 5-percentage-point open-rate diff; anything less and the rate signal is
# essentially noise. Audit issue #4 / fix-list item: previously the cron
# committed a winner the moment `decide_after_minutes` elapsed regardless
# of how many opens had landed (zero-data tests defaulted to A).
N_MIN_OPENS_PER_VARIANT = 30


@actor(actor_name="email_broadcast.pick_ab_winner", priority=TaskPriority.MEDIUM)
async def pick_ab_winner(ab_test_id: UUID) -> None:
    """Compute which variant won and release the remainder of the audience.

    Sample-size guard:
      - Each arm must have at least `N_MIN_OPENS_PER_VARIANT` events of the
        winner-metric (opens for open_rate, clicks for click_rate). If
        either arm hasn't crossed the floor yet, leave winner_picked_at
        unset and let the cron re-evaluate next minute.
      - We give up waiting after 2× decide_after_minutes — that's a full
        extra window past the original schedule. At that point we force a
        pick using whatever we have, logging
        `ab_test.forced_pick_insufficient_data` so it surfaces in obs.

    Tie-break:
      - On a measurable difference, the higher rate wins.
      - On a true tie within the same window, defer once (return without
        committing). After 2× decide_after_minutes elapsed and still tied,
        award variant A and log `ab_test.tie_break_default_a` so we can
        audit it later.
    """
    async with AsyncSessionMaker() as session:
        from .repository import EmailBroadcastABTestRepository

        repo = EmailBroadcastABTestRepository.from_session(session)
        ab_test = await session.get(EmailBroadcastABTest, ab_test_id)
        if ab_test is None or ab_test.winner_picked_at is not None:
            return

        # How long the test has been in flight. The cron filters by
        # `test_sent_at + decide_after_minutes <= now` so this is at least
        # one window. Past 2x we force a decision regardless of sample.
        decide_after = ab_test.decide_after_minutes or 0
        elapsed_minutes = (
            (utc_now() - ab_test.test_sent_at).total_seconds() / 60.0
            if ab_test.test_sent_at is not None
            else 0.0
        )
        max_wait_elapsed = elapsed_minutes >= 2 * decide_after

        analytics = await repo.variant_analytics(ab_test.broadcast_id)
        a = analytics.get("a", {})
        b = analytics.get("b", {})
        metric_key = (
            "click_rate"
            if ab_test.winner_metric == "click_rate"
            else "open_rate"
        )
        events_key = "clicked" if metric_key == "click_rate" else "opened"
        a_events = int(a.get(events_key, 0) or 0)
        b_events = int(b.get(events_key, 0) or 0)

        insufficient = (
            a_events < N_MIN_OPENS_PER_VARIANT
            or b_events < N_MIN_OPENS_PER_VARIANT
        )
        if insufficient and not max_wait_elapsed:
            log.info(
                "email_broadcast.ab_winner_deferred_insufficient_data",
                broadcast_id=str(ab_test.broadcast_id),
                metric=ab_test.winner_metric,
                a_events=a_events,
                b_events=b_events,
                min_required=N_MIN_OPENS_PER_VARIANT,
                elapsed_minutes=elapsed_minutes,
            )
            return
        if insufficient and max_wait_elapsed:
            log.warning(
                "email_broadcast.ab_winner_forced_pick_insufficient_data",
                broadcast_id=str(ab_test.broadcast_id),
                metric=ab_test.winner_metric,
                a_events=a_events,
                b_events=b_events,
                min_required=N_MIN_OPENS_PER_VARIANT,
                elapsed_minutes=elapsed_minutes,
            )

        a_rate = float(a.get(metric_key, 0.0) or 0.0)
        b_rate = float(b.get(metric_key, 0.0) or 0.0)
        # Tied within 0.05 percentage points — treat as a true tie and
        # either defer (first time) or fall back to variant A. Authors who
        # care can pick a tighter threshold by tuning N_MIN.
        is_tie = abs(a_rate - b_rate) < 0.05
        tie_break_default = False
        if is_tie and not max_wait_elapsed:
            log.info(
                "email_broadcast.ab_winner_deferred_tie",
                broadcast_id=str(ab_test.broadcast_id),
                metric=ab_test.winner_metric,
                a_rate=a_rate,
                b_rate=b_rate,
                elapsed_minutes=elapsed_minutes,
            )
            return
        if is_tie and max_wait_elapsed:
            tie_break_default = True
            winner = "a"
        else:
            winner = "b" if b_rate > a_rate else "a"

        ab_test.winner_variant = winner
        ab_test.winner_picked_at = utc_now()

        # Backfill the remainder rows so the worker knows which subject to use.
        await repo.assign_remainder_variant(ab_test.broadcast_id, winner)

        if tie_break_default:
            log.warning(
                "email_broadcast.ab_winner_tie_break_default_a",
                broadcast_id=str(ab_test.broadcast_id),
                metric=ab_test.winner_metric,
                a_rate=a_rate,
                b_rate=b_rate,
            )
        log.info(
            "email_broadcast.ab_winner_picked",
            broadcast_id=str(ab_test.broadcast_id),
            winner=winner,
            metric=ab_test.winner_metric,
            a_rate=a_rate,
            b_rate=b_rate,
            a_events=a_events,
            b_events=b_events,
            tie_break_default_a=tie_break_default,
        )

        # Release the remainder. The send worker will only pick up rows that
        # are still pending and now have a non-null variant.
        enqueue_job(
            "email_broadcast.send_emails",
            broadcast_id=ab_test.broadcast_id,
            variant_filter="remainder",
        )
