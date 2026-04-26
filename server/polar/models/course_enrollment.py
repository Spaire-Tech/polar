from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course import Course
    from polar.models.customer import Customer


class CourseEnrollment(RecordModel):
    __tablename__ = "course_enrollments"

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    enrolled_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    @declared_attr
    def course(cls) -> Mapped["Course"]:
        return relationship("Course", lazy="selectin")
