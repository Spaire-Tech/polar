from uuid import UUID

from sqlalchemy import Select

from polar.auth.models import AuthSubject, Organization, User
from polar.course.repository import CourseRepository
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.course import Course
from polar.models.course_broadcast import CourseBroadcast


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
        first. `only_published=True` is what the student feed uses."""
        statement = self.get_base_statement().where(
            CourseBroadcast.course_id == course_id,
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
