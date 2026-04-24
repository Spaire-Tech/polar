from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from polar.models.course import Course
from polar.models.course_lesson import CourseLesson
from polar.models.course_module import CourseModule

from .repository import CourseLessonRepository, CourseModuleRepository, CourseRepository
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
        )

        for mod_schema in create_schema.modules:
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

        return await repo.create(course, flush=True)

    async def update(
        self,
        session: AsyncSession,
        course: Course,
        update_schema: CourseUpdate,
    ) -> Course:
        repo = CourseRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True, exclude_none=True)
        return await repo.update(course, update_dict)

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

        return await module_repo.create(module, flush=True)

    async def update_module(
        self,
        session: AsyncSession,
        module: CourseModule,
        update_schema: CourseModuleUpdate,
    ) -> CourseModule:
        module_repo = CourseModuleRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True, exclude_none=True)
        return await module_repo.update(module, update_dict)

    async def get_module_by_id(
        self, session: AsyncSession, module_id: UUID
    ) -> CourseModule | None:
        module_repo = CourseModuleRepository.from_session(session)
        return await module_repo.get_by_id(module_id)

    async def delete_module(
        self, session: AsyncSession, module: CourseModule
    ) -> None:
        module_repo = CourseModuleRepository.from_session(session)
        module.set_deleted_at()
        await module_repo.update(module, {"deleted_at": module.deleted_at})

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
            )
        )

    async def update_lesson(
        self,
        session: AsyncSession,
        lesson: CourseLesson,
        update_schema: CourseLessonUpdate,
    ) -> CourseLesson:
        lesson_repo = CourseLessonRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True, exclude_none=True)
        return await lesson_repo.update(lesson, update_dict)

    async def get_lesson_by_id(
        self, session: AsyncSession, lesson_id: UUID
    ) -> CourseLesson | None:
        lesson_repo = CourseLessonRepository.from_session(session)
        return await lesson_repo.get_by_id(lesson_id)

    async def delete_lesson(
        self, session: AsyncSession, lesson: CourseLesson
    ) -> None:
        lesson_repo = CourseLessonRepository.from_session(session)
        lesson.set_deleted_at()
        await lesson_repo.update(lesson, {"deleted_at": lesson.deleted_at})


course_service = CourseService()
