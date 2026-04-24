from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course_module import CourseModule


class CourseLesson(RecordModel):
    __tablename__ = "course_lessons"

    module_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("course_modules.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)

    content_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="text",
    )

    content: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)

    video_asset_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )

    duration_seconds: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_free_preview: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Mux video fields
    mux_upload_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None, index=True
    )
    mux_asset_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    mux_playback_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    mux_status: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None
    )

    @declared_attr
    def module(cls) -> Mapped["CourseModule"]:
        return relationship("CourseModule", lazy="raise", back_populates="lessons")
