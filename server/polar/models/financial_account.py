from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from .account import Account


class FinancialAccountStatus(StrEnum):
    open = "open"
    closed = "closed"

    def get_display_name(self) -> str:
        return {
            FinancialAccountStatus.open: "Open",
            FinancialAccountStatus.closed: "Closed",
        }[self]


class FinancialAccount(RecordModel):
    """A Stripe Treasury Financial Account linked to a Custom connected account.

    Holds spendable merchant funds as operating cash. Funds flow here
    after clearing the fund-state lifecycle engine.
    """

    __tablename__ = "financial_accounts"

    account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("accounts.id"),
        nullable=False,
        index=True,
    )
    """FK to the merchant Account that owns this financial account."""

    stripe_financial_account_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True
    )
    """Stripe Financial Account ID (fa_xxx)."""

    status: Mapped[FinancialAccountStatus] = mapped_column(
        StringEnum(FinancialAccountStatus),
        nullable=False,
        default=FinancialAccountStatus.open,
    )

    supported_currencies: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=lambda: ["usd"]
    )

    # ABA routing info (populated when financial_addresses.aba feature activates)
    aba_routing_number: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )
    aba_account_number_last4: Mapped[str | None] = mapped_column(
        String(4), nullable=True
    )

    # Feature activation status from Stripe
    features_status: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    # Cached balances (synced from Stripe)
    balance_cash: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )
    """Cash balance in cents — funds immediately available."""

    balance_inbound_pending: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )
    """Inbound pending balance in cents — funds expected to arrive."""

    balance_outbound_pending: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )
    """Outbound pending balance in cents — funds in transit out."""

    @declared_attr
    def account(cls) -> Mapped["Account"]:  # noqa: N805
        return relationship("Account", lazy="raise")

    @property
    def effective_balance(self) -> int:
        """Cash minus outbound pending — what's actually spendable right now."""
        return self.balance_cash - self.balance_outbound_pending

    def is_open(self) -> bool:
        return self.status == FinancialAccountStatus.open

    def has_feature(self, feature: str) -> bool:
        """Check if a specific feature is active on this FA."""
        status = self.features_status.get(feature, {})
        if isinstance(status, dict):
            return status.get("status") == "active"
        return status == "active"
