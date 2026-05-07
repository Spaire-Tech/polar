from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Index, Text, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course import Course
    from polar.models.course_enrollment import CourseEnrollment


class CoachingPost(RecordModel):
    """Program-level discussion board post.

    Threading model is one-deep: top-level posts have parent_id=NULL,
    replies set parent_id to the post they're replying to. Replies cannot
    themselves have replies (enforced in the service, not the schema).

    Kept separate from `lesson_comments` so the existing per-lesson
    commenting on standard courses stays untouched.
    """

    __tablename__ = "coaching_posts"
    __table_args__ = (
        Index(
            "ix_coaching_posts_course_id_created_at",
            "course_id",
            "created_at",
        ),
    )

    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    # The enrollment is the post's "author identity" on the customer side —
    # consistent with how lesson_comments work today. Coach-authored posts
    # use a separate is_creator flag (set by the service) and don't require
    # an enrollment row.
    enrollment_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("course_enrollments.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    parent_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("coaching_posts.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Coach posts are visually distinct in the portal and bypass enrollment
    # ownership checks for delete/edit.
    is_creator: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # Top-level threads only: pin to the top of the board.
    pinned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # Moderator-hidden posts: still in the database (audit trail), not
    # rendered in the customer portal but visible to the creator.
    hidden: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    @declared_attr
    def course(cls) -> Mapped["Course"]:
        return relationship("Course", lazy="raise")

    @declared_attr
    def enrollment(cls) -> Mapped["CourseEnrollment"]:
        return relationship("CourseEnrollment", lazy="raise")
