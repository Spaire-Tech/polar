from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, Organization, User
from polar.course.repository import CourseRepository
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.course import Course
from polar.models.course_broadcast import CourseBroadcast
from polar.models.user import User as UserModel


class BroadcastRepository(
    RepositorySoftDeletionIDMixin[CourseBroadcast, UUID],
    RepositorySoftDeletionMixin[CourseBroadcast],
    RepositoryBase[CourseBroadcast],
):
    model = CourseBroadcast

    def get_by_course_statement(
        self, course_id: UUID, *, only_published: bool = False
    ) -> Select[tuple[CourseBroadcast]]:
        """Creator inbox: every broadcast (drafts + published), newest
        first. `only_published=True` is what the student feed uses.
        Both paths join Course to suppress broadcasts when the parent
        course has been soft-deleted."""
        statement = (
            self.get_base_statement()
            .join(Course, CourseBroadcast.course_id == Course.id)
            .where(
                CourseBroadcast.course_id == course_id,
                Course.deleted_at.is_(None),
            )
        )
        if only_published:
            statement = statement.where(CourseBroadcast.published_at.is_not(None))
            statement = statement.order_by(CourseBroadcast.published_at.desc())
        else:
            # Drafts (NULL published_at) sort to the top via created_at
            # tiebreak so the creator sees their latest unpublished work
            # first. Published rows then fall in publish-date order.
            statement = statement.order_by(
                CourseBroadcast.published_at.desc().nullsfirst(),
                CourseBroadcast.created_at.desc(),
            )
        return statement

    async def get_author_names_by_ids(
        self, user_ids: list[UUID]
    ) -> dict[UUID, str]:
        """Single IN scan for author display names. Empty input → empty
        dict (no SQL fired). Used by the BroadcastRead serializer so
        the creator inbox doesn't pay N+1 on author resolution."""
        if not user_ids:
            return {}
        statement = select(UserModel).where(UserModel.id.in_(set(user_ids)))
        rows = (await self.session.execute(statement)).scalars().all()
        return {u.id: u.public_name for u in rows}

    def get_due_scheduled_statement(
        self, now: datetime
    ) -> Select[tuple[CourseBroadcast]]:
        """Scheduled drafts whose scheduled_at has passed. Drives the
        periodic publish-due worker — matches the partial index in the
        migration so the planner uses it instead of a seq scan.

        Joined to Course so a soft-deleted course can't keep auto-
        publishing pending broadcasts after the creator pulled it.
        Keeps the cron consistent with the audit-fix #16 soft-delete
        propagation everywhere else."""
        return (
            self.get_base_statement()
            .join(Course, CourseBroadcast.course_id == Course.id)
            .where(
                CourseBroadcast.published_at.is_(None),
                CourseBroadcast.scheduled_at.is_not(None),
                CourseBroadcast.scheduled_at <= now,
                Course.deleted_at.is_(None),
            )
        )

    async def get_readable_by_id(
        self,
        broadcast_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> CourseBroadcast | None:
        """Creator-side readability: the broadcast belongs to a course
        the authenticated creator can read."""
        course_repo = CourseRepository.from_session(self.session)
        readable_course_ids = course_repo.get_readable_statement(
            auth_subject
        ).with_only_columns(Course.id)
        statement = self.get_base_statement().where(
            CourseBroadcast.id == broadcast_id,
            CourseBroadcast.course_id.in_(readable_course_ids),
        )
        return await self.get_one_or_none(statement)
