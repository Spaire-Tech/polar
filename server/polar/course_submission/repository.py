from uuid import UUID

from sqlalchemy import Select, and_, func, select

from polar.auth.models import AuthSubject, Organization, User
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.course import Course
from polar.models.course_challenge import CourseChallenge
from polar.models.course_module import CourseModule
from polar.models.course_submission import (
    SUBMISSION_STATUS_HIDDEN,
    SUBMISSION_STATUS_SUBMITTED,
    CourseSubmission,
)
from polar.models.course_submission_reaction import (
    REACTION_ACTOR_CREATOR,
    CourseSubmissionReaction,
)

from polar.course.repository import CourseRepository


class ChallengeRepository(
    RepositorySoftDeletionIDMixin[CourseChallenge, UUID],
    RepositorySoftDeletionMixin[CourseChallenge],
    RepositoryBase[CourseChallenge],
):
    model = CourseChallenge

    def get_by_course_statement(self, course_id: UUID) -> Select[tuple[CourseChallenge]]:
        # Joined to modules + course so soft-deleted parents suppress
        # their children. Ordered by module.position then challenge
        # position for a stable "Week 1 challenge, Week 2 challenge"
        # read across module reorders.
        return (
            self.get_base_statement()
            .join(CourseModule, CourseChallenge.module_id == CourseModule.id)
            .join(Course, CourseChallenge.course_id == Course.id)
            .where(
                CourseChallenge.course_id == course_id,
                CourseModule.deleted_at.is_(None),
                Course.deleted_at.is_(None),
            )
            .order_by(CourseModule.position, CourseChallenge.position)
        )

    async def get_readable_by_id(
        self,
        challenge_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> CourseChallenge | None:
        """Creator-side readability check — same shape as the rest of the
        course module's read paths."""
        course_repo = CourseRepository.from_session(self.session)
        readable_course_ids = course_repo.get_readable_statement(
            auth_subject
        ).with_only_columns(Course.id)
        statement = self.get_base_statement().where(
            CourseChallenge.id == challenge_id,
            CourseChallenge.course_id.in_(readable_course_ids),
        )
        return await self.get_one_or_none(statement)

    async def next_position(self, course_id: UUID, module_id: UUID) -> int:
        """Last position + 1 among non-deleted challenges in this module.

        Creators reorder later via PATCH; this just gives a stable
        append-to-end default at create time so two creators clicking
        "Add challenge" don't both land at position 0.
        """
        statement = select(func.coalesce(func.max(CourseChallenge.position), -1)).where(
            CourseChallenge.module_id == module_id,
            CourseChallenge.deleted_at.is_(None),
        )
        last = (await self.session.execute(statement)).scalar_one()
        return last + 1

    async def get_titles_by_ids(
        self, challenge_ids: list[UUID]
    ) -> dict[UUID, str]:
        """Single-query batch lookup — one IN scan instead of N round-trips.
        Drives the creator inbox so we can show "<challenge title>" next
        to each submission without paying N+1 on the lazy-loaded
        relationship."""
        if not challenge_ids:
            return {}
        statement = self.get_base_statement().where(
            CourseChallenge.id.in_(set(challenge_ids))
        )
        rows = await self.get_all(statement)
        return {c.id: c.title for c in rows}

    async def count_submissions(self, challenge_id: UUID) -> int:
        """Number of submitted (non-draft, non-deleted) submissions for a
        challenge. Powers the `submission_count` field on ChallengeRead.
        """
        statement = select(func.count(CourseSubmission.id)).where(
            CourseSubmission.challenge_id == challenge_id,
            CourseSubmission.deleted_at.is_(None),
            CourseSubmission.status == SUBMISSION_STATUS_SUBMITTED,
        )
        return (await self.session.execute(statement)).scalar_one()


class SubmissionRepository(
    RepositorySoftDeletionIDMixin[CourseSubmission, UUID],
    RepositorySoftDeletionMixin[CourseSubmission],
    RepositoryBase[CourseSubmission],
):
    model = CourseSubmission

    def get_by_challenge_statement(
        self, challenge_id: UUID, *, only_visible: bool = True
    ) -> Select[tuple[CourseSubmission]]:
        """Statement for the public gallery (submitted + non-hidden) or
        the creator-side view of a single challenge's submissions
        (`only_visible=False`, which also includes hidden rows).

        Joined to `course_challenges` so a soft-deleted challenge
        suppresses its submissions automatically — the relationship's
        primaryjoin filter only checks the submission's own deleted_at,
        not the parent's.
        """
        statement = (
            self.get_base_statement()
            .join(
                CourseChallenge,
                CourseSubmission.challenge_id == CourseChallenge.id,
            )
            .join(Course, CourseSubmission.course_id == Course.id)
            .where(
                CourseSubmission.challenge_id == challenge_id,
                CourseChallenge.deleted_at.is_(None),
                Course.deleted_at.is_(None),
            )
        )
        if only_visible:
            statement = statement.where(
                CourseSubmission.status == SUBMISSION_STATUS_SUBMITTED
            )
        else:
            statement = statement.where(
                CourseSubmission.status.in_(
                    (SUBMISSION_STATUS_SUBMITTED, SUBMISSION_STATUS_HIDDEN)
                )
            )
        return statement.order_by(CourseSubmission.submitted_at.desc())

    def get_by_course_statement(
        self, course_id: UUID
    ) -> Select[tuple[CourseSubmission]]:
        """Creator inbox feed — every submission across the course,
        newest first. Includes hidden so the creator can unhide.
        Excludes submissions whose parent challenge is soft-deleted.
        """
        return (
            self.get_base_statement()
            .join(
                CourseChallenge,
                CourseSubmission.challenge_id == CourseChallenge.id,
            )
            .join(Course, CourseSubmission.course_id == Course.id)
            .where(
                CourseSubmission.course_id == course_id,
                CourseSubmission.submitted_at.is_not(None),
                CourseChallenge.deleted_at.is_(None),
                Course.deleted_at.is_(None),
            )
            .order_by(CourseSubmission.submitted_at.desc())
        )

    async def get_for_enrollment(
        self, challenge_id: UUID, enrollment_id: UUID
    ) -> CourseSubmission | None:
        """The student's own submission for a challenge (draft or
        submitted). Returns None when they haven't started one."""
        statement = self.get_base_statement().where(
            CourseSubmission.challenge_id == challenge_id,
            CourseSubmission.enrollment_id == enrollment_id,
        )
        return await self.get_one_or_none(statement)

    async def get_readable_by_id_creator(
        self,
        submission_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> CourseSubmission | None:
        """Creator-side: the submission belongs to a course the
        authenticated creator can read."""
        course_repo = CourseRepository.from_session(self.session)
        readable_course_ids = course_repo.get_readable_statement(
            auth_subject
        ).with_only_columns(Course.id)
        statement = self.get_base_statement().where(
            CourseSubmission.id == submission_id,
            CourseSubmission.course_id.in_(readable_course_ids),
        )
        return await self.get_one_or_none(statement)


class SubmissionReactionRepository(
    RepositorySoftDeletionIDMixin[CourseSubmissionReaction, UUID],
    RepositorySoftDeletionMixin[CourseSubmissionReaction],
    RepositoryBase[CourseSubmissionReaction],
):
    model = CourseSubmissionReaction

    async def get_creator_reaction(
        self, submission_id: UUID, actor_user_id: UUID
    ) -> CourseSubmissionReaction | None:
        """The creator's current single emoji on a submission.

        Per the v0.1 product spec, creator reactions are 1-emoji — they
        replace any prior reaction. This helper finds the existing row
        so the service can update it in place rather than creating a
        duplicate.
        """
        statement = self.get_base_statement().where(
            CourseSubmissionReaction.submission_id == submission_id,
            CourseSubmissionReaction.actor_user_id == actor_user_id,
            CourseSubmissionReaction.actor_type == REACTION_ACTOR_CREATOR,
        )
        return await self.get_one_or_none(statement)
