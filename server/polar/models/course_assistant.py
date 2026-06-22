from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course import Course


class CourseAssistant(RecordModel):
    """The AI teaching assistant ("Office Hours" TA) for a single course.

    Lifecycle / snapshot model
    --------------------------
    Every build writes its output to the ``draft_*`` columns and leaves the
    course in ``ready_for_review``. Nothing the build produces is served to
    students until a creator approves it, at which point the draft snapshot is
    copied into the serving columns (``knowledge_base`` / ``voice_card`` /
    ``sample_questions`` / ...) and ``live`` is set.

    This split is deliberate: when a creator edits the course *after* approving
    the assistant, the next build refreshes only the ``draft_*`` snapshot and
    flips the status back to ``ready_for_review`` while ``live`` stays true —
    so students keep getting the previously-approved answers until the creator
    re-reviews, rather than silently getting un-reviewed content.
    """

    __tablename__ = "course_assistants"

    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        unique=True,
        index=True,
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    # building | ready_for_review | live | failed | disabled
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="building", server_default="building"
    )

    # Whether the assistant is currently serving students. Only ever set true
    # by an explicit approval; the answer endpoint refuses to respond unless
    # this is true (and a serving knowledge base exists).
    live: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # Creator-facing identity. Falls back to the course's instructor name when
    # null. The disclaimer is shown to students / used in the system prompt.
    display_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )
    disclaimer: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    # Model used for answers (snapshotted at approval for reproducibility).
    model: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)

    # ── Serving snapshot (approved; what students actually get) ──────────────
    knowledge_base: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )
    voice_card: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    sample_questions: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB, nullable=True, default=None
    )
    knowledge_base_tokens: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )
    source_lesson_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    # ── Draft snapshot (latest build output, awaiting review) ────────────────
    draft_knowledge_base: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )
    draft_voice_card: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )
    draft_sample_questions: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSONB, nullable=True, default=None
    )
    draft_knowledge_base_tokens: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )
    draft_source_lesson_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    # ── Timestamps / provenance / errors ─────────────────────────────────────
    draft_built_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    approved_by_user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
        default=None,
    )
    # Latest failure reason (KB too big, no content, build error, ...).
    error: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    @declared_attr
    def course(cls) -> Mapped["Course"]:
        return relationship("Course", lazy="raise")

    @property
    def has_pending_review(self) -> bool:
        """A newer draft exists than what was last approved."""
        if self.draft_built_at is None:
            return False
        if self.approved_at is None:
            return True
        return self.draft_built_at > self.approved_at

    @property
    def is_answerable(self) -> bool:
        """Whether the answer endpoint may serve this assistant."""
        return self.live and bool(self.knowledge_base)
