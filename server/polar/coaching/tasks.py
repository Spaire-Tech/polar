"""Coaching reminder workers.

The pipeline:

  coaching.sweep_event_reminders       (cron-driven; not yet wired — see TODO)
    ↓ for each event in the 24h or 1h window
  coaching.send_event_reminder         (per event)
    ↓ for each enrolled customer
  email.send                           (existing infra)

We send simple inline-HTML messages directly via `enqueue_email` rather than
going through the React Email TSX pipeline. Adding proper TSX templates +
schemas + rebuilding the renderer binary is a follow-up; the wiring here is
correct, the rendering is just plain.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import structlog
from sqlalchemy import select

from polar.email.sender import enqueue_email
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models.coaching_event import CoachingEvent
from polar.models.course_enrollment import CourseEnrollment
from polar.models.customer import Customer
from polar.worker import AsyncSessionMaker, TaskPriority, actor, enqueue_job

from .repository import CoachingEventRepository

log: Logger = structlog.get_logger()


# ── Cron entry point ────────────────────────────────────────────────────────

@actor(
    actor_name="coaching.sweep_event_reminders",
    priority=TaskPriority.LOW,
)
async def sweep_event_reminders() -> None:
    """Find events whose start time falls inside one of the reminder windows
    and whose corresponding flag is still null. Fan out one
    `coaching.send_event_reminder` job per (event, kind) pair.

    TODO: wire this to a scheduler (every minute is plenty). The repository
    method already makes the work idempotent via the per-event flags, so
    re-running is safe.
    """
    now = utc_now()
    window_24h = (now + timedelta(hours=23, minutes=55), now + timedelta(hours=24, minutes=5))
    window_1h = (now + timedelta(minutes=55), now + timedelta(minutes=65))

    async with AsyncSessionMaker() as session:
        repo = CoachingEventRepository.from_session(session)
        statement = repo.get_pending_reminders_statement(
            threshold_24h_lower=window_24h[0],
            threshold_24h_upper=window_24h[1],
            threshold_1h_lower=window_1h[0],
            threshold_1h_upper=window_1h[1],
        )
        events = await repo.get_all(statement)

        for event in events:
            if (
                event.reminder_24h_sent_at is None
                and window_24h[0] <= event.starts_at <= window_24h[1]
            ):
                enqueue_job(
                    "coaching.send_event_reminder",
                    event_id=event.id,
                    kind="24h",
                )
            if (
                event.reminder_1h_sent_at is None
                and window_1h[0] <= event.starts_at <= window_1h[1]
            ):
                enqueue_job(
                    "coaching.send_event_reminder",
                    event_id=event.id,
                    kind="1h",
                )


# ── Per-event fan-out ───────────────────────────────────────────────────────

@actor(actor_name="coaching.send_event_reminder", priority=TaskPriority.LOW)
async def send_event_reminder(event_id: UUID, kind: str) -> None:
    if kind not in {"24h", "1h"}:
        log.warning("coaching.send_event_reminder.bad_kind", kind=kind)
        return

    async with AsyncSessionMaker() as session:
        repo = CoachingEventRepository.from_session(session)
        event = await repo.get_one_or_none(
            repo.get_base_statement().where(CoachingEvent.id == event_id)
        )
        if event is None or event.status != "scheduled":
            return

        # Mark the flag immediately so a retry doesn't double-send.
        flag = "reminder_24h_sent_at" if kind == "24h" else "reminder_1h_sent_at"
        if getattr(event, flag) is not None:
            return
        await repo.update(event, update_dict={flag: utc_now()})

        # Find every customer enrolled in this program. Coaching reuses
        # CourseEnrollment.
        enrollment_stmt = (
            select(Customer)
            .join(CourseEnrollment, CourseEnrollment.customer_id == Customer.id)
            .where(
                CourseEnrollment.course_id == event.course_id,
                CourseEnrollment.deleted_at.is_(None),
            )
        )
        result = await session.execute(enrollment_stmt)
        customers = result.scalars().unique().all()

        subject = _subject_for(event, kind)
        for customer in customers:
            if not customer.email:
                continue
            html = _render_reminder_html(event=event, kind=kind)
            try:
                enqueue_email(
                    to_email_addr=customer.email,
                    subject=subject,
                    html_content=html,
                )
            except Exception:  # never let one bad address kill the batch
                log.exception(
                    "coaching.send_event_reminder.enqueue_failed",
                    event_id=str(event.id),
                    customer_id=str(customer.id),
                )


# ── Lightweight HTML rendering ──────────────────────────────────────────────

def _subject_for(event: CoachingEvent, kind: str) -> str:
    if kind == "24h":
        return f"Tomorrow: {event.title}"
    return f"Starting in 1 hour: {event.title}"


def _render_reminder_html(*, event: CoachingEvent, kind: str) -> str:
    """Plain HTML reminder. Replace with a React Email template once the
    schema/renderer build is updated."""
    when = event.starts_at.astimezone(UTC).strftime("%a %b %-d, %H:%M UTC")
    join = (
        f'<p><a href="{event.meeting_url}" style="display:inline-block;'
        'padding:10px 16px;background:#2C6FE2;color:#fff;border-radius:8px;'
        f'text-decoration:none">Join the call</a></p>'
        if event.meeting_url
        else ""
    )
    headline = (
        "Your coaching call starts in 1 hour"
        if kind == "1h"
        else "Reminder: your coaching call is tomorrow"
    )
    return (
        '<div style="font-family:Inter,sans-serif;color:#0E2433;'
        'line-height:1.5;max-width:560px;padding:24px">'
        f"<h1 style=\"font-size:18px;margin:0 0 12px\">{headline}</h1>"
        f"<p style=\"margin:0 0 8px\"><strong>{event.title}</strong></p>"
        f"<p style=\"margin:0 0 16px;color:#566573\">{when} · "
        f"{event.duration_minutes} min</p>"
        f"{join}"
        "</div>"
    )
