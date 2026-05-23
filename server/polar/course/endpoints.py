import hashlib
import json
import logging
from uuid import UUID, uuid4

from fastapi import Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select

from polar.auth.models import is_organization, is_user
from polar.customer.repository import CustomerRepository
from polar.customer_session.service import customer_session
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.models import Organization, UserOrganization
from polar.models.course_lesson import CourseLesson
from polar.models.customer import Customer
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, get_db_session
from polar.quotas.definitions import QuotaKey
from polar.quotas.exceptions import QuotaExceededError
from polar.quotas.producers import emit_video_uploaded, enforce
from polar.routing import APIRouter

from . import auth
from . import mux as mux_client
from .repository import (
    CourseLessonRepository,
    CourseModuleRepository,
    CourseRepository,
)
from .schemas import (
    CourseCreate,
    CourseEnrollmentCustomer,
    CourseEnrollmentRead,
    CourseLessonCreate,
    CourseLessonRead,
    CourseLessonUpdate,
    CourseModuleCreate,
    CourseModuleRead,
    CourseModuleUpdate,
    CourseRead,
    CourseUpdate,
    MuxUploadRead,
    ReorderRequest,
)
from .service import course_service

log = logging.getLogger(__name__)

router = APIRouter(
    prefix="/courses",
    tags=["courses", APITag.private],
)

# Conservative projected duration used when reserving quota at upload-
# initiate time. Mux returns the real duration in the webhook later;
# this number is just a guard against "upload-initiate always passes
# because we passed requested_storage_units=0". 10 minutes sits at the
# 95th percentile of lesson length we see in practice.
_ESTIMATED_LESSON_SECONDS = 600


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
        thumbnail_url=lesson.thumbnail_url,
        description=getattr(lesson, "description", None),
        release_at=getattr(lesson, "release_at", None),
        drip_days=getattr(lesson, "drip_days", None),
        comments_mode=getattr(lesson, "comments_mode", "visible"),
        thumbnail_object_position=getattr(
            lesson, "thumbnail_object_position", None
        ),
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
        lessons=[_lesson_read(lesson) for lesson in module.lessons],
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
        format=course.format,
        paywall_enabled=course.paywall_enabled,
        paywall_lesson_id=course.paywall_lesson_id,
        paywall_position=course.paywall_position,
        ai_generated=course.ai_generated,
        description=course.description,
        thumbnail_url=course.thumbnail_url,
        thumbnail_object_position=course.thumbnail_object_position,
        instructor_name=course.instructor_name,
        instructor_bio=course.instructor_bio,
        trailer_url=course.trailer_url,
        instructor_name_italic=course.instructor_name_italic,
        instructor_name_bold=course.instructor_name_bold,
        instructor_name_uppercase=course.instructor_name_uppercase,
        landing_overrides=course.landing_overrides,
        sample=course.sample,
        modules=[_module_read(m) for m in course.modules],
        created_at=course.created_at,
        modified_at=course.modified_at,
    )


async def _user_in_org(session: AsyncSession, user_id: UUID, organization_id: UUID) -> bool:
    stmt = select(UserOrganization).where(
        UserOrganization.user_id == user_id,
        UserOrganization.organization_id == organization_id,
        UserOrganization.deleted_at.is_(None),
    )
    res = await session.execute(stmt)
    return res.first() is not None


