"""Customer-portal endpoints for coaching programs.

The customer must be enrolled in the underlying course (the standard
`course_access` benefit grant the buyer received at checkout). Coaching
programs reuse `CourseEnrollment`; this endpoint just layers the event list
on top.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends, HTTPException, Response

from polar.coaching.ics import event_to_ics, filename_for
from polar.coaching.service import (
    coaching_service,
    intake_service,
    validate_intake_answers,
)
from polar.course.service import course_service
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..utils import get_customer_id

router = APIRouter(
    prefix="/coaching",
    tags=["customer_portal_coaching", APITag.public],
)


def _serialize_event(event) -> dict:
    now = datetime.now(tz=UTC)
    return {
        "id": str(event.id),
        "title": event.title,
        "description": event.description,
        "agenda": event.agenda,
        "starts_at": event.starts_at.isoformat(),
        "duration_minutes": event.duration_minutes,
        "timezone": event.timezone,
        "meeting_url": event.meeting_url,
        "meeting_provider": event.meeting_provider,
        "status": event.status,
        "is_past": event.starts_at < now,
        "recording": (
            {
                "playback_id": event.recording_mux_playback_id,
                "status": event.recording_mux_status,
                "released_at": (
                    event.recording_released_at.isoformat()
                    if event.recording_released_at
                    else None
                ),
            }
            if event.recording_mux_playback_id
            or event.recording_mux_status
            else None
        ),
    }


@router.get(
    "/{course_id}/events",
    summary="List Coaching Events for an Enrolled Program",
)
async def list_events(
    course_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    customer_id = get_customer_id(auth_subject)
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(
            status_code=404, detail="Program not found or not enrolled"
        )

    events = await coaching_service.list_events_for_course_public(
        session, course_id=course_id
    )
    return {
        "course_id": str(course_id),
        "events": [_serialize_event(e) for e in events],
    }


@router.get(
    "/{course_id}/events/{event_id}/ics",
    summary="Download an Event as iCalendar (.ics)",
)
async def download_ics(
    course_id: UUID,
    event_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    customer_id = get_customer_id(auth_subject)
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(
            status_code=404, detail="Program not found or not enrolled"
        )

    events = await coaching_service.list_events_for_course_public(
        session, course_id=course_id
    )
    event = next((e for e in events if e.id == event_id), None)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    course = enrollment.course
    body = event_to_ics(
        event,
        organization_slug=str(course.organization_id),
        program_title=course.title,
    )
    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename_for(event.id)}"'
            )
        },
    )


@router.get(
    "/{course_id}/intake-form",
    summary="Get the program's intake form (and the customer's existing response, if any)",
)
async def get_intake_form(
    course_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    customer_id = get_customer_id(auth_subject)
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(
            status_code=404, detail="Program not found or not enrolled"
        )

    form = await intake_service.get_form_public(session, course_id=course_id)
    if form is None:
        return {"form": None, "response": None}

    response = await intake_service.get_response_for_customer(
        session, form_id=form.id, customer_id=customer_id
    )
    return {
        "form": {
            "id": str(form.id),
            "title": form.title,
            "description": form.description,
            "schema_json": form.schema_json,
            "required_for_access": form.required_for_access,
        },
        "response": (
            {
                "id": str(response.id),
                "answers": response.answers_json,
                "submitted_at": response.submitted_at.isoformat(),
            }
            if response
            else None
        ),
    }


@router.post(
    "/{course_id}/intake-form/submit",
    summary="Submit (or re-submit) the program's intake form",
)
async def submit_intake_form(
    course_id: UUID,
    body: dict,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    customer_id = get_customer_id(auth_subject)
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(
            status_code=404, detail="Program not found or not enrolled"
        )

    form = await intake_service.get_form_public(session, course_id=course_id)
    if form is None:
        raise HTTPException(
            status_code=404, detail="No intake form on this program"
        )

    answers = body.get("answers")
    if not isinstance(answers, dict):
        raise HTTPException(
            status_code=422, detail="`answers` must be an object keyed by field id"
        )

    errors = validate_intake_answers(form, answers)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})

    response = await intake_service.submit_response(
        session,
        form=form,
        customer_id=customer_id,
        enrollment_id=enrollment.id,
        answers=answers,
    )
    return {
        "id": str(response.id),
        "answers": response.answers_json,
        "submitted_at": response.submitted_at.isoformat(),
    }
