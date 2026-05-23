from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course_challenge import CourseChallenge
    from polar.models.course_enrollment import CourseEnrollment
    from polar.models.course_submission_media import CourseSubmissionMedia
    from polar.models.course_submission_reaction import CourseSubmissionReaction


# Status enum kept as a string column rather than an Enum so we can add new
# states (`hidden`, `flagged`, …) via a migration without an ALTER TYPE step.
SUBMISSION_STATUS_DRAFT = "draft"
SUBMISSION_STATUS_SUBMITTED = "submitted"
SUBMISSION_STATUS_HIDDEN = "hidden"


class CourseSubmission(RecordModel):
    """A student's response to a challenge.

    One submission per (challenge, enrollment) — students update their own
    submission instead of creating duplicates. Media (image v0.1, video
    later) lives in the sibling `course_submission_media` table; reactions
    in `course_submission_reactions`. Comments reuse the existing
    `lesson_comments` infra with a nullable `submission_id` (added by the
    same migration as this model).
    """

    __tablename__ = "course_submissions"
    __table_args__ = (
        # One active submission per (challenge, enrollment). Soft-delete
        # aware so a student can hard-delete + retry without conflicting.
        Index(
            "ix_course_submissions_challenge_enrollment_active",
            "challenge_id",
            "enrollment_id",
            unique=True,
            postgresql_where="deleted_at IS NULL",
        ),
        # Powers the creator-side submission inbox — newest-first across
        # all challenges in a course.
        Index(
            "ix_course_submissions_course_submitted_at",
            "course_id",
            "submitted_at",
            postgresql_where="deleted_at IS NULL AND submitted_at IS NOT NULL",
            postgresql_ops={"submitted_at": "DESC"},
        ),
    )

    challenge_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("course_challenges.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    # Denormalized course_id so the submission inbox query doesn't need to
    # join through challenges → modules → courses. Kept in sync at write
    # time by the submission service.
    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    enrollment_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("course_enrollments.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    caption: Mapped[str] = mapped_column(Text, nullable=False, default="")

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=SUBMISSION_STATUS_DRAFT
    )

    # NULL while the submission is still a draft. Set to the timestamp the
    # student hit "Submit" — that's what the creator inbox sorts by.
    submitted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def challenge(cls) -> Mapped["CourseChallenge"]:
        return relationship(
            "CourseChallenge", lazy="raise", back_populates="submissions"
        )

    @declared_attr
    def enrollment(cls) -> Mapped["CourseEnrollment"]:
        return relationship("CourseEnrollment", lazy="raise")

    @declared_attr
    def media(cls) -> Mapped[list["CourseSubmissionMedia"]]:
        return relationship(
            "CourseSubmissionMedia",
            lazy="selectin",
            order_by="CourseSubmissionMedia.position",
            cascade="all, delete-orphan",
            back_populates="submission",
            primaryjoin=(
                "and_(CourseSubmission.id == CourseSubmissionMedia.submission_id, "
                "CourseSubmissionMedia.deleted_at.is_(None))"
            ),
        )

    @declared_attr
    def reactions(cls) -> Mapped[list["CourseSubmissionReaction"]]:
        return relationship(
            "CourseSubmissionReaction",
            lazy="selectin",
            cascade="all, delete-orphan",
            back_populates="submission",
            primaryjoin=(
                "and_(CourseSubmission.id == CourseSubmissionReaction.submission_id, "
                "CourseSubmissionReaction.deleted_at.is_(None))"
            ),
        )
