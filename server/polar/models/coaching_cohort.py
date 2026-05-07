from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.course import Course


class CoachingCohort(RecordModel):
    __tablename__ = "coaching_cohorts"

    course_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("courses.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    # Soft cap. We don't block enrollment after a successful charge — that
    # creates chargeback risk — so this is an informational ceiling the
    # storefront can use to gate *checkout*, not the benefit grant.
    capacity: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    enrollment_open: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Marks the cohort auto-created when the coaching program was created.
    # Single-cohort programs always land enrollments here. Multi-cohort
    # programs may have additional, non-default cohorts.
    is_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    @declared_attr
    def course(cls) -> Mapped["Course"]:
        return relationship("Course", lazy="raise")
