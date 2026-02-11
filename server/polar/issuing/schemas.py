from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.issuing import (
    CardholderStatus,
    CardholderType,
    IssuedCardStatus,
    IssuedCardType,
)


# ── Cardholder schemas ──


class CardholderCreate(Schema):
    """Parameters for creating a Cardholder."""

    name: str = Field(max_length=255)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=20)
    type: CardholderType = CardholderType.individual
    billing_address: dict[str, str] = Field(
        description="Billing address with keys: line1, city, state, postal_code, country"
    )


class CardholderUpdate(Schema):
    """Parameters for updating a Cardholder."""

    name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=20)
    status: CardholderStatus | None = None
    billing_address: dict[str, str] | None = None


class CardholderRead(TimestampedSchema):
    """Read schema for a Cardholder."""

    id: UUID
    account_id: UUID
    stripe_cardholder_id: str
    name: str
    email: str | None = None
    phone: str | None = None
    type: CardholderType
    status: CardholderStatus
    billing_address: dict[str, object]


# ── Issued Card schemas ──


class IssuedCardCreate(Schema):
    """Parameters for creating an Issued Card."""

    cardholder_id: UUID
    type: IssuedCardType = IssuedCardType.virtual
    status: IssuedCardStatus = IssuedCardStatus.active
    spending_controls: dict[str, object] | None = Field(
        default=None,
        description=(
            "Stripe spending controls: spending_limits, "
            "allowed_categories, blocked_categories"
        ),
    )


class IssuedCardUpdate(Schema):
    """Parameters for updating an Issued Card."""

    status: IssuedCardStatus | None = None
    spending_controls: dict[str, object] | None = None


class IssuedCardRead(TimestampedSchema):
    """Read schema for an Issued Card."""

    id: UUID
    cardholder_id: UUID
    financial_account_id: UUID
    stripe_card_id: str
    type: IssuedCardType
    status: IssuedCardStatus
    last4: str | None = None
    exp_month: int | None = None
    exp_year: int | None = None
    spending_controls: dict[str, object]
    shipping_status: str | None = None
    canceled_reason: str | None = None


# ── Authorization schemas ──


class AuthorizationDecision(Schema):
    """Result of an authorization evaluation."""

    approved: bool
    reason: str | None = None
    amount: int | None = Field(
        default=None,
        description="Approved amount (if partial approval)",
    )
