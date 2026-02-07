from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.sqltypes import BigInteger

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .financial_account import FinancialAccount


class TreasuryTransactionType(StrEnum):
    received_credit = "received_credit"
    received_debit = "received_debit"
    outbound_payment = "outbound_payment"
    outbound_transfer = "outbound_transfer"
    inbound_transfer = "inbound_transfer"
    issuing_authorization = "issuing_authorization"
    other = "other"


class TreasuryTransactionStatus(StrEnum):
    open = "open"
    posted = "posted"
    void = "void"


class TreasuryTransaction(RecordModel):
    __tablename__ = "treasury_transactions"

    stripe_transaction_id: Mapped[str] = mapped_column(
        String, nullable=False, unique=True, index=True
    )
    """Stripe Treasury Transaction ID."""

    transaction_type: Mapped[TreasuryTransactionType] = mapped_column(
        StringEnum(TreasuryTransactionType),
        nullable=False,
        index=True,
    )
    """Type of treasury transaction."""

    status: Mapped[TreasuryTransactionStatus] = mapped_column(
        StringEnum(TreasuryTransactionStatus),
        nullable=False,
        index=True,
        default=TreasuryTransactionStatus.open,
    )
    """Status of the transaction."""

    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    """Amount in cents. Positive for credits, negative for debits."""

    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="usd")
    """Transaction currency."""

    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    """Human-readable description of the transaction."""

    flow_type: Mapped[str | None] = mapped_column(String, nullable=True)
    """The type of the linked flow (e.g. 'outbound_payment', 'received_credit')."""

    flow_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    """ID of the linked flow object."""

    counterparty_name: Mapped[str | None] = mapped_column(String, nullable=True)
    """Name of the counterparty (e.g. sender/receiver)."""

    financial_account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("financial_accounts.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    """Financial account this transaction belongs to."""

    financial_account: Mapped["FinancialAccount"] = relationship(
        "FinancialAccount", lazy="raise"
    )
