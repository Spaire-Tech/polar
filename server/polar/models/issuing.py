from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from .account import Account


class CardholderType(StrEnum):
    individual = "individual"
    company = "company"


class CardholderStatus(StrEnum):
    active = "active"
    inactive = "inactive"
    blocked = "blocked"


class IssuedCardType(StrEnum):
    virtual = "virtual"
    physical = "physical"


class IssuedCardStatus(StrEnum):
    active = "active"
    inactive = "inactive"
    canceled = "canceled"


class Cardholder(RecordModel):
    """A Stripe Issuing Cardholder linked to a Custom connected account.

    Represents a person or company authorized to carry issued cards.
    """

    __tablename__ = "cardholders"

    account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("accounts.id"),
        nullable=False,
        index=True,
    )

    stripe_cardholder_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    type: Mapped[CardholderType] = mapped_column(
        StringEnum(CardholderType),
        nullable=False,
        default=CardholderType.individual,
    )

    status: Mapped[CardholderStatus] = mapped_column(
        StringEnum(CardholderStatus),
        nullable=False,
        default=CardholderStatus.active,
    )

    billing_address: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    @declared_attr
    def account(cls) -> Mapped["Account"]:  # noqa: N805
        return relationship("Account", lazy="raise")


class IssuedCard(RecordModel):
    """A Stripe Issuing Card linked to a Cardholder and Financial Account.

    Represents a virtual or physical card that spends from the
    merchant's Treasury Financial Account.
    """

    __tablename__ = "issued_cards"

    cardholder_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("cardholders.id"),
        nullable=False,
        index=True,
    )

    financial_account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("financial_accounts.id"),
        nullable=False,
        index=True,
    )

    stripe_card_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True
    )

    type: Mapped[IssuedCardType] = mapped_column(
        StringEnum(IssuedCardType), nullable=False
    )

    status: Mapped[IssuedCardStatus] = mapped_column(
        StringEnum(IssuedCardStatus),
        nullable=False,
        default=IssuedCardStatus.inactive,
    )

    last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    exp_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exp_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    spending_controls: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    # Physical card shipping
    shipping_status: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    shipping_tracking_number: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    canceled_reason: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    @declared_attr
    def cardholder(cls) -> Mapped["Cardholder"]:  # noqa: N805
        return relationship("Cardholder", lazy="raise")

    @declared_attr
    def financial_account(cls) -> Mapped["FinancialAccount"]:  # noqa: N805
        from .financial_account import FinancialAccount

        return relationship("FinancialAccount", lazy="raise")

    def is_active(self) -> bool:
        return self.status == IssuedCardStatus.active
