from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import BigInteger

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .organization import Organization


class FinancialAccountStatus(StrEnum):
    pending = "pending"
    open = "open"
    closed = "closed"
    restricted = "restricted"

    @classmethod
    def from_stripe(cls, status: str) -> "FinancialAccountStatus":
        if status == "open":
            return cls.open
        if status == "closed":
            return cls.closed
        if status == "restricted":
            return cls.restricted
        return cls.pending


class FinancialAccount(RecordModel):
    __tablename__ = "financial_accounts"

    stripe_financial_account_id: Mapped[str] = mapped_column(
        String, nullable=False, unique=True, index=True
    )
    """Stripe Treasury Financial Account ID (e.g. fa_xxx)."""

    status: Mapped[FinancialAccountStatus] = mapped_column(
        StringEnum(FinancialAccountStatus),
        nullable=False,
        index=True,
        default=FinancialAccountStatus.pending,
    )
    """Status of the financial account in Stripe."""

    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="usd")
    """Currency of the financial account."""

    balance_cash: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )
    """Cash balance in cents. Updated from Stripe webhooks."""

    balance_inbound_pending: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )
    """Inbound pending balance in cents."""

    balance_outbound_pending: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )
    """Outbound pending balance in cents."""

    aba_routing_number: Mapped[str | None] = mapped_column(
        String, nullable=True
    )
    """ABA routing number for the financial account."""

    aba_account_number: Mapped[str | None] = mapped_column(
        String, nullable=True
    )
    """ABA account number (last 4 for display, full stored in Stripe)."""

    features_card_issuing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    """Whether card issuing is enabled."""

    features_deposit_insurance: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    """Whether FDIC deposit insurance is active."""

    features_inbound_transfers_ach: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    """Whether ACH inbound transfers are enabled."""

    features_outbound_payments_ach: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    """Whether ACH outbound payments are enabled."""

    features_outbound_transfers_ach: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    """Whether ACH outbound transfers are enabled."""

    stripe_connected_account_id: Mapped[str] = mapped_column(
        String, nullable=False, index=True
    )
    """Stripe Connect account ID that owns this financial account."""

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        unique=True,
        index=True,
    )
    """Organization that owns this financial account."""

    organization: Mapped["Organization"] = relationship(
        "Organization", lazy="raise"
    )

    onboarding_completed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    """Timestamp when the onboarding was completed."""

    @property
    def available_balance(self) -> int:
        """Total spendable balance."""
        return self.balance_cash

    @property
    def pending_balance(self) -> int:
        """Total pending incoming."""
        return self.balance_inbound_pending

    @property
    def is_active(self) -> bool:
        return self.status == FinancialAccountStatus.open
