"""Customer-portal endpoints for course challenges + submissions.

Student-side surface for Phase 1 v0.1. Every endpoint here is gated on
the authenticated customer having an active enrollment in the course
the resource hangs off — there's no "preview" mode for non-enrolled
visitors (the public landing already exposes challenge prompts via
its own data path; participating requires an enrollment).

Auth shape mirrors customer_portal/endpoints/courses.py exactly:
CustomerPortalUnionRead for reads, CustomerPortalUnionWrite for
writes. The Member subject covers the case where an org user is also
a paying customer of their own course.
"""

from uuid import UUID

from fastapi import Depends, HTTPException

from polar.exceptions import ResourceNotFound
from polar.models.course_enrollment import CourseEnrollment
from polar.models.course_submission import CourseSubmission
from polar.models.customer import Customer
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from polar.course.service import course_service
from polar.course_submission.repository import (
    ChallengeRepository,
    SubmissionRepository,
)
from polar.course_submission.schemas import (
    ChallengeRead,
    ReactionRead,
    SubmissionAuthor,
    SubmissionCreate,
    SubmissionMediaRead,
    SubmissionRead,
)
from polar.course_submission.service import (
    submission_service,
)

from .. import auth
from ..utils import get_customer_id


router = APIRouter(
    prefix="/courses",
    tags=["customer_portal_courses", APITag.public],
)


async def _resolve_enrollment(
    session: AsyncSession,
    auth_subject: auth.CustomerPortalUnionRead,
    course_id: UUID,
) -> CourseEnrollment:
    """Lookup-or-403 the customer's active enrollment in `course_id`.

    A 404 would leak that the course exists; a 403 is the right signal
    for "you don't have access here" and matches the convention in the
    rest of the customer portal endpoints.
    """
    customer_id = get_customer_id(auth_subject)
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(
            status_code=403,
            detail="Not enrolled in this course.",
        )
    return enrollment


# ── Serializers ─────────────────────────────────────────────────────────


async def _challenge_to_read_student(
    session: AsyncSession,
    challenge,
    *,
    enrollment_id: UUID,
) -> ChallengeRead:
    """Same shape as the creator-side ChallengeRead but with
    `my_submission_id` populated from the student's enrollment so the
    UI can render "Submit" / "View your submission" without a second
    round-trip."""
    repo = ChallengeRepository.from_session(session)
    submission_repo = SubmissionRepository.from_session(session)
    mine = await submission_repo.get_for_enrollment(challenge.id, enrollment_id)
    return ChallengeRead(
        id=challenge.id,
        course_id=challenge.course_id,
        module_id=challenge.module_id,
        position=challenge.position,
        title=challenge.title,
        prompt=challenge.prompt,
        accepts_media=challenge.accepts_media,
        accepts_video=challenge.accepts_video,
        accepts_text=challenge.accepts_text,
        due_after_days=challenge.due_after_days,
        published=challenge.published,
        ai_generated=challenge.ai_generated,
        created_at=challenge.created_at,
        modified_at=challenge.modified_at,
        submission_count=await repo.count_submissions(challenge.id),
        my_submission_id=mine.id if mine is not None else None,
    )


async def _submission_to_read_student(
    session: AsyncSession,
    submission: CourseSubmission,
) -> SubmissionRead:
    """Public-gallery shape — never includes the author's email. The
    display name falls back to "Student" when the customer hasn't set a
    name, which is intentional anonymity for the gallery view; the
    student themselves sees their own author block on their own
    submission via a different render path on the client."""
    enrollment = await session.get(CourseEnrollment, submission.enrollment_id)
    display_name = "Student"
    if enrollment is not None:
        customer = await session.get(Customer, enrollment.customer_id)
        if customer is not None and customer.name:
            display_name = customer.name

    media = [
        SubmissionMediaRead(
            id=m.id,
            kind=m.kind,
            url=m.url,
            mux_playback_id=m.mux_playback_id,
            mux_status=m.mux_status,
            position=m.position,
        )
        for m in submission.media
    ]
    reactions = [
        ReactionRead(
            id=r.id,
            actor_type=r.actor_type,
            actor_user_id=r.actor_user_id,
            emoji=r.emoji,
        )
        for r in submission.reactions
    ]
    return SubmissionRead(
        id=submission.id,
        challenge_id=submission.challenge_id,
        course_id=submission.course_id,
        enrollment_id=submission.enrollment_id,
        status=submission.status,
        submitted_at=submission.submitted_at,
        caption=submission.caption,
        media=media,
        reactions=reactions,
        author=SubmissionAuthor(
            enrollment_id=submission.enrollment_id,
            display_name=display_name,
        ),
        challenge_title=None,
        created_at=submission.created_at,
        modified_at=submission.modified_at,
    )


# ── Challenges (student read) ───────────────────────────────────────────