@router.get("/organization/{organization_id}", response_model=list[CourseRead])
async def list_courses_by_organization(
    organization_id: UUID,
    auth_subject: auth.CoursesRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[CourseRead]:
    if is_organization(auth_subject):
        if auth_subject.subject.id != organization_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif is_user(auth_subject):
        if not await _user_in_org(session, auth_subject.subject.id, organization_id):
            raise HTTPException(status_code=403, detail="Forbidden")
    courses = await course_service.list_by_organization(session, organization_id)
    result = []
    for c in courses:
        try:
            result.append(_course_read(c))
        except Exception:
            log.exception(
                "course.list serialize failed",
                extra={"course_id": str(c.id)},
            )
            # Skip this course rather than 500 the entire list
            continue
    return result


@router.get("/product/{product_id}", response_model=CourseRead)
async def get_course_by_product(
    product_id: UUID,
    auth_subject: auth.CoursesRead,
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    course = await course_service.get_by_product(session, product_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    repo = CourseRepository.from_session(session)
    if await repo.get_readable_by_id(course.id, auth_subject) is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_read(course)


@router.get("/{course_id}", response_model=CourseRead)
async def get_course(
    course_id: UUID,
    auth_subject: auth.CoursesRead,
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return _course_read(course)


@router.post("/", response_model=CourseRead, status_code=201)
async def create_course(
    course_create: CourseCreate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    if is_organization(auth_subject):
        if auth_subject.subject.id != course_create.organization_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif is_user(auth_subject):
        if not await _user_in_org(
            session, auth_subject.subject.id, course_create.organization_id
        ):
            raise HTTPException(status_code=403, detail="Forbidden")
    try:
        course = await course_service.create(session, course_create)
        return _course_read(course)
    except Exception:
        log.exception(
            "course.create failed",
            extra={
                "product_id": str(course_create.product_id),
                "organization_id": str(course_create.organization_id),
                "module_count": len(course_create.modules),
            },
        )
        raise


@router.patch("/{course_id}", response_model=CourseRead)
async def update_course(
    course_id: UUID,
    course_update: CourseUpdate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    if course_update.landing_overrides is not None:
        media = course_update.landing_overrides.get("media") or {}
        log.info(
            "course.update landing_overrides.media",
            extra={
                "course_id": str(course_id),
                "media_slot_ids": sorted(media.keys()),
                "media_count": len(media),
            },
        )
    course = await course_service.update(session, course, course_update)
    return _course_read(course)


@router.post("/{course_id}/modules", response_model=CourseModuleRead, status_code=201)
async def add_module(
    course_id: UUID,
    module_create: CourseModuleCreate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseModuleRead:
    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    module = await course_service.add_module(session, course, module_create)
    return _module_read(module)


@router.patch("/modules/{module_id}", response_model=CourseModuleRead)
async def update_module(
    module_id: UUID,
    module_update: CourseModuleUpdate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseModuleRead:
    module_repo = CourseModuleRepository.from_session(session)
    module = await module_repo.get_readable_by_id(module_id, auth_subject)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    module = await course_service.update_module(session, module, module_update)
    return _module_read(module)


@router.post(
    "/{course_id}/apply-weekly-pacing",
    response_model=list[CourseModuleRead],
)
async def apply_weekly_pacing(
    course_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> list[CourseModuleRead]:
    """Bulk-set drip_days on every module: 0, 7, 14, 21 …. One request,
    one transaction — replaces the per-module PATCH loop the frontend
    used to do."""
    course_repo = CourseRepository.from_session(session)
    course = await course_repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    modules = await course_service.apply_weekly_pacing(session, course)
    return [_module_read(m) for m in modules]


@router.delete("/modules/{module_id}", status_code=204)
async def delete_module(
    module_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    module_repo = CourseModuleRepository.from_session(session)
    module = await module_repo.get_readable_by_id(module_id, auth_subject)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    await course_service.delete_module(session, module)


@router.post(
    "/modules/{module_id}/lessons", response_model=CourseLessonRead, status_code=201
)
async def add_lesson(
    module_id: UUID,
    lesson_create: CourseLessonCreate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseLessonRead:
    module_repo = CourseModuleRepository.from_session(session)
    module = await module_repo.get_readable_by_id(module_id, auth_subject)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    lesson = await course_service.add_lesson(session, module, lesson_create)
    return _lesson_read(lesson)


@router.patch("/lessons/{lesson_id}", response_model=CourseLessonRead)
async def update_lesson(
    lesson_id: UUID,
    lesson_update: CourseLessonUpdate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseLessonRead:
    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_readable_by_id(lesson_id, auth_subject)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson = await course_service.update_lesson(session, lesson, lesson_update)
    return _lesson_read(lesson)


@router.delete("/lessons/{lesson_id}", status_code=204)
async def delete_lesson(
    lesson_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_readable_by_id(lesson_id, auth_subject)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await course_service.delete_lesson(session, lesson)


@router.delete(
    "/lessons/{lesson_id}/video",
    response_model=CourseLessonRead,
    summary="Remove Lesson Video",
)
async def remove_lesson_video(
    lesson_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseLessonRead:
    """Detach the video asset from a lesson without deleting the lesson itself."""
    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_readable_by_id(lesson_id, auth_subject)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson = await course_service.clear_lesson_video(session, lesson)
    return _lesson_read(lesson)


@router.get(
    "/{course_id}/enrollments",
    response_model=ListResource[CourseEnrollmentRead],
)
async def list_course_enrollments(
    course_id: UUID,
    auth_subject: auth.CoursesRead,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[CourseEnrollmentRead]:
    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    enrollments, total = await course_service.paginate_enrollments_for_course(
        session,
        course_id,
        limit=pagination.limit,
        page=pagination.page,
    )
    customer_ids = {e.customer_id for e in enrollments}
    customers_by_id: dict[UUID, Customer] = {}
    if customer_ids:
        stmt = select(Customer).where(Customer.id.in_(customer_ids))
        result = await session.execute(stmt)
        for customer in result.scalars():
            customers_by_id[customer.id] = customer
    items: list[CourseEnrollmentRead] = []
    for e in enrollments:
        c = customers_by_id.get(e.customer_id)
        items.append(
            CourseEnrollmentRead(
                id=e.id,
                customer_id=e.customer_id,
                enrolled_at=e.enrolled_at,
                customer=(
                    CourseEnrollmentCustomer(
                        id=c.id,
                        email=c.email,
                        name=c.name,
                        avatar_url=getattr(c, "avatar_url", None),
                    )
                    if c is not None
                    else None
                ),
            )
        )
    return ListResource(
        items=items,
        pagination=Pagination(page=pagination.page, total_count=total),
    )


@router.delete("/{course_id}/enrollments/{enrollment_id}", status_code=204)
async def revoke_course_enrollment(
    course_id: UUID,
    enrollment_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    enrollment = await course_service.get_enrollment_by_id(session, enrollment_id)
    if enrollment is None or enrollment.course_id != course_id:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await course_service.revoke_enrollment(session, enrollment_id)


@router.post("/{course_id}/modules/reorder", response_model=CourseRead)
async def reorder_modules(
    course_id: UUID,
    payload: ReorderRequest,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    try:
        await course_service.reorder_modules(session, course, payload.ordered_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await session.refresh(course, attribute_names=["modules"])
    return _course_read(course)


@router.post("/modules/{module_id}/lessons/reorder", response_model=CourseModuleRead)
async def reorder_lessons(
    module_id: UUID,
    payload: ReorderRequest,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseModuleRead:
    module_repo = CourseModuleRepository.from_session(session)
    module = await module_repo.get_readable_by_id(module_id, auth_subject)
    if module is None:
        raise HTTPException(status_code=404, detail="Module not found")
    try:
        await course_service.reorder_lessons(session, module, payload.ordered_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await session.refresh(module, attribute_names=["lessons"])
    return _module_read(module)


# --- Mux video endpoints ---


@router.post(
    "/staging/mux-upload",
    response_model=MuxUploadRead,
    status_code=201,
    summary="Create Staged Mux Direct Upload",
)
async def create_staged_mux_upload(
    auth_subject: auth.CoursesWrite,
    organization_id: UUID,
    session: AsyncSession = Depends(get_db_session),
) -> MuxUploadRead:
    """Create a Mux direct upload that isn't yet attached to a lesson.

    Used by the create-course wizard so video upload can start the moment
    the user picks a file, before the course / lessons exist. The returned
    `upload_id` is later passed in `CourseLessonCreate.mux_upload_id` so the
    Mux webhook can attach the asset to the new lesson once it processes.
    """
    from polar.config import settings

    if not settings.MUX_TOKEN_ID or not settings.MUX_TOKEN_SECRET:
        raise HTTPException(status_code=503, detail="Mux not configured")

    # Org membership check — staging endpoint isn't gated by a course row
    # since no course exists yet.
    if is_organization(auth_subject):
        if auth_subject.subject.id != organization_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif is_user(auth_subject):
        if not await _user_in_org(
            session, auth_subject.subject.id, organization_id
        ):
            raise HTTPException(status_code=403, detail="Forbidden")

    # Same quota gate as the per-lesson endpoint — duration isn't known
    # until Mux processes the asset, so refuse new uploads outright once
    # the org's existing total exceeds the limit.
    org_repo = OrganizationRepository.from_session(session)
    organization = await org_repo.get_by_id(organization_id)
    if organization is not None:
        try:
            await enforce(
                session,
                organization,
                QuotaKey.video_hours_hosted,
                requested_storage_units=0,
            )
        except QuotaExceededError as exc:
            raise HTTPException(status_code=402, detail=exc.message) from exc

    try:
        result = await mux_client.create_direct_upload()
    except Exception as e:
        log.error("Staged Mux upload creation failed: %s", e)
        raise HTTPException(status_code=502, detail="Failed to create upload")

    return MuxUploadRead(
        upload_id=result["upload_id"],
        upload_url=result["upload_url"],
    )


@router.post(
    "/staging/media",
    summary="Upload Staging Media (returns URL only)",
)
async def upload_staged_media(
    auth_subject: auth.CoursesWrite,
    organization_id: UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Upload an image or video to S3 before the course exists.

    Returns `{url, kind}`. Used by the create-course wizard for course
    thumbnail / trailer / landing slot media so upload can start the
    moment the user picks a file. The returned URL is then passed into
    the course-create payload (thumbnail_url, trailer_url, or stored on
    landing_overrides.media).
    """
    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service

    if is_organization(auth_subject):
        if auth_subject.subject.id != organization_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif is_user(auth_subject):
        if not await _user_in_org(
            session, auth_subject.subject.id, organization_id
        ):
            raise HTTPException(status_code=403, detail="Forbidden")

    content_type = file.content_type or "application/octet-stream"
    is_image = content_type.startswith("image/")
    is_video = content_type.startswith("video/")
    if not (is_image or is_video):
        raise HTTPException(
            status_code=400, detail="File must be an image or video"
        )

    data = await file.read()
    max_bytes = (500 if is_video else 10) * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File must be under {max_bytes // (1024 * 1024)} MB",
        )

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if not ext or "/" in ext:
        ext = "mp4" if is_video else "jpg"

    path = f"course-staging/{organization_id}/{uuid4().hex}.{ext}"
    s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
    s3.upload(data, path, content_type)
    public_url = s3.get_public_url(path)
    return {"url": public_url, "kind": "video" if is_video else "image"}


@router.post(
    "/lessons/{lesson_id}/mux-upload",
    response_model=MuxUploadRead,
    status_code=201,
    summary="Create Mux Direct Upload",
)
async def create_mux_upload(
    lesson_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> MuxUploadRead:
    """Create a Mux direct upload URL for a lesson video.

    The client should PUT the video file directly to the returned upload_url.
    Mux will call the webhook once the asset is ready.
    """
    from polar.config import settings

    if not settings.MUX_TOKEN_ID or not settings.MUX_TOKEN_SECRET:
        raise HTTPException(status_code=503, detail="Mux not configured")

    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_readable_by_id(lesson_id, auth_subject)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Block new uploads if the org would exceed its video-hours cap.
    # The actual duration isn't known until Mux processes the asset, so
    # we project against a conservative 10-minute estimate — that's at
    # the upper end of a typical short lesson and ensures the cap holds
    # for normal content. Once Mux reports the real duration in the
    # webhook handler we run the check again with the precise value
    # and flip the lesson to `quota_exceeded` if it pushes past the
    # grace ceiling, so a single oversized upload can't blow through
    # the limit either.
    organization_id = await lesson_repo.get_organization_id_for_lesson(lesson.id)
    if organization_id is not None:
        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_id(organization_id)
        if organization is not None:
            try:
                await enforce(
                    session,
                    organization,
                    QuotaKey.video_hours_hosted,
                    requested_storage_units=_ESTIMATED_LESSON_SECONDS,
                )
            except QuotaExceededError as exc:
                raise HTTPException(
                    status_code=402, detail=exc.message
                ) from exc

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
    "/lessons/{lesson_id}/thumbnail",
    response_model=CourseLessonRead,
    summary="Upload Lesson Thumbnail",
)
async def upload_lesson_thumbnail(
    lesson_id: UUID,
    auth_subject: auth.CoursesWrite,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> CourseLessonRead:
    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service

    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_readable_by_id(lesson_id, auth_subject)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 10 MB")

    ext = (file.filename or "thumbnail.jpg").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"

    # Content-addressed path so re-uploading a new image yields a fresh URL
    # — without this the studio kept showing the previous thumbnail because
    # the browser cached the bytes under an unchanging URL.
    digest = hashlib.sha256(data).hexdigest()[:12]
    path = f"course-thumbnails/{lesson_id}/{digest}.{ext}"
    s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
    s3.upload(data, path, content_type)
    thumbnail_url = s3.get_public_url(path)

    lesson = await lesson_repo.update(lesson, update_dict={"thumbnail_url": thumbnail_url})
    return _lesson_read(lesson)


@router.post(
    "/{course_id}/thumbnail",
    response_model=CourseRead,
    summary="Upload Course Thumbnail",
)
async def upload_course_thumbnail(
    course_id: UUID,
    auth_subject: auth.CoursesWrite,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service

    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 10 MB")

    ext = (file.filename or "thumbnail.jpg").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"

    # Content-addressed path so re-uploading a new image yields a fresh URL
    # — see upload_lesson_thumbnail.
    digest = hashlib.sha256(data).hexdigest()[:12]
    path = f"course-thumbnails/courses/{course_id}/{digest}.{ext}"
    s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
    s3.upload(data, path, content_type)
    thumbnail_url = s3.get_public_url(path)

    course = await repo.update(course, update_dict={"thumbnail_url": thumbnail_url})
    return _course_read(course)


@router.post(
    "/{course_id}/trailer",
    response_model=CourseRead,
    summary="Upload Course Trailer",
)
async def upload_course_trailer(
    course_id: UUID,
    auth_subject: auth.CoursesWrite,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> CourseRead:
    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service

    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    content_type = file.content_type or "video/mp4"
    if not content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    data = await file.read()
    if len(data) > 500 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Trailer must be under 500 MB")

    ext = (file.filename or "trailer.mp4").rsplit(".", 1)[-1].lower()
    if ext not in {"mp4", "mov", "webm", "m4v"}:
        ext = "mp4"

    path = f"course-trailers/{course_id}.{ext}"
    s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
    s3.upload(data, path, content_type)
    trailer_url = s3.get_public_url(path)

    course = await repo.update(course, update_dict={"trailer_url": trailer_url})
    return _course_read(course)


@router.post(
    "/{course_id}/landing-media",
    summary="Upload Landing Media (returns URL only)",
)
async def upload_course_landing_media(
    course_id: UUID,
    auth_subject: auth.CoursesWrite,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service
    from uuid import uuid4

    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    content_type = file.content_type or "application/octet-stream"
    is_image = content_type.startswith("image/")
    is_video = content_type.startswith("video/")
    if not (is_image or is_video):
        raise HTTPException(
            status_code=400, detail="File must be an image or video"
        )

    data = await file.read()
    max_bytes = (500 if is_video else 10) * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File must be under {max_bytes // (1024 * 1024)} MB",
        )

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if not ext or "/" in ext:
        ext = "mp4" if is_video else "jpg"

    path = f"course-landing-media/{course_id}/{uuid4().hex}.{ext}"
    s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
    s3.upload(data, path, content_type)
    public_url = s3.get_public_url(path)
    log.info(
        "course.landing_media uploaded",
        extra={
            "course_id": str(course_id),
            "bucket": settings.S3_FILES_PUBLIC_BUCKET_NAME,
            "path": path,
            "content_type": content_type,
            "size_bytes": len(data),
            "public_url": public_url,
            "kind": "video" if is_video else "image",
        },
    )
    return {"url": public_url, "kind": "video" if is_video else "image"}


@router.post(
    "/lessons/{lesson_id}/attachments",
    response_model=CourseLessonRead,
    summary="Upload Lesson Attachment",
)
async def upload_lesson_attachment(
    lesson_id: UUID,
    auth_subject: auth.CoursesWrite,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> CourseLessonRead:
    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service

    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_readable_by_id(lesson_id, auth_subject)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    data = await file.read()
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File must be under 100 MB")

    attachment_id = str(uuid4())
    filename = file.filename or "attachment"
    safe_name = filename.replace("/", "_").replace("\\", "_")
    path = f"course-attachments/{lesson_id}/{attachment_id}/{safe_name}"
    content_type = file.content_type or "application/octet-stream"

    s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
    s3.upload(data, path, content_type)
    url = s3.get_public_url(path)

    attachment = {
        "id": attachment_id,
        "filename": safe_name,
        "url": url,
        "size": len(data),
        "content_type": content_type,
        "path": path,
    }

    content = dict(lesson.content or {})
    attachments = list(content.get("attachments") or [])
    attachments.append(attachment)
    content["attachments"] = attachments

    lesson = await lesson_repo.update(lesson, update_dict={"content": content})
    return _lesson_read(lesson)


@router.delete(
    "/lessons/{lesson_id}/attachments/{attachment_id}",
    response_model=CourseLessonRead,
    summary="Delete Lesson Attachment",
)
async def delete_lesson_attachment(
    lesson_id: UUID,
    attachment_id: str,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseLessonRead:
    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service

    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_readable_by_id(lesson_id, auth_subject)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    content = dict(lesson.content or {})
    attachments = list(content.get("attachments") or [])
    target = next((a for a in attachments if a.get("id") == attachment_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if target.get("path"):
        try:
            s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
            s3.delete_file(target["path"])
        except Exception as e:
            log.warning("Failed to delete attachment from S3: %s", e)

    content["attachments"] = [a for a in attachments if a.get("id") != attachment_id]
    lesson = await lesson_repo.update(lesson, update_dict={"content": content})
    return _lesson_read(lesson)


@router.post(
    "/{course_id}/preview-access",
    summary="Get Preview Access Token",
    response_model=dict[str, str],
)
async def get_preview_access(
    course_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """Create a customer session for an org member to preview a course as a student."""
    if not is_user(auth_subject):
        raise HTTPException(status_code=400, detail="Preview requires user authentication")

    user = auth_subject.subject

    course_repo = CourseRepository.from_session(session)
    stmt = course_repo.get_base_statement().where(
        course_repo.model.id == course_id
    )
    course = await course_repo.get_one_or_none(stmt)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    if not await _user_in_org(session, user.id, course.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")

    org = await session.get(Organization, course.organization_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    customer_repo = CustomerRepository.from_session(session)
    # Use a deterministic preview-only email tied to the org user, NOT the
    # user's real email. Reusing a real customer record by email would mint
    # a customer-session token that also unlocks that customer's other
    # purchases / orders / PII — so we route every preview through a
    # sandboxed customer scoped to (org_user, organization) instead.
    # The .invalid TLD is RFC-reserved and guaranteed to never match a
    # real address, so this can't collide with checkout-created customers.
    preview_email = f"preview+{user.id}@course-preview.invalid"
    customer = await customer_repo.get_by_email_and_organization(
        preview_email, course.organization_id
    )
    if customer is None:
        customer = await customer_repo.create(
            Customer(
                email=preview_email,
                name=f"{user.email.split('@')[0]} (preview)",
                organization_id=course.organization_id,
            ),
            flush=True,
        )

    await course_service.enroll_customer(
        session, course_id=course_id, customer=customer
    )

    token, _ = await customer_session.create_customer_session(
        session, customer
    )

    portal_url = f"/{org.slug}/portal/courses/{course_id}?customer_session_token={token}"
    return {"token": token, "portal_url": portal_url}


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
                # Only emit on first transition to ready, so retried
                # webhooks don't double-count the same asset.
                previously_ready = lesson.mux_status == "ready"
                organization_id = (
                    await lesson_repo.get_organization_id_for_lesson(lesson.id)
                    if not previously_ready and duration
                    else None
                )

                # Post-completion quota check: now that Mux has told us
                # the real duration, see if adding it would push the org
                # past their video-hours grace ceiling. The upload-
                # initiate check was a conservative estimate; this is
                # the definitive value. If it exceeds, flip the lesson
                # to `quota_exceeded` instead of `ready` and skip the
                # count emit — the asset stays on Mux but the
                # customer-portal playback-url endpoint will refuse to
                # mint a URL for it until the creator upgrades or
                # deletes other content.
                target_status = "ready"
                if organization_id is not None:
                    org_repo = OrganizationRepository.from_session(session)
                    organization = await org_repo.get_by_id(organization_id)
                    if organization is not None:
                        from polar.quotas.service import quotas as _quotas

                        check = await _quotas.check(
                            session,
                            organization.id,
                            QuotaKey.video_hours_hosted,
                            requested_storage_units=int(duration),
                        )
                        if not check.allowed:
                            target_status = "quota_exceeded"
                            log.warning(
                                "course.upload.over_quota",
                                organization_id=str(organization.id),
                                lesson_id=str(lesson.id),
                                duration_seconds=int(duration),
                                used=check.used,
                                limit=check.limit,
                            )

                update: dict = {
                    "mux_asset_id": asset_id,
                    "mux_playback_id": playback_id,
                    "mux_status": target_status,
                }
                if duration:
                    update["duration_seconds"] = int(duration)
                await lesson_repo.update(lesson, update_dict=update)

                if (
                    not previously_ready
                    and duration
                    and organization_id is not None
                    and target_status == "ready"
                ):
                    emit_video_uploaded(
                        session,
                        organization_id=organization_id,
                        duration_seconds=int(duration),
                    )

    elif event_type in ("video.upload.errored", "video.asset.errored"):
        upload_id = data.get("upload_id") or data.get("id")
        if upload_id:
            lesson = await _find_lesson_by_upload(upload_id)
            if lesson:
                await lesson_repo.update(
                    lesson, update_dict={"mux_status": "errored"}
                )

    elif event_type in (
        "video.asset.created",
        "video.upload.asset_created",
        "video.asset.preparing",
    ):
        upload_id = data.get("upload_id") or data.get("id")
        if upload_id:
            lesson = await _find_lesson_by_upload(upload_id)
            if lesson and lesson.mux_status != "ready":
                await lesson_repo.update(
                    lesson, update_dict={"mux_status": "processing"}
                )

    elif event_type == "video.asset.deleted":
        upload_id = data.get("upload_id")
        if upload_id:
            lesson = await _find_lesson_by_upload(upload_id)
            if lesson:
                previous_duration = lesson.duration_seconds
                previously_ready = lesson.mux_status == "ready"
                await lesson_repo.update(
                    lesson,
                    update_dict={
                        "mux_status": "deleted",
                        "mux_playback_id": None,
                        "mux_asset_id": None,
                    },
                )
                # Free up the org's video-hours quota. Only emit if the
                # asset had reached ready (i.e. its duration had been
                # counted in the first place).
                if previously_ready and previous_duration:
                    organization_id = (
                        await lesson_repo.get_organization_id_for_lesson(
                            lesson.id
                        )
                    )
                    if organization_id is not None:
                        emit_video_uploaded(
                            session,
                            organization_id=organization_id,
                            duration_seconds=-int(previous_duration),
                        )
