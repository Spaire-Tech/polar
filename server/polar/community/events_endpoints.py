"""HTTP routes for community events.

Two surfaces, mounted into the existing community routers:

  creator_router  /v1/community/{course_id}/events
    - Host (course owner): create, update, delete, list (sees own events).
    - Auth: CommunityCreatorWrite (user subject required for writes).

  customer_router /v1/customer-portal/community/{course_id}/events
    - Student: list, get, RSVP toggle.
    - Auth: CommunityCustomerRead/Write.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from pydantic import UUID4

from polar.auth.models import is_user
from polar.course.repository import CourseRepository
from polar.customer_portal.utils import get_customer_id
from polar.kit.utils import utc_now
from polar.models.community_event import CommunityEvent
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session

from .auth import (
    CommunityCreatorRead,
    CommunityCreatorWrite,
    CommunityCustomerRead,
    CommunityCustomerWrite,
)
from .endpoints import creator_router, customer_router
from .events_schemas import (
    CommunityEventCreate,
    CommunityEventHost,
    CommunityEventRead,
    CommunityEventRsvpResult,
    CommunityEventUpdate,
)
from .events_service import (
    EventHostMismatch,
    EventNotFound,
    events_service,
    is_live,
    is_past,
)
from .service import community as community_service

CourseID = Annotated[UUID4, ...]
EventID = Annotated[UUID4, ...]


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _require_user_subject(auth_subject) -> UUID:
    if not is_user(auth_subject):
        raise HTTPException(
            status_code=403,
            detail="Only user-authenticated sessions can host events.",
        )
    return auth_subject.subject.id


def _host_from_user(user: User, instructor_name: str | None) -> CommunityEventHost:
    name = (
        (instructor_name or "").strip()
        or (user.public_name or "").strip()
        if hasattr(user, "public_name")
        else None
    )
    fallback = (
        getattr(user, "username", None)
        or getattr(user, "email", None)
        or "Instructor"
    )
    return CommunityEventHost(
        user_id=user.id,
        name=name or fallback,
        avatar_url=getattr(user, "avatar_url", None),
    )


async def _event_to_read(
    session: AsyncSession,
    event: CommunityEvent,
    *,
    going: bool,
    instructor_name: str | None,
) -> CommunityEventRead:
    # Load host_user lazily — we want a single read, not a JOIN per call.
    host_user = await session.get(User, event.host_user_id)
    if host_user is None:
        host = CommunityEventHost(
            user_id=event.host_user_id, name="Instructor", avatar_url=None
        )
    else:
        host = _host_from_user(host_user, instructor_name)

    return CommunityEventRead(
        id=event.id,
        course_id=event.course_id,
        title=event.title,
        type=event.type,  # type: ignore[arg-type]
        description=event.description,
        start_at=event.start_at,
        duration_minutes=event.duration_minutes,
        meeting_url=event.meeting_url,
        location=event.location,
        replay_url=event.replay_url,
        cover_url=event.cover_url,
        recurring_weekly=event.recurring_weekly,
        notify_on_publish=event.notify_on_publish,
        rsvp_count=event.rsvp_count,
        host=host,
        going=going,
        live=is_live(event),
        past=is_past(event),
        created_at=event.created_at,
        modified_at=event.modified_at,
    )


async def _require_creator_owns_course(
    session: AsyncSession,
    course_id: UUID,
    auth_subject,
) -> None:
    repo = CourseRepository.from_session(session)
    course = await repo.get_readable_by_id(course_id, auth_subject)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")


# ====================================================================
# CREATOR ROUTES — /v1/community/{course_id}/events/...
# ====================================================================


@creator_router.get(
    "/{course_id}/events",
    response_model=list[CommunityEventRead],
    summary="List Community Events (Creator)",
)
async def list_events_creator(
    course_id: CourseID,
    auth_subject: CommunityCreatorRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[CommunityEventRead]:
    await _require_creator_owns_course(session, course_id, auth_subject)
    course_repo = CourseRepository.from_session(session)
    course = await course_repo.get_by_id(course_id)
    instructor_name = course.instructor_name if course else None

    events, _ = await events_service.list_for_course(
        session, course_id=course_id, viewer_customer_id=None
    )
    return [
        await _event_to_read(
            session, e, going=False, instructor_name=instructor_name
        )
        for e in events
    ]


@creator_router.post(
    "/{course_id}/events",
    response_model=CommunityEventRead,
    status_code=201,
    summary="Create Community Event",
)
async def create_event_creator(
    course_id: CourseID,
    payload: CommunityEventCreate,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityEventRead:
    await _require_creator_owns_course(session, course_id, auth_subject)
    user_id = _require_user_subject(auth_subject)

    event = await events_service.create(
        session,
        course_id=course_id,
        host_user_id=user_id,
        payload=payload,
    )
    course_repo = CourseRepository.from_session(session)
    course = await course_repo.get_by_id(course_id)
    return await _event_to_read(
        session,
        event,
        going=False,
        instructor_name=course.instructor_name if course else None,
    )


@creator_router.patch(
    "/{course_id}/events/{event_id}",
    response_model=CommunityEventRead,
    summary="Update Community Event",
)
async def update_event_creator(
    course_id: CourseID,
    event_id: EventID,
    payload: CommunityEventUpdate,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityEventRead:
    await _require_creator_owns_course(session, course_id, auth_subject)
    user_id = _require_user_subject(auth_subject)
    try:
        event = await events_service.update(
            session,
            event_id=event_id,
            course_id=course_id,
            host_user_id=user_id,
            payload=payload,
        )
    except EventNotFound:
        raise HTTPException(status_code=404, detail="Event not found") from None
    except EventHostMismatch:
        raise HTTPException(
            status_code=403, detail="Only the host can edit this event."
        ) from None
    course_repo = CourseRepository.from_session(session)
    course = await course_repo.get_by_id(course_id)
    return await _event_to_read(
        session,
        event,
        going=False,
        instructor_name=course.instructor_name if course else None,
    )


@creator_router.delete(
    "/{course_id}/events/{event_id}",
    status_code=204,
    summary="Delete (Cancel) Community Event",
)
async def delete_event_creator(
    course_id: CourseID,
    event_id: EventID,
    auth_subject: CommunityCreatorWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await _require_creator_owns_course(session, course_id, auth_subject)
    user_id = _require_user_subject(auth_subject)
    try:
        await events_service.delete(
            session,
            event_id=event_id,
            course_id=course_id,
            host_user_id=user_id,
        )
    except EventNotFound:
        raise HTTPException(status_code=404, detail="Event not found") from None
    except EventHostMismatch:
        raise HTTPException(
            status_code=403, detail="Only the host can delete this event."
        ) from None


# ====================================================================
# CUSTOMER ROUTES — /v1/customer-portal/community/{course_id}/events/...
# ====================================================================


@customer_router.get(
    "/{course_id}/events",
    response_model=list[CommunityEventRead],
    summary="List Community Events (Customer Portal)",
)
async def list_events_customer(
    course_id: CourseID,
    auth_subject: CommunityCustomerRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[CommunityEventRead]:
    customer_id = get_customer_id(auth_subject)
    await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    await community_service.assert_community_enabled(session, course_id)

    course_repo = CourseRepository.from_session(session)
    course = await course_repo.get_by_id(course_id)
    instructor_name = course.instructor_name if course else None

    events, going_map = await events_service.list_for_course(
        session, course_id=course_id, viewer_customer_id=customer_id
    )

    # Surface past events for ~30 days so the Replays section stays
    # populated for a reasonable window after the live date.
    cutoff = utc_now() - timedelta(days=30)
    visible: list[CommunityEvent] = []
    for e in events:
        end_at = e.start_at + timedelta(minutes=e.duration_minutes)
        if end_at >= cutoff:
            visible.append(e)

    return [
        await _event_to_read(
            session,
            e,
            going=going_map.get(e.id, False),
            instructor_name=instructor_name,
        )
        for e in visible
    ]


@customer_router.post(
    "/{course_id}/events/{event_id}/rsvp",
    response_model=CommunityEventRsvpResult,
    summary="RSVP to Community Event",
)
async def rsvp_event_customer(
    course_id: CourseID,
    event_id: EventID,
    auth_subject: CommunityCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityEventRsvpResult:
    customer_id = get_customer_id(auth_subject)
    await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    await community_service.assert_community_enabled(session, course_id)
    try:
        going, count = await events_service.rsvp(
            session,
            event_id=event_id,
            course_id=course_id,
            customer_id=customer_id,
            going=True,
        )
    except EventNotFound:
        raise HTTPException(status_code=404, detail="Event not found") from None
    return CommunityEventRsvpResult(going=going, rsvp_count=count)


@customer_router.delete(
    "/{course_id}/events/{event_id}/rsvp",
    response_model=CommunityEventRsvpResult,
    summary="Cancel RSVP to Community Event",
)
async def unrsvp_event_customer(
    course_id: CourseID,
    event_id: EventID,
    auth_subject: CommunityCustomerWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CommunityEventRsvpResult:
    customer_id = get_customer_id(auth_subject)
    await community_service.assert_enrolled(
        session, customer_id=customer_id, course_id=course_id
    )
    await community_service.assert_community_enabled(session, course_id)
    try:
        going, count = await events_service.rsvp(
            session,
            event_id=event_id,
            course_id=course_id,
            customer_id=customer_id,
            going=False,
        )
    except EventNotFound:
        raise HTTPException(status_code=404, detail="Event not found") from None
    return CommunityEventRsvpResult(going=going, rsvp_count=count)
