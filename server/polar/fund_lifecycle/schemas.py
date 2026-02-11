from datetime import datetime
from uuid import UUID

from pydantic import Field

from polar.enums import FundState, IssuingStatus
from polar.kit.schemas import Schema, TimestampedSchema


class FundStateSummary(Schema):
    """Aggregated fund state breakdown for a merchant account."""

    pending_amount: int = Field(description="Amount in cents pending clearance")
    available_amount: int = Field(description="Amount in cents cleared by policy")
    reserve_amount: int = Field(description="Amount in cents held for risk coverage")
    spendable_amount: int = Field(
        description="Amount in cents available for card spend, ACH/wire, or transfer"
    )
    total_amount: int = Field(description="Total across all states")


class FundStateStatus(Schema):
    """Full fund lifecycle status for an organization."""

    fund_summary: FundStateSummary
    issuing_status: IssuingStatus
    restrictions: list[str] = Field(
        default_factory=list, description="Active restriction reasons, if any"
    )
    pending_explanation: str | None = Field(
        default=None,
        description="Human-readable explanation of pending funds",
    )
    reserve_explanation: str | None = Field(
        default=None,
        description="Human-readable explanation of reserve hold",
    )
    last_recalculated_at: datetime | None = Field(
        default=None,
        description="When the fund states were last recalculated",
    )


class FundStateEntryRead(TimestampedSchema):
    """Individual fund state entry."""

    id: UUID
    account_id: UUID
    state: FundState
    amount: int
    currency: str
    pending_until: datetime | None = None
    transitioned_at: datetime | None = None
    previous_state: str | None = None
    transition_reason: str | None = None


class FundPolicyRead(TimestampedSchema):
    """Fund policy configuration."""

    id: UUID
    account_id: UUID | None
    enabled: bool
    pending_window_days: int
    reserve_floor_basis_points: int


class FundPolicyUpdate(Schema):
    """Update fund policy parameters."""

    enabled: bool | None = None
    pending_window_days: int | None = Field(
        default=None, ge=0, le=90, description="Days funds stay pending (0-90)"
    )
    reserve_floor_basis_points: int | None = Field(
        default=None,
        ge=0,
        le=10000,
        description="Reserve floor in basis points (0-10000, i.e. 0%-100%)",
    )
