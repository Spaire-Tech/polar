from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import FundState
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum


class FundStateEntry(RecordModel):
    """Tracks the lifecycle state of individual fund amounts per account.

    Each entry represents a discrete amount of funds in a specific state.
    State transitions are recorded by updating the state and logging the
    previous state and reason.
    """

    __tablename__ = "fund_state_entries"

    account_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("accounts.id"), nullable=False, index=True
    )
    transaction_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("transactions.id"), nullable=True
    )
    state: Mapped[FundState] = mapped_column(
        StringEnum(FundState), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="usd")

    # When the pending window expires (only set for pending state)
    pending_until: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    # When state last changed
    transitioned_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    previous_state: Mapped[str | None] = mapped_column(String(20), nullable=True)
    transition_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_fund_state_entries_account_state", "account_id", "state"),
        Index(
            "ix_fund_state_entries_pending_until",
            "account_id",
            "pending_until",
            postgresql_where="state = 'pending'",
        ),
    )

    @declared_attr
    def account(cls) -> Mapped["Account"]:  # noqa: N805
        from polar.models.account import Account

        return relationship(Account, lazy="raise")


class FundStateSnapshot(RecordModel):
    """Cached aggregate of fund state amounts per account.

    Updated by the risk-clearance policy gate on each recalculation.
    Read by the authorization fast-path and dashboard APIs.
    """

    __tablename__ = "fund_state_snapshots"

    account_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("accounts.id"), nullable=False, unique=True
    )
    pending_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    available_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    reserve_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    spendable_amount: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )
    last_recalculated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    policy_config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    @property
    def total_amount(self) -> int:
        return (
            self.pending_amount
            + self.available_amount
            + self.reserve_amount
            + self.spendable_amount
        )

    @declared_attr
    def account(cls) -> Mapped["Account"]:  # noqa: N805
        from polar.models.account import Account

        return relationship(Account, lazy="raise")


class FundPolicy(RecordModel):
    """Policy configuration for the fund lifecycle engine.

    A row with account_id=NULL serves as the global default.
    Per-account rows override the global default.
    """

    __tablename__ = "fund_policies"

    account_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("accounts.id"), nullable=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pending_window_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=7
    )
    reserve_floor_basis_points: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1000  # 10%
    )

    __table_args__ = (
        UniqueConstraint("account_id", name="uq_fund_policy_account"),
    )

    @declared_attr
    def account(cls) -> Mapped["Account | None"]:  # noqa: N805
        from polar.models.account import Account

        return relationship(Account, lazy="raise")
