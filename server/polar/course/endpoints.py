import json
import logging
from uuid import UUID, uuid4

from fastapi import Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select

from polar.auth.models import is_organization, is_user
from polar.customer.repository import CustomerRepository
from polar.customer_session.service import customer_session
from polar.models import Organization, UserOrganization
from polar.models.course_lesson import CourseLesson
from polar.models.customer import Customer
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
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

    path = f"course-thumbnails/{lesson_id}.{ext}"
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

    path = f"course-thumbnails/courses/{course_id}.{ext}"
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
    customer = await customer_repo.get_by_email_and_organization(
        user.email, course.organization_id
    )
    if customer is None:
        customer = await customer_repo.create(
            Customer(
                email=user.email,
                name=user.email.split("@")[0],
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
