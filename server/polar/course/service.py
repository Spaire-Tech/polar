from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from polar.models.course import Course
from polar.models.course_enrollment import CourseEnrollment
from polar.models.course_lesson import CourseLesson
from polar.models.course_lesson_progress import CourseLessonProgress
from polar.models.course_module import CourseModule
from polar.models.customer import Customer
from polar.models.lesson_comment import LessonComment

from .repository import (
    CourseEnrollmentRepository,
    CourseLessonProgressRepository,
    CourseLessonRepository,
    CourseModuleRepository,
    CourseRepository,
    LessonCommentRepository,
)
from .schemas import (
    CourseCreate,
    CourseLessonCreate,
    CourseLessonUpdate,
    CourseModuleCreate,
    CourseModuleUpdate,
    CourseUpdate,
)


class CourseService:
    async def get_by_id(self, session: AsyncSession, course_id: UUID) -> Course | None:
        repo = CourseRepository.from_session(session)
        return await repo.get_by_id(course_id)

    async def get_by_product(
        self, session: AsyncSession, product_id: UUID
    ) -> Course | None:
        repo = CourseRepository.from_session(session)
        statement = repo.get_by_product_statement(product_id)
        return await repo.get_one_or_none(statement)

    async def list_by_organization(
        self, session: AsyncSession, organization_id: UUID
    ) -> Sequence[Course]:
        repo = CourseRepository.from_session(session)
        statement = repo.get_by_organization_statement(organization_id)
        return await repo.get_all(statement)

    async def create(
        self, session: AsyncSession, create_schema: CourseCreate
    ) -> Course:
        repo = CourseRepository.from_session(session)

        course = Course(
            product_id=create_schema.product_id,
            organization_id=create_schema.organization_id,
            title=create_schema.title,
            course_type=create_schema.course_type,
            paywall_enabled=create_schema.paywall_enabled,
            paywall_lesson_id=create_schema.paywall_lesson_id,
            ai_generated=create_schema.ai_generated,
            description=create_schema.description,
            thumbnail_url=create_schema.thumbnail_url,
        )

        # Use provided modules or create implicit "Lessons" module
        modules_to_add = create_schema.modules
        if not modules_to_add:
            # Create implicit module for flat lesson structure
            modules_to_add = [CourseModuleCreate(
                title='Lessons',
                description=None,
                position=0,
                lessons=[],
            )]

        for mod_schema in modules_to_add:
            module = CourseModule(
                title=mod_schema.title,
                description=mod_schema.description,
                position=mod_schema.position,
            )
            for lesson_schema in mod_schema.lessons:
                module.lessons.append(
                    CourseLesson(
                        title=lesson_schema.title,
                        content_type=lesson_schema.content_type,
                        content=lesson_schema.content,
                        video_asset_id=lesson_schema.video_asset_id,
                        duration_seconds=lesson_schema.duration_seconds,
                        position=lesson_schema.position,
                        is_free_preview=lesson_schema.is_free_preview,
                    )
                )
            course.modules.append(module)

        course = await repo.create(course, flush=True)
        # Refresh to avoid MissingGreenlet when selectin relationships are accessed
        await session.refresh(course, attribute_names=["modules"])
        return course

    async def update(
        self,
        session: AsyncSession,
        course: Course,
        update_schema: CourseUpdate,
    ) -> Course:
        repo = CourseRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True)
        return await repo.update(course, update_dict=update_dict)

    async def add_module(
        self,
        session: AsyncSession,
        course: Course,
        create_schema: CourseModuleCreate,
    ) -> CourseModule:
        module_repo = CourseModuleRepository.from_session(session)

        module = CourseModule(
            course_id=course.id,
            title=create_schema.title,
            description=create_schema.description,
            position=create_schema.position,
        )

        for lesson_schema in create_schema.lessons:
            module.lessons.append(
                CourseLesson(
                    title=lesson_schema.title,
                    content_type=lesson_schema.content_type,
                    content=lesson_schema.content,
                    video_asset_id=lesson_schema.video_asset_id,
                    duration_seconds=lesson_schema.duration_seconds,
                    position=lesson_schema.position,
                    is_free_preview=lesson_schema.is_free_preview,
                )
            )

        module = await module_repo.create(module, flush=True)
        # Refresh lessons so selectin access doesn't trigger MissingGreenlet
        await session.refresh(module, attribute_names=["lessons"])
        return module

    async def update_module(
        self,
        session: AsyncSession,
        module: CourseModule,
        update_schema: CourseModuleUpdate,
    ) -> CourseModule:
        module_repo = CourseModuleRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True)
        return await module_repo.update(module, update_dict=update_dict)

    async def get_module_by_id(
        self, session: AsyncSession, module_id: UUID
    ) -> CourseModule | None:
        module_repo = CourseModuleRepository.from_session(session)
        return await module_repo.get_by_id(module_id)

    async def delete_module(
        self, session: AsyncSession, module: CourseModule
    ) -> None:
        module_repo = CourseModuleRepository.from_session(session)
        await module_repo.soft_delete(module)

    async def reorder_modules(
        self,
        session: AsyncSession,
        course: Course,
        ordered_ids: Sequence[UUID],
    ) -> Sequence[CourseModule]:
        """Reorder modules within a course by setting position to list index."""
        module_repo = CourseModuleRepository.from_session(session)
        existing_ids = {m.id for m in course.modules}
        if set(ordered_ids) != existing_ids:
            raise ValueError("ordered_ids must contain exactly the course's modules")
        by_id = {m.id: m for m in course.modules}
        for index, module_id in enumerate(ordered_ids):
            await module_repo.update(by_id[module_id], update_dict={"position": index})
        return [by_id[mid] for mid in ordered_ids]

    async def add_lesson(
        self,
        session: AsyncSession,
        module: CourseModule,
        create_schema: CourseLessonCreate,
    ) -> CourseLesson:
        lesson_repo = CourseLessonRepository.from_session(session)
        return await lesson_repo.create(
            CourseLesson(
                module_id=module.id,
                title=create_schema.title,
                content_type=create_schema.content_type,
                content=create_schema.content,
                video_asset_id=create_schema.video_asset_id,
                duration_seconds=create_schema.duration_seconds,
                position=create_schema.position,
                is_free_preview=create_schema.is_free_preview,
            ),
            flush=True,
        )

    async def update_lesson(
        self,
        session: AsyncSession,
        lesson: CourseLesson,
        update_schema: CourseLessonUpdate,
    ) -> CourseLesson:
        lesson_repo = CourseLessonRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True)
        return await lesson_repo.update(lesson, update_dict=update_dict)

    async def get_lesson_by_id(
        self, session: AsyncSession, lesson_id: UUID
    ) -> CourseLesson | None:
        lesson_repo = CourseLessonRepository.from_session(session)
        return await lesson_repo.get_by_id(lesson_id)

    async def delete_lesson(
        self, session: AsyncSession, lesson: CourseLesson
    ) -> None:
        lesson_repo = CourseLessonRepository.from_session(session)
        await lesson_repo.soft_delete(lesson)

    async def reorder_lessons(
        self,
        session: AsyncSession,
        module: CourseModule,
        ordered_ids: Sequence[UUID],
    ) -> Sequence[CourseLesson]:
        """Reorder lessons within a module by setting position to list index."""
        lesson_repo = CourseLessonRepository.from_session(session)
        existing_ids = {lesson.id for lesson in module.lessons}
        if set(ordered_ids) != existing_ids:
            raise ValueError("ordered_ids must contain exactly the module's lessons")
        by_id = {lesson.id: lesson for lesson in module.lessons}
        for index, lesson_id in enumerate(ordered_ids):
            await lesson_repo.update(by_id[lesson_id], update_dict={"position": index})
        return [by_id[lid] for lid in ordered_ids]

    # --- Enrollment ---

    async def enroll_customer(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        customer: Customer,
        product_id: UUID | None = None,
    ) -> CourseEnrollment:
        repo = CourseEnrollmentRepository.from_session(session)
        statement = repo.get_by_customer_and_course_statement(customer.id, course_id)
        existing = await repo.get_one_or_none(statement)
        if existing is not None:
            return existing

        enrollment = CourseEnrollment(
            customer_id=customer.id,
            course_id=course_id,
            product_id=product_id,
            enrolled_at=datetime.now(tz=UTC),
        )
        return await repo.create(enrollment, flush=True)

    async def revoke_enrollment(
        self,
        session: AsyncSession,
        enrollment_id: UUID,
    ) -> None:
        repo = CourseEnrollmentRepository.from_session(session)
        enrollment = await repo.get_by_id(enrollment_id)
        if enrollment is not None:
            await repo.soft_delete(enrollment)

    async def list_enrollments_for_customer(
        self,
        session: AsyncSession,
        customer_id: UUID,
    ) -> Sequence[CourseEnrollment]:
        repo = CourseEnrollmentRepository.from_session(session)
        statement = repo.get_by_customer_statement(customer_id)
        return await repo.get_all(statement)

    async def get_enrollment_for_customer(
        self,
        session: AsyncSession,
        customer_id: UUID,
        course_id: UUID,
    ) -> CourseEnrollment | None:
        repo = CourseEnrollmentRepository.from_session(session)
        statement = repo.get_by_customer_and_course_statement(customer_id, course_id)
        return await repo.get_one_or_none(statement)

    # --- Progress ---

    async def mark_lesson_complete(
        self,
        session: AsyncSession,
        *,
        enrollment_id: UUID,
        lesson_id: UUID,
    ) -> CourseLessonProgress:
        repo = CourseLessonProgressRepository.from_session(session)
        existing = await repo.get_one_or_none(
            repo.get_by_enrollment_and_lesson_statement(enrollment_id, lesson_id)
        )
        if existing is not None:
            return existing
        progress = CourseLessonProgress(
            enrollment_id=enrollment_id,
            lesson_id=lesson_id,
            completed_at=datetime.now(tz=UTC),
        )
        return await repo.create(progress, flush=True)

    async def get_progress_for_enrollment(
        self,
        session: AsyncSession,
        *,
        enrollment_id: UUID,
    ) -> Sequence[CourseLessonProgress]:
        repo = CourseLessonProgressRepository.from_session(session)
        return await repo.get_all(repo.get_by_enrollment_statement(enrollment_id))

    # --- Lesson comments ---

    async def list_lesson_comments(
        self,
        session: AsyncSession,
        *,
        lesson_id: UUID,
    ) -> Sequence[LessonComment]:
        repo = LessonCommentRepository.from_session(session)
        statement = repo.get_by_lesson_statement(lesson_id).order_by(
            LessonComment.created_at.asc()
        )
        return await repo.get_all(statement)

    async def create_lesson_comment(
        self,
        session: AsyncSession,
        *,
        enrollment_id: UUID,
        lesson_id: UUID,
        content: str,
        parent_id: UUID | None = None,
    ) -> LessonComment:
        repo = LessonCommentRepository.from_session(session)
        if parent_id is not None:
            parent = await repo.get_by_id(parent_id)
            if parent is None or parent.lesson_id != lesson_id:
                raise ValueError("Invalid parent comment")
        comment = LessonComment(
            lesson_id=lesson_id,
            enrollment_id=enrollment_id,
            parent_id=parent_id,
            content=content,
        )
        return await repo.create(comment, flush=True)

    async def get_lesson_comment(
        self, session: AsyncSession, comment_id: UUID
    ) -> LessonComment | None:
        repo = LessonCommentRepository.from_session(session)
        return await repo.get_by_id(comment_id)

    async def delete_lesson_comment(
        self,
        session: AsyncSession,
        comment: LessonComment,
    ) -> None:
        repo = LessonCommentRepository.from_session(session)
        await repo.soft_delete(comment)

    # --- Flat lesson gating logic ---

    async def get_all_lessons_for_course(
        self, session: AsyncSession, course_id: UUID
    ) -> Sequence[CourseLesson]:
        """Get all lessons for a course, flattened across modules, ordered by position."""
        lesson_repo = CourseLessonRepository.from_session(session)
        statement = lesson_repo.get_by_course_statement(course_id)
        return await lesson_repo.get_all(statement)

    async def get_first_free_lesson(
        self, session: AsyncSession, course_id: UUID
    ) -> CourseLesson | None:
        """Get the first lesson marked as free preview (trailer) for a course."""
        lesson_repo = CourseLessonRepository.from_session(session)
        statement = (
            lesson_repo.get_by_course_statement(course_id)
            .where(CourseLesson.is_free_preview == True)
            .limit(1)
        )
        return await lesson_repo.get_one_or_none(statement)

    def calculate_lesson_accessibility(
        self,
        lesson: CourseLesson,
        paywall_position: int | None,
        enrolled_at: datetime,
        now: datetime,
    ) -> tuple[bool, datetime | None]:
        """Calculate if a lesson is accessible given paywall/drip settings.

        Returns (is_accessible, locked_until_timestamp).
        Accessibility rules:
        - Trailer (is_free_preview=true): always accessible
        - Non-trailer + enrolled: check paywall position and drip schedule
        - Non-trailer + not enrolled: only accessible if is_free_preview=true

        Note: Enrollment status is handled by caller (this assumes enrolled=True).
        """
        # Free previews (trailers) are always accessible
        if lesson.is_free_preview:
            return True, None

        # Check paywall: lesson at position >= paywall_position is locked
        if paywall_position is not None and lesson.position >= paywall_position:
            return False, None

        # Check drip: release_at or drip_days
        locked_until = None
        if lesson.release_at and now < lesson.release_at:
            return False, lesson.release_at
        if lesson.drip_days is not None:
            from datetime import timedelta
            unlock_at = enrolled_at + timedelta(days=lesson.drip_days)
            if now < unlock_at:
                return False, unlock_at

        return True, None


course_service = CourseService()
