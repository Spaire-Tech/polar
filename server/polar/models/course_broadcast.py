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
    from polar.models.user import User


class CourseBroadcast(RecordModel):
    """A cohort-wide note from the creator.

    Phase 3 of "Spaire Experiences" — gives the creator a voice between
    lessons. Posts surface in the student portal Community feed and
    optionally fan out via email/notification when published.

    Soft-deleted via `deleted_at` (RecordModel). Drafts are rows with
    `published_at IS NULL`; publishing sets the timestamp and triggers
    notification dispatch in the service layer.
    """

    __tablename__ = "course_broadcasts"
    __table_args__ = (
        # Drives the student-side feed: newest published first, scoped per
        # course. Drafts (published_at IS NULL) are excluded so the index
        # only carries the rows the feed actually reads.
        Index(
            "ix_course_broadcasts_course_published_at",
            "course_id",
            "published_at",
            postgresql_where=(
                "deleted_at IS NULL AND published_at IS NOT NULL"
            ),
            postgresql_ops={"published_at": "DESC"},
        ),
    )

    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    # The user who authored the broadcast. Kept for attribution + audit;
    # the student-side UI shows the course's instructor_name rather than
    # this user's profile.
    created_by_user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)

    # Plain text / markdown body. Rich-text rendering happens client-side;
    # we keep the canonical text here so we can fan it out to email too.
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Optional cover image. Single-shot S3 PUT (same pattern as challenge
    # thumbnails + submission media). NULL = text-only post.
    image_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, default=None
    )

    # When the creator picks a paced_weekly course, this anchors the post
    # to a specific week so the student feed can group ("Week 2 — Kickoff").
    # NULL = unanchored (drafts or self-paced courses).
    week_number: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    # NULL = draft. Set when the creator publishes; service layer dispatches
    # notifications + email events off this transition.
    published_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    # When True, publishing fires the cohort notification + email. Lets the
    # creator publish quietly (e.g. backfilling a missed week) without
    # spamming the cohort.
    notify_on_publish: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    @declared_attr
    def course(cls) -> Mapped["Course"]:
        return relationship("Course", lazy="raise")

    @declared_attr
    def created_by(cls) -> Mapped["User | None"]:
        return relationship("User", lazy="raise", foreign_keys=[cls.created_by_user_id])
