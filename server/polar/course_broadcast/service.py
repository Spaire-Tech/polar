from datetime import datetime, timezone
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.course.repository import CourseRepository
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
        """Idempotent: re-publishing a published broadcast updates the
        `published_at` to "now" so it bubbles to the top of the feed.
        Notification + email dispatch is wired in Day 2 alongside the
        creator publish UI — kept off this code path so Day 1 stays
        narrowly about the CRUD surface."""
        broadcast.published_at = datetime.now(timezone.utc)
        await session.flush()
        return broadcast

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
