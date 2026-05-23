from datetime import datetime, timezone
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.course.repository import CourseEnrollmentRepository, CourseRepository
from polar.email_sequence.events import fire_event
from polar.email_subscriber.repository import EmailSubscriberRepository
from polar.exceptions import ResourceNotFound
from polar.models.course import Course
from polar.models.course_broadcast import CourseBroadcast
from polar.postgres import AsyncSession

from .repository import BroadcastRepository
from .schemas import BroadcastCreate, BroadcastUpdate


class BroadcastService:
    async def list_for_course(
        self,
        session: AsyncSession,
        course: Course,
        *,
        only_published: bool = False,
    ) -> list[CourseBroadcast]:
        repo = BroadcastRepository.from_session(session)
        statement = repo.get_by_course_statement(
            course.id, only_published=only_published
        )
        return list(await repo.get_all(statement))

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: BroadcastCreate,
    ) -> CourseBroadcast:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(
            create_schema.course_id, auth_subject
        )
        if course is None:
            raise ResourceNotFound("Course not found")

        # User tokens track authorship; organization tokens leave it NULL
        # (matches the audit posture of challenges + other creator content).
        author_user_id: UUID | None = (
            auth_subject.subject.id if is_user(auth_subject) else None
        )

        broadcast = CourseBroadcast(
            course_id=course.id,
            created_by_user_id=author_user_id,
            title=create_schema.title,
            body=create_schema.body,
            image_url=create_schema.image_url,
            week_number=create_schema.week_number,
            notify_on_publish=create_schema.notify_on_publish,
            published_at=(
                datetime.now(timezone.utc) if create_schema.publish else None
            ),
        )
        repo = BroadcastRepository.from_session(session)
        await repo.create(broadcast, flush=True)
        return broadcast

    async def update(
        self,
        session: AsyncSession,
        broadcast: CourseBroadcast,
        update_schema: BroadcastUpdate,
    ) -> CourseBroadcast:
        # `exclude_unset` so `image_url: None` from the client is treated
        # as "clear the image" only when explicitly sent — not when the
        # client omits the field entirely.
        data = update_schema.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(broadcast, key, value)
        await session.flush()
        return broadcast

    async def publish(
        self,
        session: AsyncSession,
        broadcast: CourseBroadcast,
    ) -> CourseBroadcast:
        """Stamp the publish timestamp, then (when notify_on_publish is
        set) fan out a `course.broadcast_published` event per enrolled
        student. The event wakes any email-sequence node the creator has
        wired in the automations editor — same dispatch model as the
        Phase 1 `course.submission_reacted_to_by_creator` event.

        Re-publishing a published broadcast updates `published_at` to
        "now" so it bubbles to the top of the feed, and fans out the
        event again — by design, this is the "resend" lever.
        """
        was_silent = not broadcast.notify_on_publish
        broadcast.published_at = datetime.now(timezone.utc)
        await session.flush()

        if was_silent:
            return broadcast

        await self._fanout_publish_event(session, broadcast)
        return broadcast

    async def _fanout_publish_event(
        self,
        session: AsyncSession,
        broadcast: CourseBroadcast,
    ) -> None:
        course = await session.get(Course, broadcast.course_id)
        if course is None:
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
                # Student isn't on the org's email list. The course-portal
                # feed will still pick up the broadcast on next render; we
                # just don't send them an email.
                continue
            await fire_event(
                session,
                organization_id=course.organization_id,
                subscriber_id=subscriber.id,
                event_name="course.broadcast_published",
                course_id=course.id,
            )

    async def unpublish(
        self,
        session: AsyncSession,
        broadcast: CourseBroadcast,
    ) -> CourseBroadcast:
        """Move a published broadcast back to draft. Doesn't try to
        retract notifications that already went out — by design, this is
        for fixing typos before students notice, not censoring history."""
        broadcast.published_at = None
        await session.flush()
        return broadcast

    async def delete(
        self,
        session: AsyncSession,
        broadcast: CourseBroadcast,
    ) -> None:
        broadcast.deleted_at = datetime.now(timezone.utc)
        await session.flush()


broadcast = BroadcastService()
