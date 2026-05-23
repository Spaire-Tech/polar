"""Creator-side endpoints for course broadcasts.

Phase 3 of "Spaire Experiences" — gives the creator a cohort voice. The
student-side feed lives separately under `polar/customer_portal/endpoints/`
and is wired up in Day 3.
"""

from datetime import datetime
from uuid import UUID

from fastapi import Depends
from pydantic import Field

from polar.course.repository import CourseRepository
from polar.exceptions import ResourceNotFound
from polar.kit.schemas import Schema
from polar.models.course_broadcast import CourseBroadcast
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .repository import BroadcastRepository
from .schemas import BroadcastCreate, BroadcastRead, BroadcastUpdate
from .service import broadcast as broadcast_service

router = APIRouter(
    prefix="/courses",
    tags=["course_broadcast", APITag.private],
)


# ── Serializers ─────────────────────────────────────────────────────────


def _to_read(
    b: CourseBroadcast,
    *,
    author_display_name: str | None = None,
) -> BroadcastRead:
    return BroadcastRead(
        id=b.id,
        course_id=b.course_id,
        created_by_user_id=b.created_by_user_id,
        title=b.title,
        body=b.body,
        image_url=b.image_url,
        week_number=b.week_number,
        notify_on_publish=b.notify_on_publish,
        scheduled_at=b.scheduled_at,
        published_at=b.published_at,
        author_display_name=author_display_name,
        created_at=b.created_at,
        modified_at=b.modified_at,
    )


# ── Routes ──────────────────────────────────────────────────────────────


