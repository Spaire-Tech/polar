from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course_submission import CourseSubmission
    from polar.models.user import User


# v0.1 ships creator-only emoji reactions on submissions. The student-side
# reaction surface (other students reacting) comes in Phase 4 with course
# discussions — the actor_type column lets the same table hold both.
REACTION_ACTOR_CREATOR = "creator"
REACTION_ACTOR_STUDENT = "student"


class CourseSubmissionReaction(RecordModel):
    """A single emoji reaction on a submission.

    One actor can leave multiple distinct emoji on the same submission, so
    the uniqueness constraint is (submission, actor_user, emoji) rather
    than (submission, actor_user). That matches Apple/Slack semantics
    instead of forcing one-reaction-per-user.
    """

    __tablename__ = "course_submission_reactions"
    __table_args__ = (
        Index(
            "ix_course_submission_reactions_actor_unique",
            "submission_id",
            "actor_user_id",
            "emoji",
            unique=True,
            postgresql_where="deleted_at IS NULL",
        ),
    )

    submission_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("course_submissions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    actor_type: Mapped[str] = mapped_column(String(10), nullable=False)

    actor_user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    # Single emoji codepoint. Free-form so the creator can pick anything,
    # not constrained to a preset palette.
    emoji: Mapped[str] = mapped_column(String(16), nullable=False)

    @declared_attr
    def submission(cls) -> Mapped["CourseSubmission"]:
        return relationship(
            "CourseSubmission", lazy="raise", back_populates="reactions"
        )

    @declared_attr
    def actor(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")
