from uuid import UUID

from sqlalchemy import Select, or_, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import UserOrganization
from polar.models.course_assistant import CourseAssistant
from polar.models.course_lesson import CourseLesson
from polar.models.course_module import CourseModule


class CourseAssistantRepository(
    RepositorySoftDeletionIDMixin[CourseAssistant, UUID],
    RepositorySoftDeletionMixin[CourseAssistant],
    RepositoryBase[CourseAssistant],
):
    model = CourseAssistant

    async def get_by_course(self, course_id: UUID) -> CourseAssistant | None:
        statement = self.get_base_statement().where(
            CourseAssistant.course_id == course_id
        )
        return await self.get_one_or_none(statement)

    async def list_course_ids_needing_build(self, limit: int = 100) -> list[UUID]:
        """Course ids that have at least one published lesson but no assistant
        yet (or one still stuck in ``building``). The reconcile cron uses this
        to pick up courses whose build was never triggered — notably
        text-only courses, which produce no Mux webhook to kick the build."""
        statement = (
            select(CourseModule.course_id)
            .join(CourseLesson, CourseLesson.module_id == CourseModule.id)
            .join(
                CourseAssistant,
                (CourseAssistant.course_id == CourseModule.course_id)
                & (CourseAssistant.deleted_at.is_(None)),
                isouter=True,
            )
            .where(
                CourseLesson.published == True,  # noqa: E712
                CourseLesson.deleted_at.is_(None),
                CourseModule.deleted_at.is_(None),
                or_(
                    CourseAssistant.id.is_(None),
                    CourseAssistant.status == "building",
                ),
            )
            .distinct()
            .limit(limit)
        )
        result = await self.session.execute(statement)
        return [row[0] for row in result.all()]

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CourseAssistant]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                CourseAssistant.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                CourseAssistant.organization_id == auth_subject.subject.id
            )
        return statement
