"""Background tasks for course broadcasts.

Publish fanout is two-tiered. The publish endpoint enqueues
`fanout_publish(broadcast_id)`, which is the parent task — it
enumerates enrollments and enqueues one `fanout_publish_one
(broadcast_id, enrollment_id)` per student. Each child task is
small, independently retryable, and only fires the event for one
subscriber.

Why split: the previous single-task design fanned out N students in
a for-loop. A crash at student 4000/5000 meant the parent retried
from 0, double-emailing the first 4000. With per-enrollment
subtasks, a transient failure retries only the one enrollment, so
re-runs can't mass-duplicate emails — the worst case is one
duplicate per retry per student.

Scheduled broadcasts: `publish_due_scheduled` is a 60s cron that
scans for rows past their scheduled_at, flips them to published,
and enqueues the same parent fanout task.
"""

from datetime import datetime, timezone
from uuid import UUID

from polar.course.repository import CourseEnrollmentRepository
from polar.course_broadcast.repository import BroadcastRepository
from polar.email_sequence.events import fire_event
from polar.email_subscriber.repository import EmailSubscriberRepository
from polar.exceptions import PolarTaskError
from polar.models.course import Course
from polar.models.course_enrollment import CourseEnrollment
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)


class CourseBroadcastTaskError(PolarTaskError): ...


@actor(
    actor_name="course_broadcast.fanout_publish",
    priority=TaskPriority.LOW,
)
async def fanout_publish(broadcast_id: UUID) -> None:
    """Parent task — enumerates enrollments and enqueues a child task
    per enrollment. Skips silently if the broadcast was unpublished
    (or its course soft-deleted) between publish and this task running.

    No emailing happens here. The child task does the actual fire_event
    so each enrollment is its own retry surface.
    """
    async with AsyncSessionMaker() as session:
        broadcast_repo = BroadcastRepository.from_session(session)
        broadcast = await broadcast_repo.get_by_id(broadcast_id)
        if broadcast is None or broadcast.published_at is None:
            return
        if not broadcast.notify_on_publish:
            return

        course = await session.get(Course, broadcast.course_id)
        if course is None or course.deleted_at is not None:
            return

        enrollment_repo = CourseEnrollmentRepository.from_session(session)
        enrollments = list(
            await enrollment_repo.get_all(
                enrollment_repo.get_by_course_statement(course.id)
            )
        )
        for enrollment in enrollments:
            enqueue_job(
                "course_broadcast.fanout_publish_one",
                broadcast_id=broadcast.id,
                enrollment_id=enrollment.id,
            )


@actor(
    actor_name="course_broadcast.fanout_publish_one",
    priority=TaskPriority.LOW,
)
async def fanout_publish_one(
    broadcast_id: UUID, enrollment_id: UUID
) -> None:
    """Per-enrollment child task — resolve the EmailSubscriber, fire
    the event. Re-checks the broadcast is still published + the course
    isn't soft-deleted so a parent enqueue that races an unpublish
    doesn't keep emailing.
    """
    async with AsyncSessionMaker() as session:
        broadcast_repo = BroadcastRepository.from_session(session)
        broadcast = await broadcast_repo.get_by_id(broadcast_id)
        if broadcast is None or broadcast.published_at is None:
            return
        if not broadcast.notify_on_publish:
            return

        course = await session.get(Course, broadcast.course_id)
        if course is None or course.deleted_at is not None:
            return

        enrollment = await session.get(CourseEnrollment, enrollment_id)
        if enrollment is None or enrollment.deleted_at is not None:
            return

        subscriber_repo = EmailSubscriberRepository.from_session(session)
        subscriber = await subscriber_repo.get_by_customer_and_organization(
            enrollment.customer_id, course.organization_id
        )
        if subscriber is None:
            return

        await fire_event(
            session,
            organization_id=course.organization_id,
            subscriber_id=subscriber.id,
            event_name="course.broadcast_published",
            course_id=course.id,
        )


@actor(
    actor_name="course_broadcast.publish_due_scheduled",
    cron_trigger=CronTrigger(minute="*"),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def publish_due_scheduled() -> None:
    """Per-minute scan for scheduled drafts whose scheduled_at has
    passed. Flips them to published + enqueues the parent fanout task.
    Idempotent: a row that's already published won't match the partial
    index, so a repeated tick is a no-op."""
    async with AsyncSessionMaker() as session:
        repo = BroadcastRepository.from_session(session)
        now = datetime.now(timezone.utc)
        due = list(
            await repo.get_all(repo.get_due_scheduled_statement(now))
        )
        for broadcast in due:
            notify = broadcast.notify_on_publish
            broadcast.published_at = now
            broadcast.scheduled_at = None
            await session.flush()
            if notify:
                enqueue_job(
                    "course_broadcast.fanout_publish",
                    broadcast_id=broadcast.id,
                )
