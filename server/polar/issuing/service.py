from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from polar.account.repository import AccountRepository
from polar.config import settings
from polar.enums import AccountType
from polar.models import Account
from polar.postgres import AsyncSession
from polar.transaction.service.transaction import transaction as transaction_service


class IssuingService:
    async def run_risk_clearance(self, session: AsyncSession) -> int:
        if not settings.ISSUING_INSTANT_SPEND_ENABLED:
            return 0

        statement = select(Account).where(
            Account.account_type == AccountType.stripe,
            Account.stripe_id.is_not(None),
            Account.deleted_at.is_(None),
        )
        accounts = (await session.execute(statement)).scalars().all()

        updated_accounts = 0
        for account in accounts:
            if await self.run_risk_clearance_for_account(session, account):
                updated_accounts += 1

        return updated_accounts

    async def run_risk_clearance_for_account(
        self, session: AsyncSession, account: Account
    ) -> bool:
        if not settings.ISSUING_INSTANT_SPEND_ENABLED:
            return False

        if account.account_type != AccountType.stripe or account.stripe_id is None:
            return False

        return await self._apply_risk_clearance(session, account)

    async def run_risk_clearance_for_account_id(
        self, session: AsyncSession, account_id: uuid.UUID
    ) -> bool:
        repository = AccountRepository.from_session(session)
        account = await repository.get_by_id(account_id)
        if account is None:
            return False

        return await self.run_risk_clearance_for_account(session, account)

    async def _apply_risk_clearance(
        self, session: AsyncSession, account: Account
    ) -> bool:
        balance_amount = await transaction_service.get_transactions_sum(
            session, account.id
        )

        reserve_floor_amount = max(
            0,
            (balance_amount * settings.ISSUING_RESERVE_FLOOR_BASIS_POINTS) // 10_000,
        )
        available_amount = max(0, balance_amount - reserve_floor_amount)

        data = dict(account.data)
        previous_data = dict(account.data)

        money_state_raw = data.get("money_state")
        money_state = money_state_raw if isinstance(money_state_raw, str) else "pending"

        pending_since = self._parse_pending_since(data.get("issuing_pending_since"))
        if pending_since is None:
            pending_since = datetime.now(UTC)

        if money_state == "pending" and self._pending_window_elapsed(pending_since):
            if available_amount > 0:
                money_state = "available"
            elif reserve_floor_amount > 0:
                money_state = "reserve"

        issuing_onboarding_state_raw = data.get("issuing_onboarding_state")
        issuing_onboarding_state = (
            issuing_onboarding_state_raw
            if isinstance(issuing_onboarding_state_raw, str)
            else "onboarding_required"
        )

        is_temporarily_restricted = (
            account.status
            in {
                Account.Status.UNDER_REVIEW,
                Account.Status.DENIED,
            }
            or issuing_onboarding_state == "temporarily_restricted"
        )

        if is_temporarily_restricted:
            data["issuing_balance_spendable_amount"] = 0
            data["issuing_balance_available_amount"] = 0
            data["issuing_balance_pending_amount"] = 0
            data["issuing_balance_reserve_amount"] = max(
                balance_amount, reserve_floor_amount
            )
            data["issuing_block_reason"] = "account_restricted"
            data["issuing_onboarding_state"] = "temporarily_restricted"
            money_state = "reserve"
        else:
            data["issuing_block_reason"] = None
            if (
                money_state == "available"
                and issuing_onboarding_state == "issuing_active"
                and available_amount > 0
            ):
                data["issuing_balance_spendable_amount"] = available_amount
                data["issuing_balance_available_amount"] = 0
                money_state = "spendable"
            else:
                data["issuing_balance_spendable_amount"] = 0
                data["issuing_balance_available_amount"] = available_amount

            data["issuing_balance_pending_amount"] = (
                balance_amount if money_state == "pending" else 0
            )
            data["issuing_balance_reserve_amount"] = reserve_floor_amount

        data["issuing_pending_since"] = pending_since.isoformat()
        data["money_state"] = money_state

        if data == previous_data:
            return False

        account.data = data
        session.add(account)
        return True

    def _pending_window_elapsed(self, pending_since: datetime) -> bool:
        threshold = pending_since + timedelta(days=settings.ISSUING_PENDING_WINDOW_DAYS)
        return datetime.now(UTC) >= threshold

    def _parse_pending_since(self, value: object) -> datetime | None:
        if not isinstance(value, str):
            return None

        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None

        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed


issuing = IssuingService()
