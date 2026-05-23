"""Creator-side endpoints for course challenges + submissions.

Phase 1 v0.1 surface — only the routes the creator dashboard needs to
manage challenges and review the submission inbox. Student-side
endpoints live separately under `polar/customer_portal/endpoints/`
(coming in the next slice).
"""

from uuid import UUID

from fastapi import Depends, HTTPException

from polar.auth.models import is_user
from polar.exceptions import ResourceNotFound
from polar.models.course_submission import CourseSubmission
from polar.models.customer import Customer
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from polar.course.repository import CourseRepository

from . import auth
from .repository import (
    ChallengeRepository,
    SubmissionRepository,
)
from .schemas import (
    ChallengeCreate,
    ChallengeRead,
    ChallengeUpdate,
    ReactionInput,
    ReactionRead,
    SubmissionAuthor,
    SubmissionMediaRead,
    SubmissionRead,
    SubmissionUpdateVisibility,
)
from .service import (
    challenge_service,
    reaction_service,
    submission_service,
)

router = APIRouter(
    prefix="/courses",
    tags=["course_submission", APITag.private],
)


# ── Serializers ─────────────────────────────────────────────────────────


async def _challenge_to_read(
    session: AsyncSession,
    challenge,
    *,
    my_submission_id: UUID | None = None,
) -> ChallengeRead:
    repo = ChallengeRepository.from_session(session)
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
        my_submission_id=my_submission_id,
    )


async def _submission_to_read(
    session: AsyncSession,
    submission: CourseSubmission,
    *,
    include_email: bool = False,
    challenge_title: str | None = None,
) -> SubmissionRead:
    """Convert a CourseSubmission to the read schema.

    Loads the enrollment + customer for the author block. The creator
    inbox can opt into seeing the email (`include_email=True`) — the
    public gallery doesn't. `challenge_title` is passed in by the
    caller (resolved via a separate batched query) because the
    submission.challenge relationship is `lazy="raise"` — the project-
    wide anti-N+1 default.
    """
    # Resolve the enrollment via a plain session.get — the explicit
    # one-statement read is the cheapest way to avoid hitting the
    # lazy="raise" relationship guard on submission.enrollment while
    # still keeping the serializer simple.
    from polar.models.course_enrollment import CourseEnrollment

    enrollment_obj = await session.get(CourseEnrollment, submission.enrollment_id)
    display_name = "Student"
    avatar_url: str | None = None
    if enrollment_obj is not None:
        customer = await session.get(Customer, enrollment_obj.customer_id)
        if customer is not None:
            display_name = (
                customer.name
                or (customer.email.split("@")[0] if include_email else "Student")
                or "Student"
            )

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
            avatar_url=avatar_url,
        ),
        challenge_title=challenge_title,
        created_at=submission.created_at,
        modified_at=submission.modified_at,
    )


# ── Challenges (creator CRUD) ────────────────────────────────────────────


