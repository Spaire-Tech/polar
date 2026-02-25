from datetime import datetime
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.exceptions import ResourceNotFound
from polar.kit.address import Address
from polar.kit.metadata import MetadataInputMixin, MetadataOutputMixin
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.manual_invoice import ManualInvoiceStatus

ManualInvoiceID = Annotated[UUID4, Path(description="The manual invoice ID.")]

ManualInvoiceNotFound = {
    "description": "Manual invoice not found.",
    "model": ResourceNotFound.schema(),
}


# --- Item schemas ---


class ManualInvoiceItemCreate(Schema):
    description: str = Field(description="Line item description.")
    quantity: int = Field(default=1, ge=1, description="Quantity.")
    unit_amount: int = Field(ge=0, description="Unit amount in cents.")


class ManualInvoiceItemRead(TimestampedSchema, IDSchema):
    description: str
    quantity: int
    unit_amount: int
    amount: int = Field(description="Total amount (quantity * unit_amount) in cents.")


# --- Invoice schemas ---


class ManualInvoiceCreate(MetadataInputMixin):
    organization_id: UUID4 = Field(description="The organization (seller) ID.")
    currency: str = Field(
        min_length=3, max_length=3, description="ISO 4217 currency code."
    )
    customer_id: UUID4 | None = Field(
        default=None, description="Customer ID (can be set later in draft)."
    )
    billing_name: str | None = Field(default=None, description="Customer billing name.")
    notes: str | None = Field(default=None, description="Free-form memo on the invoice.")
    items: list[ManualInvoiceItemCreate] = Field(
        default_factory=list, description="Line items."
    )


class ManualInvoiceUpdate(Schema):
    customer_id: UUID4 | None = Field(default=None, description="Customer ID.")
    billing_name: str | None = Field(default=None, description="Customer billing name.")
    notes: str | None = Field(default=None, description="Free-form memo.")
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    items: list[ManualInvoiceItemCreate] | None = Field(
        default=None, description="Replace all line items."
    )


class ManualInvoiceRead(MetadataOutputMixin, TimestampedSchema, IDSchema):
    status: ManualInvoiceStatus
    currency: str
    billing_name: str | None
    billing_address: Address | None
    notes: str | None
    invoice_number: str | None
    due_date: datetime | None
    issued_at: datetime | None
    paid_at: datetime | None
    voided_at: datetime | None
    checkout_url: str | None = Field(
        default=None, description="Payment link URL for the customer."
    )
    email_sent_at: datetime | None = Field(
        default=None, description="When the invoice email was last sent."
    )
    organization_id: UUID4
    customer_id: UUID4 | None
    order_id: UUID4 | None
    schedule_id: UUID4 | None = Field(
        default=None, description="Recurring schedule that generated this invoice."
    )
    subtotal_amount: int = Field(description="Sum of all item amounts in cents.")
    total_amount: int = Field(description="Total amount in cents.")
    items: list[ManualInvoiceItemRead]
