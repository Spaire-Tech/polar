import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Query

from polar.openapi import APITag
from polar.postgres import AsyncReadSession, AsyncSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import (
    CoachingEventCreate,
    CoachingEventRead,
    CoachingEventUpdate,
    CoachingMuxUploadRead,
)
from .service import coaching_service

log = logging.getLogger(__name__)


router = APIRouter(
    prefix="/coaching",
    tags=["coaching", APITag.private],
)


def _read(event) -> CoachingEventRead:
    return CoachingEventRead.model_validate(event, from_attributes=True)


@router.get("/events", response_model=list[CoachingEventRead])
async def list_events(
    auth_subject: auth.CoachingRead,
    course_id: Annotated[UUID, Query(description="Course ID to list events for")],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[CoachingEventRead]:
    events = await coaching_service.list_events(
        session, auth_subject, course_id=course_id
    )
    return [_read(e) for e in events]


@router.get("/events/{event_id}", response_model=CoachingEventRead)
async def get_event(
    event_id: UUID,
    auth_subject: auth.CoachingRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CoachingEventRead:
    event = await coaching_service.get_event(
        session, auth_subject, event_id=event_id
    )
    return _read(event)


@router.post("/events", response_model=CoachingEventRead, status_code=201)
async def create_event(
    body: CoachingEventCreate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingEventRead:
    event = await coaching_service.create_event(session, auth_subject, body)
    return _read(event)


@router.patch("/events/{event_id}", response_model=CoachingEventRead)
async def update_event(
    event_id: UUID,
    body: CoachingEventUpdate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingEventRead:
    event = await coaching_service.update_event(
        session, auth_subject, event_id=event_id, update_schema=body
    )
    return _read(event)


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(
    event_id: UUID,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await coaching_service.delete_event(
        session, auth_subject, event_id=event_id
    )


@router.post(
    "/events/{event_id}/recording-upload",
    response_model=CoachingMuxUploadRead,
)
async def create_recording_upload(
    event_id: UUID,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingMuxUploadRead:
    """Create a Mux direct-upload URL for a post-event recording. The coach
    PUTs the video to `upload_url`; the existing Mux webhook updates the
    asset/playback ids when processing is done."""
    try:
        upload = await coaching_service.create_recording_upload(
            session, auth_subject, event_id=event_id
        )
    except Exception as exc:
        log.exception("coaching.recording_upload failed", extra={"event_id": str(event_id)})
        raise HTTPException(status_code=502, detail="Mux upload creation failed") from exc
    return CoachingMuxUploadRead(
        upload_id=upload["upload_id"], upload_url=upload["upload_url"]
    )
