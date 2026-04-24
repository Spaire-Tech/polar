import json
import logging
from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select

from polar.models.course_lesson import CourseLesson
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import mux as mux_client
from .repository import CourseLessonRepository
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
    MuxUploadRead,
)
from .service import course_service

log = logging.getLogger(__name__)

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
        published=lesson.published,
        mux_upload_id=lesson.mux_upload_id,
        mux_asset_id=lesson.mux_asset_id,
        mux_playback_id=lesson.mux_playback_id,
        mux_status=lesson.mux_status,
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
        status=module.status,
        release_at=module.release_at,
        drip_days=module.drip_days,
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
        slug=course.slug,
        course_type=course.course_type,
        paywall_enabled=course.paywall_enabled,
        paywall_lesson_id=course.paywall_lesson_id,
        paywall_position=course.paywall_position,
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


# --- Mux video endpoints ---


@router.post(
    "/lessons/{lesson_id}/mux-upload",
    response_model=MuxUploadRead,
    status_code=201,
    summary="Create Mux Direct Upload",
)
async def create_mux_upload(
    lesson_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> MuxUploadRead:
    """Create a Mux direct upload URL for a lesson video.

    The client should PUT the video file directly to the returned upload_url.
    Mux will call the webhook once the asset is ready.
    """
    from polar.config import settings

    if not settings.MUX_TOKEN_ID or not settings.MUX_TOKEN_SECRET:
        raise HTTPException(status_code=503, detail="Mux not configured")

    lesson = await course_service.get_lesson_by_id(session, lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    try:
        result = await mux_client.create_direct_upload()
    except Exception as e:
        log.error("Mux upload creation failed: %s", e)
        raise HTTPException(status_code=502, detail="Failed to create upload")

    lesson_repo = CourseLessonRepository.from_session(session)
    await lesson_repo.update(
        lesson,
        update_dict={
            "mux_upload_id": result["upload_id"],
            "mux_status": "waiting",
            "content_type": "video",
        },
    )

    return MuxUploadRead(
        upload_id=result["upload_id"],
        upload_url=result["upload_url"],
    )


@router.post(
    "/mux/webhook",
    status_code=204,
    summary="Mux Webhook",
    include_in_schema=False,
)
async def mux_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Handle Mux webhook events (video.asset.ready etc.)."""
    body = await request.body()
    sig_header = request.headers.get("mux-signature", "")

    if not mux_client.verify_webhook_signature(body, sig_header):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = json.loads(body)
    event_type = payload.get("type", "")
    data = payload.get("data", {})

    lesson_repo = CourseLessonRepository.from_session(session)

    async def _find_lesson_by_upload(upload_id: str) -> CourseLesson | None:
        stmt = select(CourseLesson).where(
            CourseLesson.mux_upload_id == upload_id,
            CourseLesson.deleted_at.is_(None),
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    if event_type == "video.asset.ready":
        upload_id = data.get("upload_id")
        asset_id = data.get("id")
        playback_ids = data.get("playback_ids", [])
        playback_id = playback_ids[0]["id"] if playback_ids else None
        duration = data.get("duration")

        if upload_id and asset_id and playback_id:
            lesson = await _find_lesson_by_upload(upload_id)
            if lesson:
                update: dict = {
                    "mux_asset_id": asset_id,
                    "mux_playback_id": playback_id,
                    "mux_status": "ready",
                }
                if duration:
                    update["duration_seconds"] = int(duration)
                await lesson_repo.update(lesson, update_dict=update)

    elif event_type in ("video.upload.errored", "video.asset.errored"):
        upload_id = data.get("upload_id") or data.get("id")
        if upload_id:
            lesson = await _find_lesson_by_upload(upload_id)
            if lesson:
                await lesson_repo.update(
                    lesson, update_dict={"mux_status": "errored"}
                )
