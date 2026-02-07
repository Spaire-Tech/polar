from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.financial_account import FinancialAccountStatus
from polar.models.issuing_card import (
    IssuingCardStatus,
    IssuingCardType,
    SpendingLimitInterval,
)
from polar.models.treasury_transaction import (
    TreasuryTransactionStatus,
    TreasuryTransactionType,
)


# --- Financial Account Schemas ---


class FinancialAccountCreate(Schema):
    organization_id: UUID4


class FinancialAccount(IDSchema, TimestampedSchema):
    stripe_financial_account_id: str
    status: FinancialAccountStatus
    currency: str
    balance_cash: int
    balance_inbound_pending: int
    balance_outbound_pending: int
    available_balance: int
    pending_balance: int
    aba_routing_number: str | None = None
    aba_account_number: str | None = None
    features_card_issuing: bool
    features_deposit_insurance: bool
    features_inbound_transfers_ach: bool
    features_outbound_payments_ach: bool
    features_outbound_transfers_ach: bool
    organization_id: UUID4
    onboarding_completed_at: datetime | None = None
    is_active: bool


class FinancialAccountBalance(Schema):
    cash: int = Field(description="Available cash balance in cents.")
    inbound_pending: int = Field(description="Pending inbound funds in cents.")
    outbound_pending: int = Field(description="Pending outbound funds in cents.")
    currency: str


# --- Issuing Card Schemas ---


class IssuingCardCreate(Schema):
    financial_account_id: UUID4
    card_type: IssuingCardType = IssuingCardType.virtual
    cardholder_name: str = Field(
        ..., min_length=2, max_length=100, description="Name to print on the card."
    )
    card_color: str = Field(
        default="#0062FF",
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Hex color code for the card design.",
    )
    spending_limit_amount: int | None = Field(
        default=None,
        ge=0,
        description="Spending limit in cents. None for no limit.",
    )
    spending_limit_interval: SpendingLimitInterval | None = None


class IssuingCardUpdate(Schema):
    status: IssuingCardStatus | None = None
    card_color: str | None = Field(
        default=None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Hex color code for the card design.",
    )
    spending_limit_amount: int | None = None
    spending_limit_interval: SpendingLimitInterval | None = None


class IssuingCard(IDSchema, TimestampedSchema):
    stripe_card_id: str
    stripe_cardholder_id: str
    status: IssuingCardStatus
    card_type: IssuingCardType
    last4: str
    exp_month: int
    exp_year: int
    brand: str
    currency: str
    cardholder_name: str
    card_color: str
    spending_limit_amount: int | None = None
    spending_limit_interval: SpendingLimitInterval | None = None
    total_spent: int
    canceled_at: datetime | None = None
    financial_account_id: UUID4
    organization_id: UUID4
    is_active: bool
    display_name: str
    expiration: str


class IssuingCardDetails(Schema):
    """Sensitive card details - only returned on explicit request."""

    number: str
    cvc: str
    exp_month: int
    exp_year: int


# --- Treasury Transaction Schemas ---


class TreasuryTransaction(IDSchema, TimestampedSchema):
    stripe_transaction_id: str
    transaction_type: TreasuryTransactionType
    status: TreasuryTransactionStatus
    amount: int
    currency: str
    description: str
    flow_type: str | None = None
    flow_id: str | None = None
    counterparty_name: str | None = None
    financial_account_id: UUID4


# --- Onboarding Schema ---


class OnboardingStatus(Schema):
    has_financial_account: bool
    financial_account_status: FinancialAccountStatus | None = None
    has_cards: bool
    card_count: int
    is_fully_onboarded: bool
    stripe_connected_account_id: str | None = None
    requirements_pending: list[str] = []


# --- Outbound Payment Schema ---


class OutboundPaymentCreate(Schema):
    financial_account_id: UUID4
    amount: int = Field(..., gt=0, description="Amount in cents to send.")
    currency: str = "usd"
    destination_account_number: str = Field(
        ..., description="Destination bank account number."
    )
    destination_routing_number: str = Field(
        ..., description="Destination bank routing number."
    )
    description: str = Field(
        default="", max_length=500, description="Payment description."
    )
    counterparty_name: str = Field(
        ..., min_length=1, max_length=100, description="Name of the recipient."
    )
