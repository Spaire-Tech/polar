from datetime import datetime
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import ResourceNotFound
from polar.kit.metadata import MetadataInputMixin, MetadataOutputMixin
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.manual_invoice_schedule import ManualInvoiceScheduleStatus

ManualInvoiceScheduleID = Annotated[
    UUID4, Path(description="The manual invoice schedule ID.")
]

ManualInvoiceScheduleNotFound = {
    "description": "Manual invoice schedule not found.",
    "model": ResourceNotFound.schema(),
}


# --- Item schemas ---


class ManualInvoiceScheduleItemCreate(Schema):
    description: str = Field(description="Line item description.")
    quantity: int = Field(default=1, ge=1, description="Quantity.")
    unit_amount: int = Field(ge=0, description="Unit amount in cents.")


class ManualInvoiceScheduleItemRead(TimestampedSchema, IDSchema):
    description: str
    quantity: int
    unit_amount: int
    amount: int = Field(description="Total amount (quantity * unit_amount) in cents.")


# --- Schedule schemas ---


class ManualInvoiceScheduleCreate(MetadataInputMixin):
    organization_id: UUID4 = Field(description="The organization (seller) ID.")
    customer_id: UUID4 = Field(description="The customer ID.")
    currency: str = Field(
        min_length=3, max_length=3, description="ISO 4217 currency code."
    )
    billing_name: str | None = Field(default=None, description="Customer billing name.")
    notes: str | None = Field(default=None, description="Free-form memo.")
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="Recurrence interval (day, week, month, year)."
    )
    recurring_interval_count: int = Field(
        default=1, ge=1, description="Number of intervals between invoices."
    )
    next_issue_date: datetime = Field(
        description="When the first invoice should be generated."
    )
    auto_issue: bool = Field(
        default=False,
        description="Automatically issue generated invoices.",
    )
    auto_send_email: bool = Field(
        default=False,
        description="Automatically send email after issuing.",
    )
    items: list[ManualInvoiceScheduleItemCreate] = Field(
        default_factory=list, description="Line items template."
    )


class ManualInvoiceScheduleUpdate(Schema):
    customer_id: UUID4 | None = Field(default=None)
    billing_name: str | None = Field(default=None)
    notes: str | None = Field(default=None)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    recurring_interval: SubscriptionRecurringInterval | None = Field(default=None)
    recurring_interval_count: int | None = Field(default=None, ge=1)
    next_issue_date: datetime | None = Field(default=None)
    auto_issue: bool | None = Field(default=None)
    auto_send_email: bool | None = Field(default=None)
    items: list[ManualInvoiceScheduleItemCreate] | None = Field(
        default=None, description="Replace all line items."
    )


class ManualInvoiceScheduleRead(MetadataOutputMixin, TimestampedSchema, IDSchema):
    status: ManualInvoiceScheduleStatus
    currency: str
    billing_name: str | None
    notes: str | None
    recurring_interval: SubscriptionRecurringInterval
    recurring_interval_count: int
    next_issue_date: datetime
    last_issued_at: datetime | None
    auto_issue: bool
    auto_send_email: bool
    organization_id: UUID4
    customer_id: UUID4
    subtotal_amount: int = Field(description="Sum of all item amounts in cents.")
    total_amount: int = Field(description="Total amount in cents.")
    items: list[ManualInvoiceScheduleItemRead]
