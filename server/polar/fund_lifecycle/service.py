"""Fund lifecycle service — business logic for fund state management."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from polar.account.repository import AccountRepository
from polar.enums import AccountMode, FundState, IssuingStatus
from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams
from polar.models import Account
from polar.models.fund_state import FundPolicy, FundStateEntry, FundStateSnapshot
from polar.postgres import AsyncReadSession, AsyncSession

from .engine import fund_lifecycle_engine
from .policy import resolve_policy
from .repository import (
    FundPolicyRepository,
    FundStateEntryRepository,
    FundStateSnapshotRepository,
)
from .schemas import FundPolicyRead, FundPolicyUpdate, FundStateSummary, FundStateStatus


class FundLifecycleError(PolarError):
    pass


class AccountNotTreasuryEnabled(FundLifecycleError):
    def __init__(self, account_id: uuid.UUID) -> None:
        super().__init__(
            f"Account {account_id} is not treasury-enabled "
            "(requires custom account mode)"
        )


class FundLifecycleService:
    # ── Read operations ──

    async def get_fund_status(
        self,
        session: AsyncReadSession,
        account: Account,
    ) -> FundStateStatus:
        """Get the full fund lifecycle status for an account."""
        snapshot_repo = FundStateSnapshotRepository(session)
        snapshot = await snapshot_repo.get_by_account(account.id)

        if snapshot:
            fund_summary = FundStateSummary(
                pending_amount=snapshot.pending_amount,
                available_amount=snapshot.available_amount,
                reserve_amount=snapshot.reserve_amount,
                spendable_amount=snapshot.spendable_amount,
                total_amount=snapshot.total_amount,
            )
            last_recalculated_at = snapshot.last_recalculated_at
            policy_config = snapshot.policy_config
        else:
            fund_summary = FundStateSummary(
                pending_amount=0,
                available_amount=0,
                reserve_amount=0,
                spendable_amount=0,
                total_amount=0,
            )
            last_recalculated_at = None
            policy_config = {}

        # Build restrictions list
        restrictions: list[str] = []
        if account.status == Account.Status.UNDER_REVIEW:
            restrictions.append("Account is under review")
        elif account.status == Account.Status.DENIED:
            restrictions.append("Account has been denied")
        if account.issuing_status == IssuingStatus.temporarily_restricted:
            restrictions.append("Issuing is temporarily restricted")

        # Build human-readable explanations
        pending_explanation = None
        if fund_summary.pending_amount > 0:
            window_days = policy_config.get("pending_window_days", 7)
            pending_explanation = (
                f"Funds are within the {window_days}-day pending window"
            )

        reserve_explanation = None
        if fund_summary.reserve_amount > 0:
            bps = policy_config.get("reserve_floor_basis_points", 1000)
            pct = bps / 100
            reserve_explanation = f"{pct:.1f}% reserve floor applied per policy"

        return FundStateStatus(
            fund_summary=fund_summary,
            issuing_status=account.issuing_status,
            restrictions=restrictions,
            pending_explanation=pending_explanation,
            reserve_explanation=reserve_explanation,
            last_recalculated_at=last_recalculated_at,
        )

    async def get_snapshot(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
    ) -> FundStateSnapshot | None:
        """Get the cached fund state snapshot for fast reads (e.g., authorization)."""
        snapshot_repo = FundStateSnapshotRepository(session)
        return await snapshot_repo.get_by_account(account_id)

    async def list_entries(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
        *,
        state: FundState | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[FundStateEntry], int]:
        """List fund state entries for an account, optionally filtered by state."""
        entry_repo = FundStateEntryRepository(session)
        if state:
            statement = entry_repo.get_by_account_and_state(account_id, state)
        else:
            statement = entry_repo.get_base_statement().where(
                FundStateEntry.account_id == account_id,
            )
        statement = statement.order_by(FundStateEntry.created_at.desc())
        return await entry_repo.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    # ── Write operations ──

    async def recalculate(
        self,
        session: AsyncSession,
        account: Account,
        *,
        reason: str = "manual",
    ) -> FundStateSummary:
        """Trigger a recalculation for a specific account."""
        return await fund_lifecycle_engine.recalculate(
            session, account, reason=reason
        )

    async def recalculate_all(
        self,
        session: AsyncSession,
    ) -> int:
        """Recalculate all treasury-enabled accounts. Returns count processed."""
        account_repo = AccountRepository.from_session(session)
        statement = (
            account_repo.get_base_statement()
            .where(
                Account.account_mode == AccountMode.custom,
                Account.treasury_enabled.is_(True),
            )
        )
        accounts = await account_repo.get_all(statement)
        count = 0
        for acct in accounts:
            await fund_lifecycle_engine.recalculate(
                session, acct, reason="scheduled"
            )
            count += 1
        return count

    async def record_payment_received(
        self,
        session: AsyncSession,
        *,
        account_id: uuid.UUID,
        amount: int,
        currency: str = "usd",
        transaction_id: uuid.UUID | None = None,
    ) -> FundStateEntry:
        """Record an incoming payment as a pending fund state entry."""
        return await fund_lifecycle_engine.create_pending_entry(
            session,
            account_id=account_id,
            amount=amount,
            currency=currency,
            transaction_id=transaction_id,
        )

    async def record_clawback(
        self,
        session: AsyncSession,
        *,
        account_id: uuid.UUID,
        amount: int,
        reason: str,
    ) -> FundStateEntry:
        """Record a refund/dispute clawback."""
        return await fund_lifecycle_engine.clawback(
            session,
            account_id=account_id,
            amount=amount,
            reason=reason,
        )

    # ── Policy management ──

    async def get_policy(
        self,
        session: AsyncReadSession,
        account_id: uuid.UUID,
    ) -> FundPolicyRead:
        """Get the effective policy for an account."""
        policy_repo = FundPolicyRepository(session)
        db_policy = await policy_repo.get_for_account(account_id)
        resolved = resolve_policy(db_policy)

        return FundPolicyRead(
            id=db_policy.id if db_policy else uuid.UUID(int=0),
            created_at=db_policy.created_at if db_policy else None,
            modified_at=db_policy.modified_at if db_policy else None,
            deleted_at=None,
            account_id=db_policy.account_id if db_policy else None,
            enabled=resolved.enabled,
            pending_window_days=resolved.pending_window_days,
            reserve_floor_basis_points=resolved.reserve_floor_basis_points,
        )

    async def update_policy(
        self,
        session: AsyncSession,
        account_id: uuid.UUID,
        policy_update: FundPolicyUpdate,
    ) -> FundPolicy:
        """Create or update the fund policy for an account."""
        policy_repo = FundPolicyRepository(session)

        existing = await policy_repo.get_by_account_id(account_id)

        if existing:
            update_dict = policy_update.model_dump(exclude_unset=True)
            for key, value in update_dict.items():
                setattr(existing, key, value)
            session.add(existing)
            return existing

        # Create new account-specific policy
        policy = FundPolicy(
            account_id=account_id,
            enabled=(
                policy_update.enabled
                if policy_update.enabled is not None
                else False
            ),
            pending_window_days=(
                policy_update.pending_window_days
                if policy_update.pending_window_days is not None
                else 7
            ),
            reserve_floor_basis_points=(
                policy_update.reserve_floor_basis_points
                if policy_update.reserve_floor_basis_points is not None
                else 1000
            ),
        )
        session.add(policy)
        await session.flush()
        return policy


fund_lifecycle_service = FundLifecycleService()
