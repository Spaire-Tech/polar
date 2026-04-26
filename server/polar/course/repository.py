from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import UserOrganization
from polar.models.course import Course
from polar.models.course_enrollment import CourseEnrollment
from polar.models.course_lesson import CourseLesson
from polar.models.course_lesson_progress import CourseLessonProgress
from polar.models.course_module import CourseModule
from polar.models.lesson_comment import LessonComment


class CourseRepository(
    RepositorySoftDeletionIDMixin[Course, UUID],
    RepositorySoftDeletionMixin[Course],
    RepositoryBase[Course],
):
    model = Course

    def get_by_product_statement(self, product_id: UUID):
        return self.get_base_statement().where(Course.product_id == product_id)

    def get_by_organization_statement(self, organization_id: UUID):
        return self.get_base_statement().where(
            Course.organization_id == organization_id
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Course]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                Course.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Course.organization_id == auth_subject.subject.id
            )
        return statement

    async def get_readable_by_id(
        self,
        course_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> Course | None:
        statement = self.get_readable_statement(auth_subject).where(
            Course.id == course_id
        )
        return await self.get_one_or_none(statement)


class CourseModuleRepository(
    RepositorySoftDeletionIDMixin[CourseModule, UUID],
    RepositorySoftDeletionMixin[CourseModule],
    RepositoryBase[CourseModule],
):
    model = CourseModule

    def get_by_course_statement(self, course_id: UUID):
        return self.get_base_statement().where(CourseModule.course_id == course_id)

    async def get_readable_by_id(
        self,
        module_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> CourseModule | None:
        course_repo = CourseRepository.from_session(self.session)
        readable_course_ids = course_repo.get_readable_statement(auth_subject).with_only_columns(Course.id)
        statement = self.get_base_statement().where(
            CourseModule.id == module_id,
            CourseModule.course_id.in_(readable_course_ids),
        )
        return await self.get_one_or_none(statement)


class CourseLessonRepository(
    RepositorySoftDeletionIDMixin[CourseLesson, UUID],
    RepositorySoftDeletionMixin[CourseLesson],
    RepositoryBase[CourseLesson],
):
    model = CourseLesson

    def get_by_module_statement(self, module_id: UUID):
        return self.get_base_statement().where(CourseLesson.module_id == module_id)

    async def get_readable_by_id(
        self,
        lesson_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> CourseLesson | None:
        course_repo = CourseRepository.from_session(self.session)
        readable_course_ids = course_repo.get_readable_statement(auth_subject).with_only_columns(Course.id)
        readable_module_ids = (
            select(CourseModule.id)
            .where(
                CourseModule.course_id.in_(readable_course_ids),
                CourseModule.deleted_at.is_(None),
            )
        )
        statement = self.get_base_statement().where(
            CourseLesson.id == lesson_id,
            CourseLesson.module_id.in_(readable_module_ids),
        )
        return await self.get_one_or_none(statement)


class CourseEnrollmentRepository(
    RepositorySoftDeletionIDMixin[CourseEnrollment, UUID],
    RepositorySoftDeletionMixin[CourseEnrollment],
    RepositoryBase[CourseEnrollment],
):
    model = CourseEnrollment

    def get_by_customer_statement(self, customer_id: UUID):
        return self.get_base_statement().where(
            CourseEnrollment.customer_id == customer_id
        )

    def get_by_customer_and_course_statement(
        self, customer_id: UUID, course_id: UUID
    ):
        return self.get_base_statement().where(
            CourseEnrollment.customer_id == customer_id,
            CourseEnrollment.course_id == course_id,
        )


class CourseLessonProgressRepository(
    RepositorySoftDeletionIDMixin[CourseLessonProgress, UUID],
    RepositorySoftDeletionMixin[CourseLessonProgress],
    RepositoryBase[CourseLessonProgress],
):
    model = CourseLessonProgress

    def get_by_enrollment_statement(self, enrollment_id: UUID):
        return self.get_base_statement().where(
            CourseLessonProgress.enrollment_id == enrollment_id
        )

    def get_by_enrollment_and_lesson_statement(
        self, enrollment_id: UUID, lesson_id: UUID
    ):
        return self.get_base_statement().where(
            CourseLessonProgress.enrollment_id == enrollment_id,
            CourseLessonProgress.lesson_id == lesson_id,
        )


class LessonCommentRepository(
    RepositorySoftDeletionIDMixin[LessonComment, UUID],
    RepositorySoftDeletionMixin[LessonComment],
    RepositoryBase[LessonComment],
):
    model = LessonComment

    def get_by_lesson_statement(self, lesson_id: UUID):
        return self.get_base_statement().where(
            LessonComment.lesson_id == lesson_id
        )

    def get_by_enrollment_and_lesson_statement(
        self, enrollment_id: UUID, lesson_id: UUID
    ):
        return self.get_base_statement().where(
            LessonComment.enrollment_id == enrollment_id,
            LessonComment.lesson_id == lesson_id,
        )
