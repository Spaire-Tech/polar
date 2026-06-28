from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select, update

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
from polar.models.course_note import CourseNote
from polar.models.lesson_comment import LessonComment
from polar.models.lesson_comment_like import LessonCommentLike


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

    async def count_published_by_organization(self, organization_id: UUID) -> int:
        """Number of *published* courses owned by the organization — courses
        with at least one published (non-soft-deleted) lesson.

        The tier limit is named ``published_courses`` and enforcement matches
        the word: a draft course (no published lesson yet) does NOT occupy a
        slot, so a creator can stage unlimited drafts and is only metered on
        what's actually live. Counting *created* courses instead — drafts and
        all — was the documented Kajabi surprise we deliberately avoid.
        """
        published_course_ids = (
            select(CourseModule.course_id)
            .join(CourseLesson, CourseLesson.module_id == CourseModule.id)
            .where(
                CourseLesson.published.is_(True),
                CourseLesson.deleted_at.is_(None),
                CourseModule.deleted_at.is_(None),
            )
        )
        statement = select(func.count(func.distinct(Course.id))).where(
            Course.organization_id == organization_id,
            Course.deleted_at.is_(None),
            Course.id.in_(published_course_ids),
        )
        return (await self.session.execute(statement)).scalar_one()

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

    def get_by_course_statement(self, course_id: UUID):
        """Get all lessons for a course (across all modules), ordered by position."""
        return (
            self.get_base_statement()
            .join(CourseModule)
            .where(CourseModule.course_id == course_id)
            .order_by(CourseLesson.position)
        )

    async def count_by_course(self, course_id: UUID) -> int:
        statement = select(func.count(CourseLesson.id)).where(
            CourseLesson.module_id.in_(
                select(CourseModule.id).where(CourseModule.course_id == course_id)
            ),
            CourseLesson.deleted_at.is_(None),
        )
        return (await self.session.execute(statement)).scalar_one()

    async def count_published_by_course(self, course_id: UUID) -> int:
        """Published (non-soft-deleted) lesson count for a course. A course
        with zero published lessons is a draft and doesn't occupy a
        published_courses slot — see CourseRepository.
        count_published_by_organization."""
        statement = select(func.count(CourseLesson.id)).where(
            CourseLesson.module_id.in_(
                select(CourseModule.id).where(CourseModule.course_id == course_id)
            ),
            CourseLesson.published.is_(True),
            CourseLesson.deleted_at.is_(None),
        )
        return (await self.session.execute(statement)).scalar_one()

    async def count_by_module(self, module_id: UUID) -> int:
        """Non-soft-deleted lesson count for a single module. Used by the
        module-completion detector — combined with the per-enrollment
        completed count we know when a student has finished a module."""
        statement = select(func.count(CourseLesson.id)).where(
            CourseLesson.module_id == module_id,
            CourseLesson.deleted_at.is_(None),
        )
        return (await self.session.execute(statement)).scalar_one()

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

    async def get_organization_id_for_lesson(
        self, lesson_id: UUID
    ) -> UUID | None:
        """Resolve the owning organization of a lesson via its module/course
        chain. Used by quota enforcement and the Mux webhook handler.
        """
        statement = (
            select(Course.organization_id)
            .join(CourseModule, CourseModule.course_id == Course.id)
            .join(CourseLesson, CourseLesson.module_id == CourseModule.id)
            .where(CourseLesson.id == lesson_id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_course_and_org_for_lesson(
        self, lesson_id: UUID
    ) -> tuple[UUID, UUID] | None:
        """Resolve (course_id, organization_id) for a lesson via its
        module/course chain. Used by the published_courses cap gate when a
        lesson is published."""
        statement = (
            select(Course.id, Course.organization_id)
            .join(CourseModule, CourseModule.course_id == Course.id)
            .join(CourseLesson, CourseLesson.module_id == CourseModule.id)
            .where(CourseLesson.id == lesson_id)
        )
        result = await self.session.execute(statement)
        row = result.first()
        return (row[0], row[1]) if row is not None else None

    async def get_course_id_for_lesson(self, lesson_id: UUID) -> UUID | None:
        """Resolve the owning course of a lesson via its module. Used by the
        Course Assistant ingestion pipeline (a transcript landing on a lesson
        triggers a re-check of that lesson's course)."""
        statement = (
            select(CourseModule.course_id)
            .join(CourseLesson, CourseLesson.module_id == CourseModule.id)
            .where(CourseLesson.id == lesson_id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_mux_asset_id(self, asset_id: str) -> CourseLesson | None:
        """Find a (non-soft-deleted) lesson by its Mux asset id. Used by the
        caption-track webhook, which identifies the asset, not the upload."""
        statement = self.get_base_statement().where(
            CourseLesson.mux_asset_id == asset_id
        )
        return await self.get_one_or_none(statement)

    async def list_pending_transcripts(
        self, limit: int = 200
    ) -> Sequence[CourseLesson]:
        """Lessons whose caption transcript is still pending. The Course
        Assistant reconcile cron retries / times these out so a silently
        stuck caption can't block a course's assistant build forever."""
        statement = (
            self.get_base_statement()
            .where(CourseLesson.transcript_status == "pending")
            .limit(limit)
        )
        return await self.get_all(statement)


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

    async def get_active_for_customer_course(
        self, customer_id: UUID, course_id: UUID
    ) -> CourseEnrollment | None:
        """Active (non-soft-deleted) enrollment for the (customer,
        course) pair. Used as the author_enrollment_id source for
        student-authored writes (community posts, submission
        comments)."""
        statement = self.get_by_customer_and_course_statement(
            customer_id, course_id
        ).where(CourseEnrollment.deleted_at.is_(None))
        return await self.get_one_or_none(statement)

    async def list_customer_ids_for_course(
        self, course_id: UUID
    ) -> list[UUID]:
        """Customer ids with an active (non-deleted) enrollment in a
        course. Powers the community fan-out tasks; the raw select
        used to live in events_tasks/activities_tasks duplicated three
        times — per server/CLAUDE.md, queries belong in repositories."""
        from sqlalchemy import select

        statement = select(CourseEnrollment.customer_id).where(
            CourseEnrollment.course_id == course_id,
            CourseEnrollment.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return [r[0] for r in result.all()]


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

    async def count_by_enrollment(self, enrollment_id: UUID) -> int:
        statement = select(func.count(CourseLessonProgress.id)).where(
            CourseLessonProgress.enrollment_id == enrollment_id,
            CourseLessonProgress.deleted_at.is_(None),
        )
        return (await self.session.execute(statement)).scalar_one()

    async def count_by_enrollment_in_module(
        self, enrollment_id: UUID, module_id: UUID
    ) -> int:
        """Completed lessons by an enrollment inside a single module.
        Together with CourseLessonRepository.count_by_module this is how
        the service detects a course.module_completed event."""
        statement = (
            select(func.count(CourseLessonProgress.id))
            .join(
                CourseLesson,
                CourseLesson.id == CourseLessonProgress.lesson_id,
            )
            .where(
                CourseLessonProgress.enrollment_id == enrollment_id,
                CourseLessonProgress.deleted_at.is_(None),
                CourseLesson.module_id == module_id,
                CourseLesson.deleted_at.is_(None),
            )
        )
        return (await self.session.execute(statement)).scalar_one()

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

    async def clear_pins_for_lesson(self, lesson_id: UUID) -> None:
        """Unpin every comment on a lesson — called before pinning a new
        one so the lesson holds at most a single pin (YouTube semantics)."""
        statement = (
            update(LessonComment)
            .where(
                LessonComment.lesson_id == lesson_id,
                LessonComment.pinned_at.isnot(None),
            )
            .values(pinned_at=None)
        )
        await self.session.execute(statement)

    async def get_tombstone_parents(
        self, lesson_id: UUID, parent_ids: set[UUID]
    ) -> Sequence[LessonComment]:
        """Fetch soft-deleted parent comments scoped to a lesson — the
        caller wraps this in the kit's `merge_with_tombstones` so the
        reply chain stays renderable.
        """
        if not parent_ids:
            return []
        statement = self.get_base_statement(include_deleted=True).where(
            LessonComment.id.in_(parent_ids),
            LessonComment.lesson_id == lesson_id,
        )
        return await self.get_all(statement)


class LessonCommentLikeRepository(
    RepositoryBase[LessonCommentLike],
):
    model = LessonCommentLike

    async def get_like(
        self, comment_id: UUID, enrollment_id: UUID
    ) -> LessonCommentLike | None:
        statement = self.get_base_statement().where(
            LessonCommentLike.lesson_comment_id == comment_id,
            LessonCommentLike.enrollment_id == enrollment_id,
        )
        return await self.get_one_or_none(statement)

    async def count_for_comment(self, comment_id: UUID) -> int:
        statement = select(func.count(LessonCommentLike.id)).where(
            LessonCommentLike.lesson_comment_id == comment_id
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def counts_for_comments(
        self, comment_ids: Sequence[UUID]
    ) -> dict[UUID, int]:
        """Like counts keyed by comment id (only comments with ≥1 like
        appear). Single grouped query for the whole listing."""
        if not comment_ids:
            return {}
        statement = (
            select(
                LessonCommentLike.lesson_comment_id,
                func.count(LessonCommentLike.id),
            )
            .where(LessonCommentLike.lesson_comment_id.in_(comment_ids))
            .group_by(LessonCommentLike.lesson_comment_id)
        )
        result = await self.session.execute(statement)
        return {row[0]: row[1] for row in result}

    async def liked_comment_ids(
        self, comment_ids: Sequence[UUID], enrollment_id: UUID
    ) -> set[UUID]:
        """Subset of `comment_ids` the given enrollment has liked."""
        if not comment_ids:
            return set()
        statement = select(LessonCommentLike.lesson_comment_id).where(
            LessonCommentLike.lesson_comment_id.in_(comment_ids),
            LessonCommentLike.enrollment_id == enrollment_id,
        )
        result = await self.session.execute(statement)
        return {row[0] for row in result}


class CourseNoteRepository(
    RepositorySoftDeletionIDMixin[CourseNote, UUID],
    RepositorySoftDeletionMixin[CourseNote],
    RepositoryBase[CourseNote],
):
    model = CourseNote

    def get_by_enrollment_and_lesson_statement(
        self, enrollment_id: UUID, lesson_id: UUID
    ):
        return self.get_base_statement().where(
            CourseNote.enrollment_id == enrollment_id,
            CourseNote.lesson_id == lesson_id,
        )

    def get_by_enrollment_statement(self, enrollment_id: UUID):
        return self.get_base_statement().where(
            CourseNote.enrollment_id == enrollment_id,
        )
