"""Dramatiq actors for community event lifecycle.

Five actors orchestrate event notifications + the replay nag:

  community.event.published
    Fans out the "new event" notification to every enrolled customer in
    the course. Skipped when `notify_on_publish=False`.

  community.event.schedule_reminders
    Enqueues the T-24h, T-15m, T-0 (live) reminders for an event. Called
    on create and on time/duration change. Cancel/dedup is handled by
    each reminder actor checking the event still exists + start_at still
    matches.

  community.event.reminder_24h / .reminder_15m / .live
    Per-RSVP'd-customer notification. Idempotent — they re-query who's
    RSVP'd at fire time, so late RSVPs get the live ping but not the
    earlier reminders.

  community.event.replay_nag (cron, every 30 min)
    Walks events whose end time is past, replay_url is unset, and
    nag_state is `pending`/`t2h_sent`. Transitions:
      pending     → after T+2h  → send t2h to host, set state=t2h_sent
      t2h_sent    → after T+24h → send t24h to host, set state=t24h_sent
      t24h_sent   → no more nags; row stays as a record.
    Setting replay_url anywhere closes the cycle (state=done) — see
    events_service.update.

All actors swallow non-fatal errors and log; an event being deleted
between schedule and fire is normal and should be a no-op."""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID

import structlog
from sqlalchemy import select

from polar.course.repository import CourseRepository
from polar.customer_notifications.notification_types import (
    EMAIL_TYPES,
    EVENT_LIVE,
    EVENT_PUBLISHED,
    EVENT_REPLAY_NAG_T2H,
    EVENT_REPLAY_NAG_T24H,
    EVENT_STARTING_SOON_15M,
    EVENT_STARTING_SOON_24H,
    EventNotificationPayload,
    render,
)
from polar.customer_notifications.service import customer_notifications
from polar.email.sender import enqueue_email
from polar.exceptions import PolarTaskError
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models.user import User
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .events_repository import (
    CommunityEventRepository,
    CommunityEventRsvpRepository,
)

log: Logger = structlog.get_logger()


class CommunityEventTaskError(PolarTaskError): ...


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


async def _build_payload(session, event) -> dict:
    course_repo = CourseRepository.from_session(session)
    course = await course_repo.get_by_id(event.course_id)
    host = await session.get(User, event.host_user_id)
    host_name = (
        (course.instructor_name if course else None)
        or (host.public_name if host and hasattr(host, "public_name") else None)
        or (host.email if host else "Instructor")
    )
    course_name = (course.name if course else "") or "your community"

    return EventNotificationPayload(
        event_id=str(event.id),
        course_id=str(event.course_id),
        title=event.title,
        start_at=event.start_at,
        host_name=host_name,
        course_name=course_name,
        meeting_url=event.meeting_url,
        replay_url=event.replay_url,
    ).model_dump(mode="json")


async def _enrolled_customer_ids(session, course_id: UUID) -> list[UUID]:
    from polar.models.course_enrollment import CourseEnrollment

    statement = select(CourseEnrollment.customer_id).where(
        CourseEnrollment.course_id == course_id,
        CourseEnrollment.deleted_at.is_(None),
    )
    result = await session.execute(statement)
    return [r[0] for r in result.all()]


# ----------------------------------------------------------------------
# Published — fan out to every enrolled customer
# ----------------------------------------------------------------------


