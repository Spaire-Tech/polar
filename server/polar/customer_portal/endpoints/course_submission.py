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

import uuid as _uuid
from uuid import UUID

from fastapi import Depends, HTTPException
from pydantic import Field

from polar.config import settings
from polar.exceptions import ResourceNotFound
from polar.file.s3 import S3_SERVICES
from polar.kit.schemas import Schema
from polar.models.course_enrollment import CourseEnrollment
from polar.models.course_submission import CourseSubmission
from polar.models.customer import Customer
from polar.models.file import FileServiceTypes
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
        thumbnail_url=challenge.thumbnail_url,
        thumbnail_object_position=challenge.thumbnail_object_position,
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


# ── Image upload presign ────────────────────────────────────────────────


# Tight allowlist for v0.1. Video submissions reuse Mux's direct-upload
# pipeline later; until then only image PUTs go through this endpoint.
_ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

# 50MB cap matches the existing course staging image limit so a student
# who can post a 50MB cover can also submit a 50MB challenge photo.
_MAX_SUBMISSION_BYTES = 50 * 1024 * 1024


class SubmissionUploadRequest(Schema):
    filename: str = Field(min_length=1, max_length=200)
    content_type: str
    content_length: int = Field(ge=1, le=_MAX_SUBMISSION_BYTES)


class SubmissionUploadResponse(Schema):
    """Single-shot presigned upload payload for an image submission.

    Flow:
      1. Client POSTs filename + content_type + content_length here.
      2. Server validates, generates a presigned PUT URL on the public
         bucket, and returns it.
      3. Client PUTs the file bytes directly to upload_url with the
         declared content_type — the same one we presigned for.
      4. After the PUT succeeds, client includes public_url in the
         media[] payload on the next submission upsert.
    """

    upload_url: str
    public_url: str


@router.post(
    "/submission-uploads",
    response_model=SubmissionUploadResponse,
    summary="Presign Submission Image Upload",
)
async def create_submission_upload_url(
    payload: SubmissionUploadRequest,
    auth_subject: auth.CustomerPortalUnionWrite,
) -> SubmissionUploadResponse:
    if payload.content_type not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only JPEG, PNG, WebP, and GIF are supported for "
                "challenge submissions in v0.1."
            ),
        )

    customer_id = get_customer_id(auth_subject)

    # The S3 key needs a usable extension so the served file's
    # content-type is correctly inferred when the browser fetches it
    # back from the public URL.
    ext = (
        payload.filename.rsplit(".", 1)[-1].lower()
        if "." in payload.filename
        else "bin"
    )
    # Defensive: cap the extension at 8 chars so a malicious filename
    # (e.g. `"foo." + "x" * 200`) can't bloat the key.
    ext = ext[:8]

    key = f"course-submissions/{customer_id}/{_uuid.uuid4()}.{ext}"

    # Reuse the public-bucket S3Service already wired up for product
    # media — same bucket, same client config — instead of standing up
    # a new one. The boto3 client on .client supports
    # generate_presigned_url out of the box.
    s3 = S3_SERVICES[FileServiceTypes.product_media]
    upload_url: str = s3.client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": s3.bucket,
            "Key": key,
            "ContentType": payload.content_type,
        },
        ExpiresIn=settings.S3_FILES_PRESIGN_TTL,
    )
    public_url = s3.get_public_url(key)

    return SubmissionUploadResponse(
        upload_url=upload_url, public_url=public_url
    )
