from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.coaching_cohort import CoachingCohort
    from polar.models.course_enrollment import CourseEnrollment


class CoachingCohortEnrollment(RecordModel):
    """Join row between a CoachingCohort and a CourseEnrollment.

    Kept as a separate table (rather than a `cohort_id` column on
    `course_enrollments`) so the standard course pipeline stays untouched
    for non-coaching products. A given enrollment can only belong to one
    cohort at a time, enforced by the unique constraint on `enrollment_id`.
    """

    __tablename__ = "coaching_cohort_enrollments"
    __table_args__ = (
        UniqueConstraint(
            "enrollment_id",
            name="coaching_cohort_enrollments_enrollment_id_key",
        ),
    )

    cohort_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("coaching_cohorts.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    enrollment_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("course_enrollments.id", ondelete="cascade"),
        nullable=False,
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    @declared_attr
    def cohort(cls) -> Mapped["CoachingCohort"]:
        return relationship("CoachingCohort", lazy="raise")

    @declared_attr
    def enrollment(cls) -> Mapped["CourseEnrollment"]:
        return relationship("CourseEnrollment", lazy="raise")