@router.get(
    "/{course_id}/challenges",
    response_model=list[ChallengeRead],
    summary="List Challenges (enrolled)",
)
async def list_challenges_student(
    course_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[ChallengeRead]:
    """List published challenges for a course the customer is enrolled
    in. Draft (unpublished) challenges are intentionally filtered out —
    the creator sees those via the dashboard endpoint, never the
    students."""
    enrollment = await _resolve_enrollment(session, auth_subject, course_id)
    repo = ChallengeRepository.from_session(session)
    statement = repo.get_by_course_statement(course_id)
    challenges = list(await repo.get_all(statement))
    published = [c for c in challenges if c.published]
    return [
        await _challenge_to_read_student(
            session, c, enrollment_id=enrollment.id
        )
        for c in published
    ]


# ── Submission gallery + own submission ─────────────────────────────────


@router.get(
    "/challenges/{challenge_id}/submissions",
    response_model=list[SubmissionRead],
    summary="List Submissions (public gallery)",
)
async def list_challenge_submissions_student(
    challenge_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[SubmissionRead]:
    """Other students' submissions for this challenge. Hidden
    submissions are filtered out — only the creator (via the dashboard
    endpoint) and the original author (via /submission/me) ever see
    those."""
    challenge_repo = ChallengeRepository.from_session(session)
    challenge = await challenge_repo.get_by_id(challenge_id)
    if challenge is None or not challenge.published:
        raise ResourceNotFound("Challenge not found")
    await _resolve_enrollment(session, auth_subject, challenge.course_id)

    submission_repo = SubmissionRepository.from_session(session)
    statement = submission_repo.get_by_challenge_statement(
        challenge_id, only_visible=True
    )
    subs = list(await submission_repo.get_all(statement))
    return [await _submission_to_read_student(session, s) for s in subs]


@router.get(
    "/challenges/{challenge_id}/submission/me",
    response_model=SubmissionRead | None,
    summary="Get Own Submission",
)
async def get_own_submission(
    challenge_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> SubmissionRead | None:
    """The current student's submission for this challenge, regardless
    of status. Returns null when they haven't started one — lets the
    UI render the "Submit your work" composer in that case without a
    separate exists-check round-trip."""
    challenge_repo = ChallengeRepository.from_session(session)
    challenge = await challenge_repo.get_by_id(challenge_id)
    if challenge is None or not challenge.published:
        raise ResourceNotFound("Challenge not found")
    enrollment = await _resolve_enrollment(
        session, auth_subject, challenge.course_id
    )
    submission_repo = SubmissionRepository.from_session(session)
    mine = await submission_repo.get_for_enrollment(challenge_id, enrollment.id)
    if mine is None:
        return None
    return await _submission_to_read_student(session, mine)


# ── Mutations ───────────────────────────────────────────────────────────


@router.put(
    "/challenges/{challenge_id}/submission",
    response_model=SubmissionRead,
    summary="Upsert Own Submission",
)
async def upsert_own_submission(
    challenge_id: UUID,
    payload: SubmissionCreate,
    auth_subject: auth.CustomerPortalUnionWrite,
    session: AsyncSession = Depends(get_db_session),
) -> SubmissionRead:
    """PUT semantics — creates a draft if none exists, replaces media +
    caption if it does. Does NOT transition the status; the student
    has to explicitly POST .../submit to make it visible in the
    gallery / inbox. This split keeps "save my work in progress" and
    "share it with the class" as distinct user intents."""
    challenge_repo = ChallengeRepository.from_session(session)
    challenge = await challenge_repo.get_by_id(challenge_id)
    if challenge is None or not challenge.published:
        raise ResourceNotFound("Challenge not found")
    enrollment = await _resolve_enrollment(
        session, auth_subject, challenge.course_id
    )
    submission = await submission_service.upsert_for_enrollment(
        session, challenge, enrollment, payload
    )
    return await _submission_to_read_student(session, submission)


@router.post(
    "/submissions/{submission_id}/submit",
    response_model=SubmissionRead,
    summary="Submit (draft → submitted)",
)
async def submit_own(
    submission_id: UUID,
    auth_subject: auth.CustomerPortalUnionWrite,
    session: AsyncSession = Depends(get_db_session),
) -> SubmissionRead:
    """Atomic transition from `draft` to `submitted` + stamps
    submitted_at. Idempotent — calling submit on an already-submitted
    submission is a no-op and returns the row unchanged."""
    submission_repo = SubmissionRepository.from_session(session)
    submission = await submission_repo.get_by_id(submission_id)
    if submission is None:
        raise ResourceNotFound("Submission not found")
    enrollment = await _resolve_enrollment(
        session, auth_subject, submission.course_id
    )
    if submission.enrollment_id != enrollment.id:
        # Students can only submit their own work. Returning 404
        # instead of 403 avoids leaking that the submission exists.
        raise ResourceNotFound("Submission not found")
    submission = await submission_service.submit(session, submission)
    return await _submission_to_read_student(session, submission)


@router.delete(
    "/submissions/{submission_id}",
    status_code=204,
    summary="Delete Own Submission",
)
async def delete_own_submission(
    submission_id: UUID,
    auth_subject: auth.CustomerPortalUnionWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    submission_repo = SubmissionRepository.from_session(session)
    submission = await submission_repo.get_by_id(submission_id)
    if submission is None:
        raise ResourceNotFound("Submission not found")
    enrollment = await _resolve_enrollment(
        session, auth_subject, submission.course_id
    )
    if submission.enrollment_id != enrollment.id:
        raise ResourceNotFound("Submission not found")
    await submission_service.delete_for_student(session, submission)
