from datetime import datetime
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.financial_account import FinancialAccountStatus


class FinancialAccountBalance(Schema):
    """Balance breakdown for a Financial Account."""

    cash: int = Field(description="Cash balance in cents — immediately available")
    inbound_pending: int = Field(
        description="Inbound pending balance in cents — funds expected to arrive"
    )
    outbound_pending: int = Field(
        description="Outbound pending balance in cents — funds in transit out"
    )
    effective: int = Field(
        description="Effective balance in cents — cash minus outbound pending"
    )


class FinancialAccountRead(TimestampedSchema):
    """Read schema for a Financial Account."""

    id: UUID
    account_id: UUID
    stripe_financial_account_id: str
    status: FinancialAccountStatus
    supported_currencies: list[str]
    aba_routing_number: str | None = None
    aba_account_number_last4: str | None = None
    features_status: dict[str, object] = Field(default_factory=dict)
    balance: FinancialAccountBalance
    last_synced_at: datetime | None = None


class FinancialAccountCreate(Schema):
    """Parameters for creating a Financial Account."""

    supported_currencies: list[str] = Field(
        default_factory=lambda: ["usd"],
        description="Supported currencies (default: ['usd'])",
    )


class TreasuryTransactionRead(Schema):
    """Read schema for a Treasury transaction from Stripe."""

    id: str = Field(description="Stripe transaction ID")
    amount: int = Field(description="Amount in cents")
    currency: str
    description: str | None = None
    status: str
    flow_type: str | None = None
    created: datetime


class TreasuryTransactionList(Schema):
    """Paginated list of Treasury transactions."""

    items: list[TreasuryTransactionRead]
    has_more: bool
