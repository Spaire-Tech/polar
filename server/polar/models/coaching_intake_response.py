from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.coaching_intake_form import CoachingIntakeForm
    from polar.models.course_enrollment import CourseEnrollment
    from polar.models.customer import Customer


class CoachingIntakeResponse(RecordModel):
    """A customer's submitted answers to the coaching program's intake form.

    Keyed on (form_id, customer_id) so a customer has at most one current
    response per form. Re-submission updates `answers_json` + bumps
    `submitted_at` rather than creating a new row.
    """

    __tablename__ = "coaching_intake_responses"
    __table_args__ = (
        UniqueConstraint(
            "form_id",
            "customer_id",
            name="coaching_intake_responses_form_customer_key",
        ),
    )

    form_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("coaching_intake_forms.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    enrollment_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("course_enrollments.id", ondelete="set null"),
        nullable=True,
    )

    # {field_id: value} where value is a string for short/long_text/email and
    # select, or a list[str] for multiselect.
    answers_json: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    @declared_attr
    def form(cls) -> Mapped["CoachingIntakeForm"]:
        return relationship("CoachingIntakeForm", lazy="raise")

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    @declared_attr
    def enrollment(cls) -> Mapped["CourseEnrollment"]:
        return relationship("CourseEnrollment", lazy="raise")