@router.get(
    "/{course_id}/challenges",
    response_model=list[ChallengeRead],
)
async def list_challenges(
    course_id: UUID,
    auth_subject: auth.CoursesRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[ChallengeRead]:
    course = await CourseRepository.from_session(session).get_readable_by_id(
        course_id, auth_subject
    )
    if course is None:
        raise ResourceNotFound("Course not found")
    challenges = await challenge_service.list_for_course(session, course)
    return [await _challenge_to_read(session, c) for c in challenges]


@router.post(
    "/{course_id}/challenges",
    response_model=ChallengeRead,
    status_code=201,
)
async def create_challenge(
    course_id: UUID,
    payload: ChallengeCreate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ChallengeRead:
    challenge = await challenge_service.create(
        session, auth_subject, course_id, payload
    )
    return await _challenge_to_read(session, challenge)


@router.patch(
    "/challenges/{challenge_id}",
    response_model=ChallengeRead,
)
async def update_challenge(
    challenge_id: UUID,
    payload: ChallengeUpdate,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ChallengeRead:
    challenge = await challenge_service.update(
        session, auth_subject, challenge_id, payload
    )
    return await _challenge_to_read(session, challenge)


@router.delete(
    "/challenges/{challenge_id}",
    status_code=204,
)
async def delete_challenge(
    challenge_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await challenge_service.delete(session, auth_subject, challenge_id)


# ── Submissions (creator inbox + moderation) ─────────────────────────────


@router.get(
    "/{course_id}/submissions",
    response_model=list[SubmissionRead],
)
async def list_course_submissions(
    course_id: UUID,
    auth_subject: auth.CoursesRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[SubmissionRead]:
    course = await CourseRepository.from_session(session).get_readable_by_id(
        course_id, auth_subject
    )
    if course is None:
        raise ResourceNotFound("Course not found")
    subs = await submission_service.list_for_course_inbox(session, course)

    # Single IN scan so a 200-submission inbox doesn't pay N challenge
    # round-trips; the lazy="raise" guard on submission.challenge means
    # we have to resolve titles separately.
    challenge_repo = ChallengeRepository.from_session(session)
    title_by_id = await challenge_repo.get_titles_by_ids(
        list({s.challenge_id for s in subs})
    )

    return [
        await _submission_to_read(
            session,
            s,
            include_email=True,
            challenge_title=title_by_id.get(s.challenge_id),
        )
        for s in subs
    ]


@router.patch(
    "/submissions/{submission_id}/visibility",
    response_model=SubmissionRead,
)
async def set_submission_visibility(
    submission_id: UUID,
    payload: SubmissionUpdateVisibility,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> SubmissionRead:
    repo = SubmissionRepository.from_session(session)
    submission = await repo.get_readable_by_id_creator(submission_id, auth_subject)
    if submission is None:
        raise ResourceNotFound("Submission not found")
    await submission_service.set_visibility(session, submission, payload.hidden)
    return await _submission_to_read(session, submission, include_email=True)


# ── Creator reactions ────────────────────────────────────────────────────


@router.put(
    "/submissions/{submission_id}/reaction",
    response_model=ReactionRead,
)
async def set_creator_reaction(
    submission_id: UUID,
    payload: ReactionInput,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ReactionRead:
    if not is_user(auth_subject):
        # Creator reactions require a real user actor (we record their
        # user_id on the row). Org-scoped tokens have no human attached.
        raise HTTPException(
            status_code=403,
            detail="Creator reactions require a user-scoped session.",
        )
    repo = SubmissionRepository.from_session(session)
    submission = await repo.get_readable_by_id_creator(submission_id, auth_subject)
    if submission is None:
        raise ResourceNotFound("Submission not found")

    reaction = await reaction_service.set_creator_reaction(
        session, submission, auth_subject.subject.id, payload.emoji
    )
    return ReactionRead(
        id=reaction.id,
        actor_type=reaction.actor_type,
        actor_user_id=reaction.actor_user_id,
        emoji=reaction.emoji,
    )


@router.delete(
    "/submissions/{submission_id}/reaction",
    status_code=204,
)
async def clear_creator_reaction(
    submission_id: UUID,
    auth_subject: auth.CoursesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    if not is_user(auth_subject):
        raise HTTPException(
            status_code=403,
            detail="Creator reactions require a user-scoped session.",
        )
    repo = SubmissionRepository.from_session(session)
    submission = await repo.get_readable_by_id_creator(submission_id, auth_subject)
    if submission is None:
        raise ResourceNotFound("Submission not found")
    await reaction_service.clear_creator_reaction(
        session, submission, auth_subject.subject.id
    )


# ── Creator thumbnail upload presign ────────────────────────────────────
#
# Mirrors the customer-portal /submission-uploads endpoint but scoped
# to creators (CoursesWrite) and writes to a separate S3 path so
# thumbnails are easy to lifecycle independently of student submissions.

import uuid as _uuid  # noqa: E402

from fastapi import HTTPException  # noqa: E402
from pydantic import Field as _Field  # noqa: E402

from polar.config import settings as _settings  # noqa: E402
from polar.file.s3 import S3_SERVICES as _S3_SERVICES  # noqa: E402
from polar.kit.schemas import Schema as _Schema  # noqa: E402
from polar.models.file import FileServiceTypes as _FileServiceTypes  # noqa: E402


_ALLOWED_THUMBNAIL_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
_MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024  # 10MB matches course staging.


class ChallengeThumbnailUploadRequest(_Schema):
    filename: str = _Field(min_length=1, max_length=200)
    content_type: str
    content_length: int = _Field(ge=1, le=_MAX_THUMBNAIL_BYTES)


class ChallengeThumbnailUploadResponse(_Schema):
    upload_url: str
    public_url: str


@router.post(
    "/challenges/thumbnail-uploads",
    response_model=ChallengeThumbnailUploadResponse,
    summary="Presign Challenge Thumbnail Upload",
)
async def create_challenge_thumbnail_upload_url(
    payload: ChallengeThumbnailUploadRequest,
    auth_subject: auth.CoursesWrite,
) -> ChallengeThumbnailUploadResponse:
    """Single-shot presigned PUT for a creator-uploaded challenge
    thumbnail. Same shape as the customer-portal submission-upload
    endpoint — different auth, different S3 path, smaller size cap
    (10MB vs 50MB) because thumbnails are display-only.

    Returned `public_url` is what the creator persists on the
    challenge row via PATCH /v1/courses/challenges/{id}.
    """
    if payload.content_type not in _ALLOWED_THUMBNAIL_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WebP thumbnails are supported.",
        )

    ext = (
        payload.filename.rsplit(".", 1)[-1].lower()
        if "." in payload.filename
        else "bin"
    )[:8]

    # The challenge id isn't in the path because the creator may upload
    # a thumbnail before deciding which challenge to attach it to (and
    # tests show the picker UX often re-uses an upload across edits).
    # Scope by a fresh uuid; we treat the URL as immutable after PUT.
    key = f"course-challenge-thumbs/{_uuid.uuid4()}.{ext}"

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
    return ChallengeThumbnailUploadResponse(
        upload_url=upload_url, public_url=s3.get_public_url(key)
    )
