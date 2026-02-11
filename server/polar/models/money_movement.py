from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import BigInteger, Date, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from .account import Account
    from .financial_account import FinancialAccount


class RecipientType(StrEnum):
    individual = "individual"
    company = "company"


class PaymentMethod(StrEnum):
    ach = "ach"
    us_domestic_wire = "us_domestic_wire"


class OutboundPaymentStatus(StrEnum):
    processing = "processing"
    posted = "posted"
    failed = "failed"
    canceled = "canceled"
    returned = "returned"


class OutboundTransferStatus(StrEnum):
    processing = "processing"
    posted = "posted"
    failed = "failed"
    canceled = "canceled"
    returned = "returned"


class PaymentRecipient(RecordModel):
    """A payee (vendor, contractor, etc.) that a merchant can send funds to.

    Stores the Stripe PaymentMethod reference for the recipient's bank account.
    """

    __tablename__ = "payment_recipients"

    account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("accounts.id"),
        nullable=False,
        index=True,
    )

    stripe_payment_method_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    """Stripe PaymentMethod ID for the recipient's bank account."""

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    type: Mapped[RecipientType] = mapped_column(
        StringEnum(RecipientType),
        nullable=False,
        default=RecipientType.individual,
    )

    # Display-only bank info (non-sensitive)
    bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    routing_number_last4: Mapped[str | None] = mapped_column(
        String(4), nullable=True
    )

    billing_address: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    """Required for wire transfers."""

    @declared_attr
    def account(cls) -> Mapped["Account"]:  # noqa: N805
        return relationship("Account", lazy="raise")


class OutboundPaymentRecord(RecordModel):
    """Record of an outbound payment (ACH/wire) to a third-party recipient.

    Maps 1:1 to a Stripe Treasury OutboundPayment.
    """

    __tablename__ = "outbound_payments"

    account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("accounts.id"),
        nullable=False,
        index=True,
    )

    financial_account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("financial_accounts.id"),
        nullable=False,
    )

    recipient_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("payment_recipients.id"),
        nullable=True,
    )

    stripe_outbound_payment_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )

    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="usd"
    )

    method: Mapped[PaymentMethod] = mapped_column(
        StringEnum(PaymentMethod), nullable=False
    )

    status: Mapped[OutboundPaymentStatus] = mapped_column(
        StringEnum(OutboundPaymentStatus),
        nullable=False,
        default=OutboundPaymentStatus.processing,
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    statement_descriptor: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    expected_arrival_date: Mapped[Any | None] = mapped_column(
        Date, nullable=True
    )
    failure_reason: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    @declared_attr
    def account(cls) -> Mapped["Account"]:  # noqa: N805
        return relationship("Account", lazy="raise")

    @declared_attr
    def financial_account(cls) -> Mapped["FinancialAccount"]:  # noqa: N805
        return relationship("FinancialAccount", lazy="raise")

    @declared_attr
    def recipient(cls) -> Mapped["PaymentRecipient | None"]:  # noqa: N805
        return relationship("PaymentRecipient", lazy="raise")

    def is_terminal(self) -> bool:
        return self.status in (
            OutboundPaymentStatus.posted,
            OutboundPaymentStatus.failed,
            OutboundPaymentStatus.canceled,
            OutboundPaymentStatus.returned,
        )


class OutboundTransferRecord(RecordModel):
    """Record of an outbound transfer to the merchant's own bank account.

    Maps 1:1 to a Stripe Treasury OutboundTransfer.
    """

    __tablename__ = "outbound_transfers"

    account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("accounts.id"),
        nullable=False,
        index=True,
    )

    financial_account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("financial_accounts.id"),
        nullable=False,
    )

    stripe_outbound_transfer_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, unique=True
    )

    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="usd"
    )

    method: Mapped[PaymentMethod] = mapped_column(
        StringEnum(PaymentMethod), nullable=False
    )

    status: Mapped[OutboundTransferStatus] = mapped_column(
        StringEnum(OutboundTransferStatus),
        nullable=False,
        default=OutboundTransferStatus.processing,
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    expected_arrival_date: Mapped[Any | None] = mapped_column(
        Date, nullable=True
    )
    failure_reason: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )

    @declared_attr
    def account(cls) -> Mapped["Account"]:  # noqa: N805
        return relationship("Account", lazy="raise")

    @declared_attr
    def financial_account(cls) -> Mapped["FinancialAccount"]:  # noqa: N805
        return relationship("FinancialAccount", lazy="raise")

    def is_terminal(self) -> bool:
        return self.status in (
            OutboundTransferStatus.posted,
            OutboundTransferStatus.failed,
            OutboundTransferStatus.canceled,
            OutboundTransferStatus.returned,
        )
