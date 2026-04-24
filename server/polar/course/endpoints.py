from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends, HTTPException

from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import (
    CourseCreate,
    CourseLessonCreate,
    CourseLessonRead,
    CourseLessonUpdate,
    CourseModuleCreate,
    CourseModuleRead,
    CourseModuleUpdate,
    CourseRead,
    CourseUpdate,
)
from .service import course_service

router = APIRouter(
    prefix="/courses",
    tags=["courses", APITag.private],
)


def _lesson_read(lesson) -> CourseLessonRead:
    return CourseLessonRead(
        id=lesson.id,
        module_id=lesson.module_id,
        title=lesson.title,
        content_type=lesson.content_type,
        content=lesson.content,
        video_asset_id=lesson.video_asset_id,
        duration_seconds=lesson.duration_seconds,
        position=lesson.position,
        is_free_preview=lesson.is_free_preview,
        created_at=lesson.created_at,
        modified_at=lesson.modified_at,
    )


def _module_read(module) -> CourseModuleRead:
    return CourseModuleRead(
        id=module.id,
        course_id=module.course_id,
        title=module.title,
        description=module.description,
        position=module.position,
        lessons=[_lesson_read(l) for l in module.lessons],
        created_at=module.created_at,
        modified_at=module.modified_at,
    )


def _course_read(course) -> CourseRead:
    return CourseRead(
        id=course.id,
        product_id=course.product_id,
        organization_id=course.organization_id,
        title=course.title,
        course_type=course.course_type,
        paywall_enabled=course.paywall_enabled,
        paywall_lesson_id=course.paywall_lesson_id,
        ai_generated=course.ai_generated,
        modules=[_module_read(m) for m in course.modules],
        created_at=course.created_at,
        modified_at=course.modified_at,
    )


@router.get("/organization/{organization_id}", response_model=list[CourseRead])
async def list_courses_by_organization(
    organization_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> list[CourseRead]:
    courses = await course_service.list_by_organization(session, organization_id)
    return [_course_read(c) for c in courses]


@router.get("/product/{product_id}", response_model=CourseRead)
async def get_course_by_product(
    product_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    course = await course_service.get_by_product(session, product_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_read(course)


@router.get("/{course_id}", response_model=CourseRead)
async def get_course(
    course_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    course = await course_service.get_by_id(session, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_read(course)


@router.post("/", response_model=CourseRead, status_code=201)
async def create_course(
    course_create: CourseCreate,
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    course = await course_service.create(session, course_create)
    return _course_read(course)


@router.patch("/{course_id}", response_model=CourseRead)
async def update_course(
    course_id: UUID,
    course_update: CourseUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    course = await course_service.get_by_id(session, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    course = await course_service.update(session, course, course_update)
    return _course_read(course)


@router.post("/{course_id}/modules", response_model=CourseModuleRead, status_code=201)
async def add_module(
    course_id: UUID,
    module_create: CourseModuleCreate,
    session: AsyncSession = Depends(get_db_session),
) -> CourseModuleRead:
    course = await course_service.get_by_id(session, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    module = await course_service.add_module(session, course, module_create)
    return _module_read(module)


@router.patch("/modules/{module_id}", response_model=CourseModuleRead)
async def update_module(
    module_id: UUID,
    module_update: CourseModuleUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> CourseModuleRead:
    module = await course_service.get_module_by_id(session, module_id)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    module = await course_service.update_module(session, module, module_update)
    return _module_read(module)


@router.delete("/modules/{module_id}", status_code=204)
async def delete_module(
    module_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    module = await course_service.get_module_by_id(session, module_id)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    await course_service.delete_module(session, module)


@router.post(
    "/modules/{module_id}/lessons", response_model=CourseLessonRead, status_code=201
)
async def add_lesson(
    module_id: UUID,
    lesson_create: CourseLessonCreate,
    session: AsyncSession = Depends(get_db_session),
) -> CourseLessonRead:
    module = await course_service.get_module_by_id(session, module_id)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    lesson = await course_service.add_lesson(session, module, lesson_create)
    return _lesson_read(lesson)


@router.patch("/lessons/{lesson_id}", response_model=CourseLessonRead)
async def update_lesson(
    lesson_id: UUID,
    lesson_update: CourseLessonUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> CourseLessonRead:
    lesson = await course_service.get_lesson_by_id(session, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson = await course_service.update_lesson(session, lesson, lesson_update)
    return _lesson_read(lesson)


@router.delete("/lessons/{lesson_id}", status_code=204)
async def delete_lesson(
    lesson_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    lesson = await course_service.get_lesson_by_id(session, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await course_service.delete_lesson(session, lesson)
