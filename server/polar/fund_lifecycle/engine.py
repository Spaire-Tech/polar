"""Fund-state lifecycle engine.

Manages state transitions for merchant funds:
  pending → available → reserve / spendable

The engine runs in two modes:
  - Scheduled recalculation (cron, all treasury-enabled accounts)
  - Targeted recalculation (event-driven, single account)
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog

from polar.enums import FundState, IssuingStatus
from polar.logging import Logger
from polar.models import Account
from polar.models.fund_state import FundStateEntry
from polar.postgres import AsyncSession

from .policy import ResolvedPolicy, resolve_policy
from .repository import (
    FundPolicyRepository,
    FundStateEntryRepository,
    FundStateSnapshotRepository,
)
from .schemas import FundStateSummary

log: Logger = structlog.get_logger()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FundLifecycleEngine:
    """Core engine for fund state recalculation."""

    async def recalculate(
        self,
        session: AsyncSession,
        account: Account,
        *,
        reason: str = "scheduled",
    ) -> FundStateSummary:
        """Recalculate fund states for a single account.

        1. Resolve the effective policy
        2. Check restrictions (frozen accounts skip transitions)
        3. Transition eligible pending → available
        4. Compute reserve floor from available
        5. Compute spendable = available - reserve
        6. Persist snapshot for fast reads
        """
        policy_repo = FundPolicyRepository(session)
        entry_repo = FundStateEntryRepository(session)
        snapshot_repo = FundStateSnapshotRepository(session)

        # 1. Resolve policy
        db_policy = await policy_repo.get_for_account(account.id)
        policy = resolve_policy(db_policy)

        if not policy.enabled:
            # Engine is off for this account — return current snapshot or zeros
            existing = await snapshot_repo.get_by_account(account.id)
            if existing:
                return FundStateSummary(
                    pending_amount=existing.pending_amount,
                    available_amount=existing.available_amount,
                    reserve_amount=existing.reserve_amount,
                    spendable_amount=existing.spendable_amount,
                    total_amount=existing.total_amount,
                )
            return FundStateSummary(
                pending_amount=0,
                available_amount=0,
                reserve_amount=0,
                spendable_amount=0,
                total_amount=0,
            )

        # 2. Check restrictions
        is_restricted = self._is_account_restricted(account)

        # 3. Transition pending → available (if not restricted)
        if not is_restricted:
            await self._transition_pending_to_available(
                entry_repo, account.id, policy, reason
            )

        # 4. Compute totals from entries
        state_sums = await entry_repo.sum_all_states(account.id)
        total_available = state_sums[FundState.available]

        # 5. Compute reserve and spendable
        reserve_amount = (
            total_available * policy.reserve_floor_basis_points
        ) // 10_000
        spendable_amount = total_available - reserve_amount

        now = _utcnow()

        # 6. Persist snapshot
        await snapshot_repo.upsert(
            account.id,
            pending_amount=state_sums[FundState.pending],
            available_amount=total_available,
            reserve_amount=reserve_amount,
            spendable_amount=spendable_amount,
            last_recalculated_at=now,
            policy_config=policy.to_dict(),
        )

        log.info(
            "fund_lifecycle.recalculated",
            account_id=str(account.id),
            reason=reason,
            pending=state_sums[FundState.pending],
            available=total_available,
            reserve=reserve_amount,
            spendable=spendable_amount,
            restricted=is_restricted,
        )

        return FundStateSummary(
            pending_amount=state_sums[FundState.pending],
            available_amount=total_available,
            reserve_amount=reserve_amount,
            spendable_amount=spendable_amount,
            total_amount=(
                state_sums[FundState.pending]
                + total_available
                + reserve_amount
                + spendable_amount
            ),
        )

    async def create_pending_entry(
        self,
        session: AsyncSession,
        *,
        account_id: UUID,
        amount: int,
        currency: str = "usd",
        transaction_id: UUID | None = None,
        pending_window_days: int | None = None,
    ) -> FundStateEntry:
        """Create a new fund state entry in pending state.

        Called when a payment is received and cleared by MoR.
        """
        policy_repo = FundPolicyRepository(session)

        if pending_window_days is None:
            db_policy = await policy_repo.get_for_account(account_id)
            policy = resolve_policy(db_policy)
            pending_window_days = policy.pending_window_days

        now = _utcnow()
        pending_until = now + timedelta(days=pending_window_days)

        entry = FundStateEntry(
            account_id=account_id,
            transaction_id=transaction_id,
            state=FundState.pending,
            amount=amount,
            currency=currency,
            pending_until=pending_until,
            transitioned_at=now,
            previous_state=None,
            transition_reason="payment_received",
        )
        session.add(entry)
        await session.flush()

        log.info(
            "fund_lifecycle.entry_created",
            account_id=str(account_id),
            amount=amount,
            pending_until=pending_until.isoformat(),
        )
        return entry

    async def clawback(
        self,
        session: AsyncSession,
        *,
        account_id: UUID,
        amount: int,
        reason: str,
    ) -> FundStateEntry:
        """Claw back funds (e.g., refund or dispute).

        Creates a negative-amount entry in pending state to offset spendable funds.
        The next recalculation will absorb this into the balances.
        """
        now = _utcnow()
        entry = FundStateEntry(
            account_id=account_id,
            state=FundState.pending,
            amount=-amount,
            currency="usd",
            pending_until=now,  # Immediately affects balance
            transitioned_at=now,
            previous_state=None,
            transition_reason=f"clawback:{reason}",
        )
        session.add(entry)
        await session.flush()

        log.info(
            "fund_lifecycle.clawback",
            account_id=str(account_id),
            amount=amount,
            reason=reason,
        )
        return entry

    @staticmethod
    def _is_account_restricted(account: Account) -> bool:
        """Check if account is in a restricted state that freezes transitions."""
        if account.status in (Account.Status.UNDER_REVIEW, Account.Status.DENIED):
            return True
        if account.issuing_status == IssuingStatus.temporarily_restricted:
            return True
        return False

    async def _transition_pending_to_available(
        self,
        entry_repo: FundStateEntryRepository,
        account_id: UUID,
        policy: ResolvedPolicy,
        reason: str,
    ) -> int:
        """Transition eligible pending entries to available.

        Returns the number of entries transitioned.
        """
        cutoff = _utcnow() - timedelta(days=0)  # pending_until already computed
        # Get entries whose pending window has expired
        entries = await entry_repo.get_pending_before(account_id, _utcnow())

        count = 0
        now = _utcnow()
        for entry in entries:
            entry.previous_state = entry.state.value
            entry.state = FundState.available
            entry.transitioned_at = now
            entry.transition_reason = f"pending_window_cleared:{reason}"
            count += 1

        return count


fund_lifecycle_engine = FundLifecycleEngine()
