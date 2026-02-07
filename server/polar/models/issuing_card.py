from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import BigInteger

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .financial_account import FinancialAccount
    from .organization import Organization


class IssuingCardStatus(StrEnum):
    inactive = "inactive"
    active = "active"
    canceled = "canceled"

    @classmethod
    def from_stripe(cls, status: str) -> "IssuingCardStatus":
        if status == "active":
            return cls.active
        if status == "canceled":
            return cls.canceled
        return cls.inactive


class IssuingCardType(StrEnum):
    virtual = "virtual"
    physical = "physical"


class SpendingLimitInterval(StrEnum):
    per_authorization = "per_authorization"
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"
    all_time = "all_time"


class IssuingCard(RecordModel):
    __tablename__ = "issuing_cards"

    stripe_card_id: Mapped[str] = mapped_column(
        String, nullable=False, unique=True, index=True
    )
    """Stripe Issuing Card ID (e.g. ic_xxx)."""

    stripe_cardholder_id: Mapped[str] = mapped_column(
        String, nullable=False, index=True
    )
    """Stripe Issuing Cardholder ID."""

    status: Mapped[IssuingCardStatus] = mapped_column(
        StringEnum(IssuingCardStatus),
        nullable=False,
        index=True,
        default=IssuingCardStatus.inactive,
    )
    """Card status."""

    card_type: Mapped[IssuingCardType] = mapped_column(
        StringEnum(IssuingCardType),
        nullable=False,
        default=IssuingCardType.virtual,
    )
    """Card type: virtual or physical."""

    last4: Mapped[str] = mapped_column(String(4), nullable=False)
    """Last 4 digits of the card number."""

    exp_month: Mapped[int] = mapped_column(nullable=False)
    """Card expiration month."""

    exp_year: Mapped[int] = mapped_column(nullable=False)
    """Card expiration year."""

    brand: Mapped[str] = mapped_column(
        String, nullable=False, default="Visa"
    )
    """Card brand (Visa, Mastercard, etc.)."""

    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="usd")
    """Card currency."""

    cardholder_name: Mapped[str] = mapped_column(String, nullable=False)
    """Name on the card."""

    card_color: Mapped[str] = mapped_column(
        String(7), nullable=False, default="#0062FF"
    )
    """Hex color for the card design. Customizable by the user."""

    spending_limit_amount: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )
    """Spending limit in cents. None = no limit."""

    spending_limit_interval: Mapped[SpendingLimitInterval | None] = mapped_column(
        StringEnum(SpendingLimitInterval), nullable=True
    )
    """Spending limit interval."""

    total_spent: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )
    """Total amount spent in cents. Updated from Stripe webhooks."""

    canceled_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    """Timestamp when the card was canceled."""

    financial_account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("financial_accounts.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    """Financial account this card draws funds from."""

    financial_account: Mapped["FinancialAccount"] = relationship(
        "FinancialAccount", lazy="raise"
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    """Organization that owns this card."""

    organization: Mapped["Organization"] = relationship(
        "Organization", lazy="raise"
    )

    @property
    def is_active(self) -> bool:
        return self.status == IssuingCardStatus.active

    @property
    def display_name(self) -> str:
        return f"{self.brand} ****{self.last4}"

    @property
    def expiration(self) -> str:
        return f"{self.exp_month:02d}/{self.exp_year % 100:02d}"
