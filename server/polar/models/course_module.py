from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course import Course
    from polar.models.course_lesson import CourseLesson


class CourseModule(RecordModel):
    __tablename__ = "course_modules"

    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    @declared_attr
    def course(cls) -> Mapped["Course"]:
        return relationship("Course", lazy="raise", back_populates="modules")

    @declared_attr
    def lessons(cls) -> Mapped[list["CourseLesson"]]:
        return relationship(
            "CourseLesson",
            lazy="selectin",
            order_by="CourseLesson.position",
            cascade="all, delete-orphan",
            back_populates="module",
        )