@router.get(
    "/{course_id}/broadcasts",
    response_model=list[BroadcastRead],
)
async def list_broadcasts(
    course_id: UUID,
    auth_subject: auth.CoursesRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[BroadcastRead]:
    course = await CourseRepository.from_session(session).get_readable_by_id(
        course_id, auth_subject
    )
    if course is None:
        raise ResourceNotFound("Course not found")
    broadcasts = await broadcast_service.list_for_course(session, course)
    name_by_id = await broadcast_service.resolve_author_names(
        session, broadcasts
    )
    return [
        _to_read(
            b,
            author_display_name=(
                name_by_id.get(b.created_by_user_id)
                if b.created_by_user_id
                else None
            ),
        )
        for b in broadcasts
    ]


@router.post(
    "/{course_id}/broadcasts",
    response_model=BroadcastRead,
    status_code=201,
)
async def create_broadcast(
    course_id: UUID,
    payload: BroadcastCreate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BroadcastRead:
    # Path course_id is the source of truth — body's is informational +
    # gets overridden so a creator can't craft a request that creates a
    # broadcast under a different course they can also read.
    payload = payload.model_copy(update={"course_id": course_id})
    b = await broadcast_service.create(session, auth_subject, payload)
    name_by_id = await broadcast_service.resolve_author_names(session, [b])
    return _to_read(
        b,
        author_display_name=(
            name_by_id.get(b.created_by_user_id)
            if b.created_by_user_id
            else None
        ),
    )


async def _load_writable(
    broadcast_id: UUID,
    auth_subject,
    session: AsyncSession,
) -> CourseBroadcast:
    repo = BroadcastRepository.from_session(session)
    b = await repo.get_readable_by_id(broadcast_id, auth_subject)
    if b is None:
        raise ResourceNotFound("Broadcast not found")
    return b


@router.patch(
    "/broadcasts/{broadcast_id}",
    response_model=BroadcastRead,
)
async def update_broadcast(
    broadcast_id: UUID,
    payload: BroadcastUpdate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BroadcastRead:
    b = await _load_writable(broadcast_id, auth_subject, session)
    b = await broadcast_service.update(session, b, payload)
    name_by_id = await broadcast_service.resolve_author_names(session, [b])
    return _to_read(
        b,
        author_display_name=(
            name_by_id.get(b.created_by_user_id)
            if b.created_by_user_id
            else None
        ),
    )


@router.post(
    "/broadcasts/{broadcast_id}/publish",
    response_model=BroadcastRead,
)
async def publish_broadcast(
    broadcast_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BroadcastRead:
    b = await _load_writable(broadcast_id, auth_subject, session)
    b = await broadcast_service.publish(session, b)
    name_by_id = await broadcast_service.resolve_author_names(session, [b])
    return _to_read(
        b,
        author_display_name=(
            name_by_id.get(b.created_by_user_id)
            if b.created_by_user_id
            else None
        ),
    )


@router.post(
    "/broadcasts/{broadcast_id}/unpublish",
    response_model=BroadcastRead,
)
async def unpublish_broadcast(
    broadcast_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BroadcastRead:
    b = await _load_writable(broadcast_id, auth_subject, session)
    b = await broadcast_service.unpublish(session, b)
    name_by_id = await broadcast_service.resolve_author_names(session, [b])
    return _to_read(
        b,
        author_display_name=(
            name_by_id.get(b.created_by_user_id)
            if b.created_by_user_id
            else None
        ),
    )


class BroadcastScheduleRequest(Schema):
    scheduled_at: datetime = Field(
        description=(
            "When the broadcast should auto-publish. Must be in the "
            "future; values in the past are rejected with a 422 so the "
            "creator gets an immediate error instead of silently "
            "publishing at the next cron tick."
        )
    )


@router.post(
    "/broadcasts/{broadcast_id}/schedule",
    response_model=BroadcastRead,
)
async def schedule_broadcast(
    broadcast_id: UUID,
    payload: BroadcastScheduleRequest,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> BroadcastRead:
    # Future-time validation lives in BroadcastService._ensure_future
    # so this endpoint and PATCH share one guardrail and one error
    # shape — no duplicated past/future check on the endpoint level.
    b = await _load_writable(broadcast_id, auth_subject, session)
    b = await broadcast_service.schedule(session, b, payload.scheduled_at)
    name_by_id = await broadcast_service.resolve_author_names(session, [b])
    return _to_read(
        b,
        author_display_name=(
            name_by_id.get(b.created_by_user_id)
            if b.created_by_user_id
            else None
        ),
    )


@router.delete(
    "/broadcasts/{broadcast_id}",
    status_code=204,
)
async def delete_broadcast(
    broadcast_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    b = await _load_writable(broadcast_id, auth_subject, session)
    await broadcast_service.delete(session, b)


# ── Creator image upload presign ────────────────────────────────────────
#
# Mirrors the challenge-thumbnail presign: same shape, different prefix
# so broadcasts lifecycle independently of challenge thumbnails. Image
# is optional — text-only broadcasts skip this whole flow.

import uuid as _uuid  # noqa: E402

from fastapi import HTTPException  # noqa: E402
from pydantic import Field as _Field  # noqa: E402

from polar.config import settings as _settings  # noqa: E402
from polar.file.s3 import S3_SERVICES as _S3_SERVICES  # noqa: E402
from polar.kit.schemas import Schema as _Schema  # noqa: E402
from polar.models.file import FileServiceTypes as _FileServiceTypes  # noqa: E402


_ALLOWED_BROADCAST_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
_MAX_BROADCAST_BYTES = 10 * 1024 * 1024


class BroadcastImageUploadRequest(_Schema):
    filename: str = _Field(min_length=1, max_length=200)
    content_type: str
    content_length: int = _Field(ge=1, le=_MAX_BROADCAST_BYTES)


class BroadcastImageUploadResponse(_Schema):
    upload_url: str
    public_url: str


@router.post(
    "/broadcasts/image-uploads",
    response_model=BroadcastImageUploadResponse,
    summary="Presign Broadcast Image Upload",
)
async def create_broadcast_image_upload_url(
    payload: BroadcastImageUploadRequest,
    auth_subject: auth.CoursesWrite,
) -> BroadcastImageUploadResponse:
    """Single-shot presigned PUT for the optional broadcast cover image.
    Creator persists the returned `public_url` via PATCH /broadcasts/{id}.
    """
    if payload.content_type not in _ALLOWED_BROADCAST_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WebP images are supported.",
        )

    ext = (
        payload.filename.rsplit(".", 1)[-1].lower()
        if "." in payload.filename
        else "bin"
    )[:8]
    key = f"course-broadcast-images/{_uuid.uuid4()}.{ext}"

    s3 = _S3_SERVICES[_FileServiceTypes.product_media]
    upload_url: str = s3.client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": s3.bucket,
            "Key": key,
            "ContentType": payload.content_type,
        },
        ExpiresIn=_settings.S3_FILES_PRESIGN_TTL,
    )
    return BroadcastImageUploadResponse(
        upload_url=upload_url, public_url=s3.get_public_url(key)
    )
