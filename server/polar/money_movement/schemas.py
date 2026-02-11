from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.money_movement import (
    OutboundPaymentStatus,
    OutboundTransferStatus,
    PaymentMethod,
    RecipientType,
)


# ── Recipient schemas ──


class RecipientCreate(Schema):
    """Parameters for creating a payment recipient."""

    name: str = Field(max_length=255)
    email: str | None = Field(default=None, max_length=254)
    type: RecipientType = RecipientType.individual
    bank_name: str | None = Field(default=None, max_length=255)
    last4: str | None = Field(default=None, max_length=4)
    routing_number_last4: str | None = Field(default=None, max_length=4)
    stripe_payment_method_id: str | None = Field(
        default=None,
        description="Stripe PaymentMethod ID for recipient's bank account",
    )
    billing_address: dict[str, str] = Field(
        default_factory=dict,
        description="Billing address (required for wire transfers)",
    )


class RecipientUpdate(Schema):
    """Parameters for updating a payment recipient."""

    name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=254)
    stripe_payment_method_id: str | None = None
    billing_address: dict[str, str] | None = None


class RecipientRead(TimestampedSchema):
    """Read schema for a payment recipient."""

    id: UUID
    account_id: UUID
    name: str
    email: str | None = None
    type: RecipientType
    bank_name: str | None = None
    last4: str | None = None
    routing_number_last4: str | None = None
    billing_address: dict[str, object]


# ── Outbound Payment schemas ──


class OutboundPaymentCreate(Schema):
    """Parameters for creating an outbound payment to a recipient."""

    recipient_id: UUID
    amount: int = Field(gt=0, description="Amount in cents")
    currency: str = "usd"
    method: PaymentMethod = PaymentMethod.ach
    description: str | None = Field(default=None, max_length=500)
    statement_descriptor: str | None = Field(default=None, max_length=100)


class OutboundPaymentRead(TimestampedSchema):
    """Read schema for an outbound payment."""

    id: UUID
    account_id: UUID
    financial_account_id: UUID
    recipient_id: UUID | None = None
    stripe_outbound_payment_id: str | None = None
    amount: int
    currency: str
    method: PaymentMethod
    status: OutboundPaymentStatus
    description: str | None = None
    statement_descriptor: str | None = None
    expected_arrival_date: date | None = None
    failure_reason: str | None = None


# ── Outbound Transfer schemas ──


class OutboundTransferCreate(Schema):
    """Parameters for creating an outbound transfer to the merchant's own bank."""

    amount: int = Field(gt=0, description="Amount in cents")
    currency: str = "usd"
    method: PaymentMethod = PaymentMethod.ach
    destination_payment_method_id: str = Field(
        description="Stripe PaymentMethod ID for merchant's own bank account"
    )
    description: str | None = Field(default=None, max_length=500)


class OutboundTransferRead(TimestampedSchema):
    """Read schema for an outbound transfer."""

    id: UUID
    account_id: UUID
    financial_account_id: UUID
    stripe_outbound_transfer_id: str | None = None
    amount: int
    currency: str
    method: PaymentMethod
    status: OutboundTransferStatus
    description: str | None = None
    expected_arrival_date: date | None = None
    failure_reason: str | None = None
