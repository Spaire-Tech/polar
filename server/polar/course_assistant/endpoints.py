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

from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.course import auth as course_auth
from polar.course.repository import CourseEnrollmentRepository, CourseRepository
from polar.customer_portal.auth import CustomerPortalRead
from polar.models.course import Course
from polar.models.course_assistant import CourseAssistant
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.worker import enqueue_job

from . import ai
from .repository import CourseAssistantRepository
from .schemas import (
    CourseAssistantApproveRequest,
    CourseAssistantAskRequest,
    CourseAssistantLiveUpdate,
    CourseAssistantManageRead,
    CourseAssistantQuestionItem,
    CourseAssistantQuestionsRead,
    CourseAssistantSample,
    CourseAssistantSampleUpdate,
    CourseAssistantSettingsUpdate,
    CourseAssistantStatusRead,
)
from .service import (
    AnswerSnapshot,
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


def _manage_read(
    assistant: CourseAssistant | None, course: Course
) -> CourseAssistantManageRead:
    """Serialize the creator-facing management view, tolerating the
    not-yet-built case (no assistant row)."""
    configured = is_configured()
    if assistant is None:
        return CourseAssistantManageRead(
            course_id=str(course.id),
            status="building" if configured else "disabled",
            configured=configured,
            live=False,
            is_answerable=False,
            has_pending_review=False,
            display_name=course.instructor_name,
        )
    return CourseAssistantManageRead(
        course_id=str(course.id),
        status=assistant.status,
        configured=configured,
        live=assistant.live,
        is_answerable=assistant.is_answerable,
        has_pending_review=assistant.has_pending_review,
        display_name=assistant.display_name or course.instructor_name,
        disclaimer=assistant.disclaimer or ai.DEFAULT_DISCLAIMER,
        model=assistant.model,
        error=assistant.error,
        sample_questions=[
            CourseAssistantSample.model_validate(item)
            for item in (assistant.draft_sample_questions or [])
        ]
        or None,
        draft_lesson_count=assistant.draft_source_lesson_count,
        draft_tokens=assistant.draft_knowledge_base_tokens,
        draft_built_at=assistant.draft_built_at,
        approved_at=assistant.approved_at,
        approved_lesson_count=assistant.source_lesson_count,
    )


def _sse_answer(
    snapshot: AnswerSnapshot,
    question: str,
    course_id: UUID,
    *,
    customer_id: UUID | None = None,
) -> EventSourceResponse:
    """Wrap the service answer stream as Server-Sent Events. Shared by the
    student answer endpoint and the creator preview endpoint.

    When ``customer_id`` is given (student asks, not creator previews), the
    question is logged best-effort once the stream finishes — including on
    client disconnect, since the generator's ``finally`` still runs. Logging is
    enqueued, never inline, so it can't degrade or break the answer path.
    """

    async def event_generator() -> AsyncIterator[dict[str, Any]]:
        outcome = "answered"
        try:
            async for event in course_assistant_service.answer_event_stream(
                snapshot, question
            ):
                event_type = str(event.get("type", "message"))
                if event_type == "refusal":
                    outcome = "refused"
                elif event_type == "error":
                    outcome = "error"
                yield {"event": event_type, "data": json.dumps(event)}
        except Exception:
            outcome = "error"
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
        finally:
            if customer_id is not None:
                # enqueue_job is synchronous (a Redis push), so it's safe to
                # call here even while the generator is being closed on a
                # client disconnect (where awaiting/yielding would not be).
                try:
                    enqueue_job(
                        "course_assistant.log_question",
                        course_id=course_id,
                        organization_id=snapshot.organization_id,
                        customer_id=customer_id,
                        question=question,
                        outcome=outcome,
                    )
                except Exception:
                    log.warning(
                        "course_assistant.log_enqueue_failed",
                        extra={"course_id": str(course_id)},
                        exc_info=True,
                    )

    return EventSourceResponse(event_generator())


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
        # An in-scope sample (no off-syllabus scope label) makes the best
        # blank-page example for students.
        if isinstance(item, dict) and not item.get("scope"):
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

    return _sse_answer(
        snapshot, body.question, course_id, customer_id=customer.id
    )


# ── Creator-facing: review & approve (Phase 3) ────────────────────────────── #


async def _readable_course_or_404(
    session: AsyncSession,
    course_id: UUID,
    auth_subject: AuthSubject[User | Organization],
) -> Course:
    course = await CourseRepository.from_session(session).get_readable_by_id(
        course_id, auth_subject
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.get(
    "/{course_id}/manage",
    response_model=CourseAssistantManageRead,
    summary="Course Assistant — Creator Management View",
)
async def manage(
    course_id: UUID,
    auth_subject: course_auth.CoursesRead,
    session: AsyncSession = Depends(get_db_session),
) -> CourseAssistantManageRead:
    """The Assistant tab: status, draft sample questions awaiting review,
    identity, and approval state."""
    course = await _readable_course_or_404(session, course_id, auth_subject)
    assistant = await CourseAssistantRepository.from_session(session).get_by_course(
        course_id
    )
    return _manage_read(assistant, course)


@router.post(
    "/{course_id}/approve",
    response_model=CourseAssistantManageRead,
    summary="Approve the draft and go live",
)
async def approve(
    course_id: UUID,
    body: CourseAssistantApproveRequest,
    auth_subject: course_auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseAssistantManageRead:
    course = await _readable_course_or_404(session, course_id, auth_subject)
    assistant = await CourseAssistantRepository.from_session(session).get_by_course(
        course_id
    )
    if assistant is None or not assistant.draft_knowledge_base:
        raise HTTPException(
            status_code=409,
            detail="Nothing to review yet — the assistant is still building.",
        )
    approver = auth_subject.subject.id if is_user(auth_subject) else None
    assistant = await course_assistant_service.approve(
        session,
        assistant,
        approved_by_user_id=approver,
        display_name=body.display_name,
        disclaimer=body.disclaimer,
    )
    return _manage_read(assistant, course)


@router.post(
    "/{course_id}/regenerate",
    response_model=CourseAssistantManageRead,
    summary="Rebuild the draft assistant from current course content",
)
async def regenerate(
    course_id: UUID,
    auth_subject: course_auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseAssistantManageRead:
    course = await _readable_course_or_404(session, course_id, auth_subject)
    if not is_configured():
        raise HTTPException(
            status_code=503, detail="Course assistant is not available."
        )
    repo = CourseAssistantRepository.from_session(session)
    assistant = await repo.get_by_course(course_id)
    if assistant is None:
        assistant = await course_assistant_service.ensure_assistant(session, course)
    assistant = await course_assistant_service.request_rebuild(session, assistant)
    enqueue_job("course_assistant.maybe_build", course_id=course_id)
    return _manage_read(assistant, course)


@router.post(
    "/{course_id}/live",
    response_model=CourseAssistantManageRead,
    summary="Turn the assistant on or off",
)
async def set_live(
    course_id: UUID,
    body: CourseAssistantLiveUpdate,
    auth_subject: course_auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseAssistantManageRead:
    course = await _readable_course_or_404(session, course_id, auth_subject)
    assistant = await CourseAssistantRepository.from_session(session).get_by_course(
        course_id
    )
    if assistant is None:
        raise HTTPException(status_code=404, detail="No assistant for this course")
    if body.live and not assistant.knowledge_base:
        raise HTTPException(
            status_code=409,
            detail="Approve the assistant before turning it on.",
        )
    assistant = await course_assistant_service.set_live(
        session, assistant, live=body.live
    )
    return _manage_read(assistant, course)


@router.patch(
    "/{course_id}",
    response_model=CourseAssistantManageRead,
    summary="Edit the assistant's name / disclaimer",
)
async def update_settings(
    course_id: UUID,
    body: CourseAssistantSettingsUpdate,
    auth_subject: course_auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseAssistantManageRead:
    course = await _readable_course_or_404(session, course_id, auth_subject)
    assistant = await CourseAssistantRepository.from_session(session).get_by_course(
        course_id
    )
    if assistant is None:
        raise HTTPException(status_code=404, detail="No assistant for this course")
    assistant = await course_assistant_service.update_settings(
        session,
        assistant,
        display_name=body.display_name,
        disclaimer=body.disclaimer,
    )
    return _manage_read(assistant, course)


@router.patch(
    "/{course_id}/samples/{sample_id}",
    response_model=CourseAssistantManageRead,
    summary="Edit / approve one review card",
)
async def update_sample(
    course_id: UUID,
    sample_id: str,
    body: CourseAssistantSampleUpdate,
    auth_subject: course_auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CourseAssistantManageRead:
    course = await _readable_course_or_404(session, course_id, auth_subject)
    assistant = await CourseAssistantRepository.from_session(session).get_by_course(
        course_id
    )
    if assistant is None:
        raise HTTPException(status_code=404, detail="No assistant for this course")
    assistant = await course_assistant_service.update_sample(
        session,
        assistant,
        sample_id=sample_id,
        answer=body.answer,
        approved=body.approved,
    )
    return _manage_read(assistant, course)


@router.post(
    "/{course_id}/preview/ask",
    summary="Preview-chat the draft assistant (creator only)",
)
async def preview_ask(
    course_id: UUID,
    body: CourseAssistantAskRequest,
    auth_subject: course_auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> EventSourceResponse:
    """Stream an answer from the DRAFT (un-approved) snapshot so the creator
    can test the assistant in the review screen before going live."""
    await _readable_course_or_404(session, course_id, auth_subject)
    try:
        snapshot = await course_assistant_service.get_draft_snapshot(
            session, course_id=course_id
        )
    except NotConfigured as exc:
        raise HTTPException(
            status_code=503, detail="Course assistant is not available."
        ) from exc
    except AssistantNotAvailable as exc:
        raise HTTPException(
            status_code=404, detail="No draft assistant to preview yet"
        ) from exc

    return _sse_answer(snapshot, body.question, course_id)


@router.get(
    "/{course_id}/questions",
    response_model=CourseAssistantQuestionsRead,
    summary="What students are asking",
)
async def questions(
    course_id: UUID,
    auth_subject: course_auth.CoursesRead,
    session: AsyncSession = Depends(get_db_session),
) -> CourseAssistantQuestionsRead:
    """Aggregated insight into the questions students ask the live assistant:
    totals plus the most-asked clusters, with how many couldn't be answered
    (a content-gap signal). Org-scoped to the creator via the course."""
    await _readable_course_or_404(session, course_id, auth_subject)
    totals, items = await course_assistant_service.get_question_insights(
        session, course_id=course_id
    )
    return CourseAssistantQuestionsRead(
        total_questions=totals.total,
        asker_count=totals.asker_count,
        refused_count=totals.refused_count,
        items=[
            CourseAssistantQuestionItem(
                question=group.question,
                count=group.count,
                asker_count=group.asker_count,
                refused_count=group.refused_count,
                last_asked_at=group.last_asked_at,
            )
            for group in items
        ],
    )
