from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
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


class CourseModuleRepository(
    RepositorySoftDeletionIDMixin[CourseModule, UUID],
    RepositorySoftDeletionMixin[CourseModule],
    RepositoryBase[CourseModule],
):
    model = CourseModule

    def get_by_course_statement(self, course_id: UUID):
        return self.get_base_statement().where(CourseModule.course_id == course_id)


class CourseLessonRepository(
    RepositorySoftDeletionIDMixin[CourseLesson, UUID],
    RepositorySoftDeletionMixin[CourseLesson],
    RepositoryBase[CourseLesson],
):
    model = CourseLesson

    def get_by_module_statement(self, module_id: UUID):
        return self.get_base_statement().where(CourseLesson.module_id == module_id)


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
