from datetime import date, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course import Course
    from polar.models.product import Product


class CoachingProgram(RecordModel):
    __tablename__ = "coaching_programs"

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
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

    title: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    slug: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None, index=True
    )

    format: Mapped[str] = mapped_column(
        String(20), nullable=False, default="self"
    )

    cohort_start: Mapped[date | None] = mapped_column(
        Date, nullable=True, default=None
    )

    cohort_end: Mapped[date | None] = mapped_column(
        Date, nullable=True, default=None
    )

    weeks: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    promise: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    coach_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )

    coach_bio: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    coach_credentials: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    coach_photo_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    thumbnail_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    trailer_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, default=None
    )

    pricing_model: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None
    )

    access_duration: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None
    )

    free_preview: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    landing_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True, default=None
    )

    intake_questions: Mapped[list[Any] | None] = mapped_column(
        JSONB, nullable=True, default=None
    )

    session_ideas: Mapped[list[Any] | None] = mapped_column(
        JSONB, nullable=True, default=None
    )

    ai_generated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    course_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        index=True,
    )

    published_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None, index=True
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise")

    @declared_attr
    def course(cls) -> Mapped["Course | None"]:
        return relationship("Course", lazy="raise")
