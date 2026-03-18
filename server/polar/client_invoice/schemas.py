from datetime import date
from typing import Any

from pydantic import UUID4, Field, field_validator

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.client_invoice import ClientInvoiceStatus


class ClientInvoiceLineItemCreate(Schema):
    description: str = Field(description="Line item description shown on the invoice.")
    quantity: int = Field(default=1, ge=1, description="Quantity.")
    unit_amount: int = Field(
        ge=1, description="Unit price in the smallest currency unit (e.g. cents)."
    )


class ClientInvoiceCreate(Schema):
    customer_id: UUID4 = Field(description="ID of the Spaire customer to invoice.")
    currency: str = Field(
        min_length=3, max_length=3, description="ISO 4217 currency code (e.g. 'usd')."
    )
    line_items: list[ClientInvoiceLineItemCreate] = Field(
        min_length=1, description="Invoice line items. At least one required."
    )
    due_date: date | None = Field(
        default=None,
        description="Payment due date. Determines days_until_due on the Stripe invoice.",
    )
    memo: str | None = Field(
        default=None, description="Internal memo / invoice description."
    )
    po_number: str | None = Field(
        default=None, max_length=64, description="Purchase order number."
    )
    on_behalf_of_label: str | None = Field(
        default=None,
        description=(
            "Name shown in 'on behalf of' display on the invoice. "
            "Defaults to the organization name."
        ),
    )
    discount_amount: int = Field(
        default=0,
        ge=0,
        description="Flat discount amount in the smallest currency unit (e.g. cents). Applied before tax.",
    )
    discount_label: str | None = Field(
        default=None,
        description="Label shown for the discount line on the invoice (e.g. 'Promo code').",
    )
    include_payment_link: bool = Field(
        default=True,
        description="Whether to include a hosted payment link in the invoice email.",
    )
    user_metadata: dict[str, Any] | None = Field(
        default=None,
        description="Arbitrary key-value metadata to attach to the invoice.",
    )

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        return v.lower()


class ClientInvoiceLineItemSchema(TimestampedSchema, IDSchema):
    client_invoice_id: UUID4
    stripe_invoice_item_id: str | None
    description: str
    quantity: int
    unit_amount: int
    currency: str
    amount: int
    tax_amount: int


class ClientInvoiceSchema(TimestampedSchema, IDSchema):
    organization_id: UUID4
    customer_id: UUID4
    stripe_invoice_id: str | None
    status: ClientInvoiceStatus
    currency: str
    subtotal_amount: int
    discount_amount: int
    tax_amount: int
    total_amount: int
    memo: str | None
    po_number: str | None
    due_date: date | None
    on_behalf_of_label: str | None
    discount_label: str | None
    include_payment_link: bool
    stripe_hosted_invoice_url: str | None
    checkout_link: str | None
    user_metadata: dict[str, Any] | None
    order_id: UUID4 | None
    line_items: list[ClientInvoiceLineItemSchema] = Field(default_factory=list)
