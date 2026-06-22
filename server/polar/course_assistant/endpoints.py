"""Student-facing Course Assistant endpoints (Phase 2).

A live, approved assistant answers questions from enrolled students, grounded
in the course and matched to the creator's voice. Access is gated three ways:
not configured → 503, not enrolled → 403, no live assistant → 404.
"""

import json
import logging
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException
from sse_starlette.sse import EventSourceResponse

from polar.course.repository import CourseEnrollmentRepository, CourseRepository
from polar.customer_portal.auth import CustomerPortalRead
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import ai
from .repository import CourseAssistantRepository
from .schemas import CourseAssistantAskRequest, CourseAssistantStatusRead
from .service import (
    AssistantNotAvailable,
    NotConfigured,
    NotEnrolled,
    course_assistant_service,
    is_configured,
)

log = logging.getLogger(__name__)

router = APIRouter(
    prefix="/course-assistant",
    tags=["course_assistant", APITag.private],
)


@router.get(
    "/{course_id}",
    response_model=CourseAssistantStatusRead,
    summary="Course Assistant Status",
)
async def get_status(
    course_id: UUID,
    auth_subject: CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> CourseAssistantStatusRead:
    """Status for the student chat empty-state. Requires enrollment; reports
    ``available=False`` (rather than erroring) when there's no live assistant
    so the player can simply hide the chat."""
    customer = auth_subject.subject

    enrollment = await CourseEnrollmentRepository.from_session(
        session
    ).get_active_for_customer_course(customer.id, course_id)
    if enrollment is None:
        raise HTTPException(status_code=403, detail="Not enrolled")

    if not is_configured():
        return CourseAssistantStatusRead(available=False)

    assistant = await CourseAssistantRepository.from_session(session).get_by_course(
        course_id
    )
    course = await CourseRepository.from_session(session).get_by_id(course_id)
    if assistant is None or course is None or not assistant.is_answerable:
        return CourseAssistantStatusRead(available=False)

    example_question: str | None = None
    for item in assistant.sample_questions or []:
        if isinstance(item, dict) and item.get("category") == "core":
            question = item.get("question")
            if isinstance(question, str):
                example_question = question
                break

    display_name = assistant.display_name or course.instructor_name or course.title
    return CourseAssistantStatusRead(
        available=True,
        display_name=display_name,
        instructor_name=course.instructor_name,
        disclaimer=assistant.disclaimer or ai.DEFAULT_DISCLAIMER,
        example_question=example_question,
    )


@router.post(
    "/{course_id}/ask",
    summary="Ask the Course Assistant",
)
async def ask(
    course_id: UUID,
    body: CourseAssistantAskRequest,
    auth_subject: CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> EventSourceResponse:
    """Stream a grounded answer as Server-Sent Events.

    Event names: ``text`` (answer deltas), ``citations`` (lesson grounding),
    ``done`` (final, with usage), ``refusal`` (off-topic), ``error``.
    """
    customer = auth_subject.subject

    try:
        snapshot = await course_assistant_service.get_answerable_snapshot(
            session, course_id=course_id, customer=customer
        )
    except NotConfigured as exc:
        raise HTTPException(
            status_code=503, detail="Course assistant is not available."
        ) from exc
    except NotEnrolled as exc:
        raise HTTPException(status_code=403, detail="Not enrolled") from exc
    except AssistantNotAvailable as exc:
        raise HTTPException(
            status_code=404, detail="No assistant for this course"
        ) from exc

    question = body.question

    async def event_generator() -> AsyncIterator[dict[str, Any]]:
        try:
            async for event in course_assistant_service.answer_event_stream(
                snapshot, question
            ):
                yield {
                    "event": str(event.get("type", "message")),
                    "data": json.dumps(event),
                }
        except Exception:
            log.exception(
                "course_assistant.stream_failed",
                extra={"course_id": str(course_id)},
            )
            yield {
                "event": "error",
                "data": json.dumps(
                    {
                        "type": "error",
                        "message": "The assistant is temporarily unavailable.",
                    }
                ),
            }

    return EventSourceResponse(event_generator())
