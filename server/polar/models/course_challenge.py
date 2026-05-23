from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course import Course
    from polar.models.course_module import CourseModule
    from polar.models.course_submission import CourseSubmission


class CourseChallenge(RecordModel):
    """A weekly prompt attached to a module.

    Phase 1 of "Spaire Experiences" — scoped per module rather than per lesson
    so the cadence reads as "Week 1: bake a croissant" instead of one challenge
    per video. Each challenge has a single prompt, and students submit one
    response with optional media + caption.
    """

    __tablename__ = "course_challenges"
    __table_args__ = (
        # Drives the creator-side Challenges list per course, ordered by
        # module position then challenge position within the module.
        Index(
            "ix_course_challenges_course_published",
            "course_id",
            "position",
            postgresql_where="deleted_at IS NULL",
        ),
    )

    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    module_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("course_modules.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    title: Mapped[str] = mapped_column(String(500), nullable=False)

    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Submission shape — the v0.1 carousel ships image-only; video is flagged
    # off by default but the column lets us turn it on per challenge once the
    # Mux flow is wired for student uploads.
    accepts_media: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    accepts_video: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    accepts_text: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    # Optional soft deadline measured from the student's enrollment date.
    # NULL = no deadline. Lets us send "challenge due soon" reminders in
    # Phase 3 without committing to fixed cohort dates.
    due_after_days: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    # Creators can draft a challenge before exposing it. Drafts are hidden
    # from the student portal but visible on the creator-side editor.
    published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    # Tracks whether the AI suggested this challenge or the creator wrote
    # it from scratch. Only used for analytics — submission UX is identical
    # either way.
    ai_generated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    @declared_attr
    def course(cls) -> Mapped["Course"]:
        return relationship("Course", lazy="raise")

    @declared_attr
    def module(cls) -> Mapped["CourseModule"]:
        return relationship("CourseModule", lazy="raise")

    @declared_attr
    def submissions(cls) -> Mapped[list["CourseSubmission"]]:
        # Soft-deleted submissions are hidden from the relationship the
        # same way lessons are hidden from a soft-deleted module.
        return relationship(
            "CourseSubmission",
            lazy="raise",
            cascade="all, delete-orphan",
            back_populates="challenge",
            primaryjoin=(
                "and_(CourseChallenge.id == CourseSubmission.challenge_id, "
                "CourseSubmission.deleted_at.is_(None))"
            ),
        )
