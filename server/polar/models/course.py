from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course_module import CourseModule
    from polar.models.product import Product


class Course(RecordModel):
    __tablename__ = "courses"

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

    course_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="evergreen",
    )

    paywall_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    paywall_lesson_id: Mapped[UUID | None] = mapped_column(
        Uuid, nullable=True, default=None
    )

    paywall_position: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    ai_generated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    description: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )

    thumbnail_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    thumbnail_object_position: Mapped[str | None] = mapped_column(
        String(32), nullable=True, default=None
    )

    instructor_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )

    instructor_bio: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )

    trailer_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    instructor_name_italic: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    instructor_name_bold: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    instructor_name_uppercase: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise")

    @declared_attr
    def modules(cls) -> Mapped[list["CourseModule"]]:
        return relationship(
            "CourseModule",
            lazy="selectin",
            order_by="CourseModule.position",
            cascade="all, delete-orphan",
            back_populates="course",
        )
