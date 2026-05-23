"""Creator-side endpoints for course broadcasts.

Phase 3 of "Spaire Experiences" — gives the creator a cohort voice. The
student-side feed lives separately under `polar/customer_portal/endpoints/`
and is wired up in Day 3.
"""

from uuid import UUID

from fastapi import Depends

from polar.course.repository import CourseRepository
from polar.exceptions import ResourceNotFound
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


def _to_read(b: CourseBroadcast) -> BroadcastRead:
    return BroadcastRead(
        id=b.id,
        course_id=b.course_id,
        created_by_user_id=b.created_by_user_id,
        title=b.title,
        body=b.body,
        image_url=b.image_url,
        week_number=b.week_number,
        notify_on_publish=b.notify_on_publish,
        published_at=b.published_at,
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
    return [_to_read(b) for b in broadcasts]


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
    return _to_read(b)


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
    return _to_read(b)


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
    return _to_read(b)


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
    return _to_read(b)


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