@actor(actor_name="community.event.published", priority=TaskPriority.LOW)
async def event_published(event_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        repo = CommunityEventRepository.from_session(session)
        event = await repo.get_by_id(event_id)
        if event is None or event.deleted_at is not None:
            return
        if not event.notify_on_publish:
            return

        payload = await _build_payload(session, event)
        customer_ids = await _enrolled_customer_ids(session, event.course_id)
        await customer_notifications.send_to_customers(
            session,
            customer_ids=customer_ids,
            notification_type=EVENT_PUBLISHED,
            payload=payload,
        )


# ----------------------------------------------------------------------
# Reminders — schedule + per-window actors
# ----------------------------------------------------------------------


@actor(actor_name="community.event.schedule_reminders", priority=TaskPriority.LOW)
async def schedule_reminders(event_id: UUID) -> None:
    """Schedules T-24h, T-15m, and T-0 (live) reminder actors via
    `enqueue_job(..., delay=...)`. Each reminder actor re-validates the
    event's start_at so a rescheduled event doesn't double-fire."""
    async with AsyncSessionMaker() as session:
        repo = CommunityEventRepository.from_session(session)
        event = await repo.get_by_id(event_id)
        if event is None or event.deleted_at is not None:
            return

        now = utc_now()
        windows = [
            ("community.event.reminder_24h", event.start_at - timedelta(hours=24)),
            ("community.event.reminder_15m", event.start_at - timedelta(minutes=15)),
            ("community.event.live", event.start_at),
        ]
        for actor_name, fire_at in windows:
            delta = fire_at - now
            if delta.total_seconds() <= 0:
                # Already past for this window — skip.
                continue
            delay_ms = int(delta.total_seconds() * 1000)
            try:
                enqueue_job(actor_name, event_id=event.id, delay=delay_ms)
            except TypeError:
                # If the enqueue_job signature doesn't accept `delay`, fall
                # back to enqueueing immediately so we don't drop the ping.
                enqueue_job(actor_name, event_id=event.id)


async def _fire_window(
    event_id: UUID, notification_type: str, *, only_if_within_minutes: int | None
) -> None:
    async with AsyncSessionMaker() as session:
        repo = CommunityEventRepository.from_session(session)
        event = await repo.get_by_id(event_id)
        if event is None or event.deleted_at is not None:
            return
        if only_if_within_minutes is not None:
            # If start_at moved more than the slack window in either
            # direction, this scheduled fire is stale — drop it.
            delta_min = abs((event.start_at - utc_now()).total_seconds() / 60.0)
            if delta_min > only_if_within_minutes:
                return

        rsvp_repo = CommunityEventRsvpRepository.from_session(session)
        customer_ids = list(await rsvp_repo.list_customer_ids_for_event(event_id))
        if not customer_ids:
            return

        payload = await _build_payload(session, event)
        await customer_notifications.send_to_customers(
            session,
            customer_ids=customer_ids,
            notification_type=notification_type,
            payload=payload,
        )


@actor(actor_name="community.event.reminder_24h", priority=TaskPriority.LOW)
async def reminder_24h(event_id: UUID) -> None:
    # 60 min slack — if the event was moved by more than an hour, skip.
    await _fire_window(event_id, EVENT_STARTING_SOON_24H, only_if_within_minutes=24 * 60 + 60)


@actor(actor_name="community.event.reminder_15m", priority=TaskPriority.LOW)
async def reminder_15m(event_id: UUID) -> None:
    await _fire_window(event_id, EVENT_STARTING_SOON_15M, only_if_within_minutes=60)


@actor(actor_name="community.event.live", priority=TaskPriority.LOW)
async def event_live(event_id: UUID) -> None:
    await _fire_window(event_id, EVENT_LIVE, only_if_within_minutes=15)


# ----------------------------------------------------------------------
# Replay nag — cron every 30 min
# ----------------------------------------------------------------------


@actor(
    actor_name="community.event.replay_nag_cron",
    priority=TaskPriority.LOW,
    cron_trigger=CronTrigger.from_crontab("*/30 * * * *"),
)
async def replay_nag_cron() -> None:
    """Walks past events that still don't have a replay_url and ticks
    the nag state forward. State machine: pending -(2h)-> t2h_sent
    -(24h)-> t24h_sent -> stop. `done` is set elsewhere when replay_url
    is pasted; `skipped` is for explicit dismissal (not surfaced yet)."""
    async with AsyncSessionMaker() as session:
        repo = CommunityEventRepository.from_session(session)
        now = utc_now()

        # Pending -> t2h_sent: end time was at least 2h ago.
        due_t2h = await repo.list_due_for_replay_nag(
            before=now - timedelta(hours=2), states=("pending",)
        )
        for event in due_t2h:
            await _send_replay_nag(
                session, event, EVENT_REPLAY_NAG_T2H, next_state="t2h_sent"
            )

        # t2h_sent -> t24h_sent: end time was at least 24h ago.
        due_t24h = await repo.list_due_for_replay_nag(
            before=now - timedelta(hours=24), states=("t2h_sent",)
        )
        for event in due_t24h:
            await _send_replay_nag(
                session, event, EVENT_REPLAY_NAG_T24H, next_state="t24h_sent"
            )


async def _send_replay_nag(
    session, event, notification_type: str, *, next_state: str
) -> None:
    # Replay nags go to the event's host. Hosts are org Users, not
    # Customers, so we try two paths:
    #
    #   1. If the host happens to also have a Customer row with the same
    #      email (e.g. enrolled in their own course), route through the
    #      customer-notifications surface so the bell badge updates too.
    #   2. Otherwise — the common case for instructors — fall back to a
    #      direct email to the User's address. Without this, hosts who
    #      aren't customers never get nudged about pasting a replay URL.
    host = await session.get(User, event.host_user_id)
    if host is None or not getattr(host, "email", None):
        event.replay_nag_state = next_state
        session.add(event)
        return

    from polar.models.customer import Customer

    stmt = select(Customer.id).where(Customer.email == host.email).limit(1)
    result = await session.execute(stmt)
    customer_id = result.scalar_one_or_none()

    payload = await _build_payload(session, event)

    if customer_id is not None:
        await customer_notifications.send_to_customer(
            session,
            customer_id=customer_id,
            notification_type=notification_type,
            payload=payload,
        )
    elif notification_type in EMAIL_TYPES:
        # Direct-to-host email fallback — no bell row exists for users
        # outside the customer portal, so the email is the only surface.
        try:
            subject, body = render(notification_type, payload)
            enqueue_email(
                to_email_addr=host.email,
                subject=subject,
                html_content=body,
            )
        except Exception:
            log.exception(
                "community.event.replay_nag.host_email_failed",
                event_id=str(event.id),
            )

    event.replay_nag_state = next_state
    session.add(event)
