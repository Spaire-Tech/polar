from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course import Course


class CoachingEvent(RecordModel):
    __tablename__ = "coaching_events"

    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    # Free-form structured agenda. We store as JSONB so the editor can support
    # checklist items, sub-headings, links etc. without further migrations.
    agenda: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)

    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )
    timezone: Mapped[str | None] = mapped_column(
        String(64), nullable=True, default=None
    )

    # Display only — we never broker the meeting. Coach pastes a link from
    # Zoom/Meet/Whereby/etc. Customers click through.
    meeting_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, default=None
    )
    meeting_provider: Mapped[str | None] = mapped_column(
        String(32), nullable=True, default=None
    )

    # Recording attaches via the existing Mux pipeline once the coach uploads
    # the post-event video.
    recording_mux_upload_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None, index=True
    )
    recording_mux_asset_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    recording_mux_playback_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    recording_mux_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None
    )
    recording_released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    # "scheduled" | "cancelled". We don't delete past events.
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="scheduled", server_default="scheduled"
    )

    # Flags used by the reminder worker to make scheduling idempotent.
    reminder_24h_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    reminder_1h_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def course(cls) -> Mapped["Course"]:
        return relationship("Course", lazy="raise")
