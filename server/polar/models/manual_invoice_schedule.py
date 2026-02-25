from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
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
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import Customer, Organization
    from polar.models.manual_invoice import ManualInvoice
    from polar.models.manual_invoice_schedule_item import ManualInvoiceScheduleItem


class ManualInvoiceScheduleStatus(StrEnum):
    active = "active"
    paused = "paused"
    canceled = "canceled"


class ManualInvoiceSchedule(MetadataMixin, RecordModel):
    __tablename__ = "manual_invoice_schedules"

    status: Mapped[ManualInvoiceScheduleStatus] = mapped_column(
        String,
        nullable=False,
        default=ManualInvoiceScheduleStatus.active,
        index=True,
    )

    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    # Customer billing info (template)
    billing_name: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    # Free-form memo included on generated invoices
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    # Recurrence configuration
    recurring_interval: Mapped[SubscriptionRecurringInterval] = mapped_column(
        String, nullable=False
    )
    recurring_interval_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1
    )

    # Schedule dates
    next_issue_date: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    last_issued_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    # Automation flags
    auto_issue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auto_send_email: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # --- Foreign Keys ---

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id"), nullable=False, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    # --- Relationships ---

    items: Mapped[list["ManualInvoiceScheduleItem"]] = relationship(
        "ManualInvoiceScheduleItem",
        back_populates="schedule",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    invoices: Mapped[list["ManualInvoice"]] = relationship(
        "ManualInvoice",
        back_populates="schedule",
        lazy="raise",
        foreign_keys="ManualInvoice.schedule_id",
    )

    # --- Computed amounts ---

    @property
    def subtotal_amount(self) -> int:
        return sum(item.amount for item in self.items)

    @property
    def total_amount(self) -> int:
        return self.subtotal_amount
