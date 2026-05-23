"""Background tasks for course broadcasts.

The publish endpoint hands fanout off here instead of looping over
enrollments inline — a 5000-student course would otherwise time out the
publish request. The actor drains the cohort once asynchronously; if
the broadcast is unpublished mid-fan-out the task aborts on the next
iteration so we don't keep emailing after the creator pulled the post.

Scheduled broadcasts: `publish_due_scheduled` is a 60s cron that scans
for rows past their scheduled_at, flips them to published, and enqueues
the same fanout.
"""

from datetime import datetime, timezone
from uuid import UUID

from polar.course.repository import CourseEnrollmentRepository
from polar.course_broadcast.repository import BroadcastRepository
from polar.email_sequence.events import fire_event
from polar.email_subscriber.repository import EmailSubscriberRepository
from polar.exceptions import PolarTaskError
from polar.models.course import Course
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
    """Fire `course.broadcast_published` once per enrolled student's
    email subscriber. Skips silently if the broadcast was unpublished
    (or deleted) between the publish call and this task running."""
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
        subscriber_repo = EmailSubscriberRepository.from_session(session)
        for enrollment in enrollments:
            subscriber = await subscriber_repo.get_by_customer_and_organization(
                enrollment.customer_id, course.organization_id
            )
            if subscriber is None:
                continue
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
    passed. Flips them to published + enqueues fanout. Idempotent: a
    row that's already published won't match the partial index, so a
    repeated tick is a no-op."""
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
