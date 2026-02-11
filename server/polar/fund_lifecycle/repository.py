from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, select

from polar.enums import FundState
from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models.fund_state import FundPolicy, FundStateEntry, FundStateSnapshot


class FundStateEntryRepository(
    RepositorySoftDeletionMixin[FundStateEntry],
    RepositoryBase[FundStateEntry],
):
    model = FundStateEntry

    def get_by_account_and_state(
        self, account_id: UUID, state: FundState
    ) -> Select[tuple[FundStateEntry]]:
        return self.get_base_statement().where(
            FundStateEntry.account_id == account_id,
            FundStateEntry.state == state,
        )

    async def get_pending_before(
        self, account_id: UUID, cutoff: datetime
    ) -> list[FundStateEntry]:
        statement = self.get_base_statement().where(
            FundStateEntry.account_id == account_id,
            FundStateEntry.state == FundState.pending,
            FundStateEntry.pending_until <= cutoff,
        )
        return list(await self.get_all(statement))

    async def sum_by_state(self, account_id: UUID, state: FundState) -> int:
        statement = select(
            func.coalesce(func.sum(FundStateEntry.amount), 0)
        ).where(
            FundStateEntry.account_id == account_id,
            FundStateEntry.state == state,
            FundStateEntry.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return int(result.scalar_one())

    async def sum_all_states(
        self, account_id: UUID
    ) -> dict[FundState, int]:
        statement = (
            select(
                FundStateEntry.state,
                func.coalesce(func.sum(FundStateEntry.amount), 0),
            )
            .where(
                FundStateEntry.account_id == account_id,
                FundStateEntry.deleted_at.is_(None),
            )
            .group_by(FundStateEntry.state)
        )
        result = await self.session.execute(statement)
        sums: dict[FundState, int] = {s: 0 for s in FundState}
        for state, total in result.all():
            sums[FundState(state)] = int(total)
        return sums


class FundStateSnapshotRepository(
    RepositoryBase[FundStateSnapshot],
):
    model = FundStateSnapshot

    async def get_by_account(self, account_id: UUID) -> FundStateSnapshot | None:
        statement = self.get_base_statement().where(
            FundStateSnapshot.account_id == account_id,
        )
        return await self.get_one_or_none(statement)

    async def upsert(
        self,
        account_id: UUID,
        *,
        pending_amount: int,
        available_amount: int,
        reserve_amount: int,
        spendable_amount: int,
        last_recalculated_at: datetime,
        policy_config: dict,
    ) -> FundStateSnapshot:
        existing = await self.get_by_account(account_id)
        if existing:
            existing.pending_amount = pending_amount
            existing.available_amount = available_amount
            existing.reserve_amount = reserve_amount
            existing.spendable_amount = spendable_amount
            existing.last_recalculated_at = last_recalculated_at
            existing.policy_config = policy_config
            self.session.add(existing)
            return existing

        snapshot = FundStateSnapshot(
            account_id=account_id,
            pending_amount=pending_amount,
            available_amount=available_amount,
            reserve_amount=reserve_amount,
            spendable_amount=spendable_amount,
            last_recalculated_at=last_recalculated_at,
            policy_config=policy_config,
        )
        self.session.add(snapshot)
        await self.session.flush()
        return snapshot


class FundPolicyRepository(
    RepositoryBase[FundPolicy],
):
    model = FundPolicy

    async def get_for_account(self, account_id: UUID) -> FundPolicy | None:
        """Get account-specific policy, falling back to global default."""
        # Try account-specific first
        statement = self.get_base_statement().where(
            FundPolicy.account_id == account_id,
            FundPolicy.deleted_at.is_(None),
        )
        policy = await self.get_one_or_none(statement)
        if policy:
            return policy

        # Fall back to global default (account_id IS NULL)
        statement = self.get_base_statement().where(
            FundPolicy.account_id.is_(None),
            FundPolicy.deleted_at.is_(None),
        )
        return await self.get_one_or_none(statement)

    async def get_global_default(self) -> FundPolicy | None:
        statement = self.get_base_statement().where(
            FundPolicy.account_id.is_(None),
            FundPolicy.deleted_at.is_(None),
        )
        return await self.get_one_or_none(statement)

    async def get_by_account_id(self, account_id: UUID) -> FundPolicy | None:
        """Get the account-specific policy (not falling back to global)."""
        statement = self.get_base_statement().where(
            FundPolicy.account_id == account_id,
            FundPolicy.deleted_at.is_(None),
        )
        return await self.get_one_or_none(statement)
