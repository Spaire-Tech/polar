from datetime import datetime, timezone
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.models.course import Course
from polar.models.course_challenge import CourseChallenge
from polar.models.course_enrollment import CourseEnrollment
from polar.models.course_submission import (
    SUBMISSION_STATUS_DRAFT,
    SUBMISSION_STATUS_HIDDEN,
    SUBMISSION_STATUS_SUBMITTED,
    CourseSubmission,
)
from polar.models.course_submission_media import (
    SUBMISSION_MEDIA_KIND_IMAGE,
    CourseSubmissionMedia,
)
from polar.models.course_submission_reaction import (
    REACTION_ACTOR_CREATOR,
    CourseSubmissionReaction,
)
from polar.postgres import AsyncSession

from polar.course.repository import (
    CourseModuleRepository,
    CourseRepository,
)

from .repository import (
    ChallengeRepository,
    SubmissionRepository,
    SubmissionReactionRepository,
)
from .schemas import (
    ChallengeCreate,
    ChallengeUpdate,
    SubmissionCreate,
)


# ── Challenge service ────────────────────────────────────────────────────


class ChallengeService:
    async def list_for_course(
        self,
        session: AsyncSession,
        course: Course,
    ) -> list[CourseChallenge]:
        repo = ChallengeRepository.from_session(session)
        statement = repo.get_by_course_statement(course.id)
        return list(await repo.get_all(statement))

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        course_id: UUID,
        create_schema: ChallengeCreate,
    ) -> CourseChallenge:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(course_id, auth_subject)
        if course is None:
            raise ResourceNotFound("Course not found")

        # Module must belong to the same course — guard against creators
        # accidentally attaching to a module they can read but that lives
        # under a different course.
        module_repo = CourseModuleRepository.from_session(session)
        module = await module_repo.get_readable_by_id(
            create_schema.module_id, auth_subject
        )
        if module is None or module.course_id != course.id:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body", "module_id"),
                        "msg": "Module does not belong to this course.",
                        "type": "value_error",
                    }
                ]
            )

        challenge_repo = ChallengeRepository.from_session(session)
        position = await challenge_repo.next_position(course.id, module.id)

        challenge = CourseChallenge(
            course_id=course.id,
            module_id=module.id,
            position=position,
            title=create_schema.title,
            prompt=create_schema.prompt,
            accepts_media=create_schema.accepts_media,
            accepts_video=create_schema.accepts_video,
            accepts_text=create_schema.accepts_text,
            due_after_days=create_schema.due_after_days,
            published=create_schema.published,
            ai_generated=create_schema.ai_generated,
        )
        await challenge_repo.create(challenge, flush=True)
        return challenge

    async def update(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        challenge_id: UUID,
        update_schema: ChallengeUpdate,
    ) -> CourseChallenge:
        repo = ChallengeRepository.from_session(session)
        challenge = await repo.get_readable_by_id(challenge_id, auth_subject)
        if challenge is None:
            raise ResourceNotFound("Challenge not found")

        # Only patch fields the caller explicitly sent — leave the rest
        # alone. `exclude_unset=True` keeps partial PATCHes from
        # clobbering existing values with the schema defaults.
        patch = update_schema.model_dump(exclude_unset=True)
        for key, value in patch.items():
            setattr(challenge, key, value)
        await session.flush()
        return challenge

    async def delete(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        challenge_id: UUID,
    ) -> None:
        repo = ChallengeRepository.from_session(session)
        challenge = await repo.get_readable_by_id(challenge_id, auth_subject)
        if challenge is None:
            raise ResourceNotFound("Challenge not found")
        # Soft-delete only — RecordModel.deleted_at handles the tombstone.
        # Submissions cascade via the relationship's deleted_at filter so
        # the public gallery hides them too.
        challenge.deleted_at = datetime.now(timezone.utc)
        await session.flush()


# ── Submission service ──────────────────────────────────────────────────


class SubmissionService:
    async def list_for_challenge_public(
        self,
        session: AsyncSession,
        challenge: CourseChallenge,
    ) -> list[CourseSubmission]:
        """The public gallery on the lesson page. Submitted + non-hidden
        only — the creator inbox uses a different statement that also
        includes hidden rows so they can be reinstated."""
        repo = SubmissionRepository.from_session(session)
        statement = repo.get_by_challenge_statement(challenge.id, only_visible=True)
        return list(await repo.get_all(statement))

    async def list_for_course_inbox(
        self,
        session: AsyncSession,
        course: Course,
    ) -> list[CourseSubmission]:
        repo = SubmissionRepository.from_session(session)
        statement = repo.get_by_course_statement(course.id)
        return list(await repo.get_all(statement))

    async def get_for_enrollment(
        self,
        session: AsyncSession,
        challenge: CourseChallenge,
        enrollment_id: UUID,
    ) -> CourseSubmission | None:
        repo = SubmissionRepository.from_session(session)
        return await repo.get_for_enrollment(challenge.id, enrollment_id)

    async def upsert_for_enrollment(
        self,
        session: AsyncSession,
        challenge: CourseChallenge,
        enrollment: CourseEnrollment,
        payload: SubmissionCreate,
    ) -> CourseSubmission:
        """Create-or-update the student's submission for this challenge.

        Atomic on (challenge, enrollment) — students don't get to
        accumulate multiple drafts. Media is fully replaced each call so
        the client can rearrange / remove without per-row endpoints.
        Reaches `status="submitted"` via the separate `submit()` action.
        """
        if enrollment.course_id != challenge.course_id:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("path", "challenge_id"),
                        "msg": "Enrollment does not match challenge's course.",
                        "type": "value_error",
                    }
                ]
            )

        repo = SubmissionRepository.from_session(session)
        existing = await repo.get_for_enrollment(challenge.id, enrollment.id)

        if existing is None:
            submission = CourseSubmission(
                challenge_id=challenge.id,
                course_id=challenge.course_id,
                enrollment_id=enrollment.id,
                caption=payload.caption,
                status=SUBMISSION_STATUS_DRAFT,
                submitted_at=None,
            )
            await repo.create(submission, flush=True)
        else:
            existing.caption = payload.caption
            # Only allow caption edits if the submission isn't hidden —
            # a creator-hidden post stays frozen from the student side.
            if existing.status == SUBMISSION_STATUS_HIDDEN:
                raise PolarRequestValidationError(
                    [
                        {
                            "loc": ("path", "submission_id"),
                            "msg": (
                                "Submission is hidden by the creator and "
                                "can't be edited."
                            ),
                            "type": "value_error",
                        }
                    ]
                )
            submission = existing

        # Full media replace. We soft-delete existing media rather than
        # delete-cascading so historical references hold (and a creator
        # can recover via SQL if they squash a student's upload by
        # mistake).
        for m in submission.media:
            m.deleted_at = datetime.now(timezone.utc)

        for i, m in enumerate(payload.media):
            media_row = CourseSubmissionMedia(
                submission_id=submission.id,
                kind=m.kind or SUBMISSION_MEDIA_KIND_IMAGE,
                url=m.url,
                position=m.position if m.position is not None else i,
            )
            session.add(media_row)

        await session.flush()
        return submission

    async def submit(
        self,
        session: AsyncSession,
        submission: CourseSubmission,
    ) -> CourseSubmission:
        """Transition a draft to submitted state.

        Idempotent — calling submit on an already-submitted submission
        is a no-op (doesn't bump submitted_at). Hidden submissions stay
        hidden but submitted_at is still set on the first submit so the
        inbox can sort them correctly.
        """
        if submission.status == SUBMISSION_STATUS_DRAFT:
            submission.status = SUBMISSION_STATUS_SUBMITTED
            submission.submitted_at = datetime.now(timezone.utc)
            await session.flush()
        return submission

    async def set_visibility(
        self,
        session: AsyncSession,
        submission: CourseSubmission,
        hidden: bool,
    ) -> CourseSubmission:
        """Creator-only — flip between submitted and hidden states.

        Draft submissions can't be hidden (they're already private to
        the student); we'd get there only via a buggy client call.
        """
        if submission.status == SUBMISSION_STATUS_DRAFT:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("path", "submission_id"),
                        "msg": "Drafts can't be hidden — there's nothing public to hide.",
                        "type": "value_error",
                    }
                ]
            )
        submission.status = (
            SUBMISSION_STATUS_HIDDEN if hidden else SUBMISSION_STATUS_SUBMITTED
        )
        await session.flush()
        return submission

    async def delete_for_student(
        self,
        session: AsyncSession,
        submission: CourseSubmission,
    ) -> None:
        submission.deleted_at = datetime.now(timezone.utc)
        await session.flush()


# ── Reaction service ────────────────────────────────────────────────────


class ReactionService:
    async def set_creator_reaction(
        self,
        session: AsyncSession,
        submission: CourseSubmission,
        actor_user_id: UUID,
        emoji: str,
    ) -> CourseSubmissionReaction:
        """Replace the creator's current reaction (one per submission).

        Per v0.1: creator reactions are single-emoji. New emoji
        replaces any existing one. Students can leave multiple emoji
        later (Phase 4) — the schema's already there.
        """
        repo = SubmissionReactionRepository.from_session(session)
        existing = await repo.get_creator_reaction(submission.id, actor_user_id)
        if existing is not None:
            existing.emoji = emoji
            await session.flush()
            return existing

        reaction = CourseSubmissionReaction(
            submission_id=submission.id,
            actor_type=REACTION_ACTOR_CREATOR,
            actor_user_id=actor_user_id,
            emoji=emoji,
        )
        await repo.create(reaction, flush=True)
        return reaction

    async def clear_creator_reaction(
        self,
        session: AsyncSession,
        submission: CourseSubmission,
        actor_user_id: UUID,
    ) -> None:
        repo = SubmissionReactionRepository.from_session(session)
        existing = await repo.get_creator_reaction(submission.id, actor_user_id)
        if existing is not None:
            existing.deleted_at = datetime.now(timezone.utc)
            await session.flush()


challenge_service = ChallengeService()
submission_service = SubmissionService()
reaction_service = ReactionService()
