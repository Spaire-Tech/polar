"""Background tasks for Treasury Financial Accounts."""

import uuid

import structlog

from polar.exceptions import PolarError
from polar.logging import Logger
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

log: Logger = structlog.get_logger()


class TreasuryTaskError(PolarError):
    pass


@actor(
    actor_name="treasury.sync_all_balances",
    cron_trigger=CronTrigger(minute="*/10"),
    priority=TaskPriority.LOW,
)
async def sync_all_balances() -> None:
    """Periodically sync balances for all Financial Accounts from Stripe."""
    from polar.account.repository import AccountRepository

    from .repository import FinancialAccountRepository
    from .service import treasury_service

    async with AsyncSessionMaker() as session:
        fa_repo = FinancialAccountRepository(session)
        account_repo = AccountRepository(session)

        # Get all financial accounts
        statement = fa_repo.get_base_statement()
        financial_accounts = await fa_repo.get_all(statement)

        count = 0
        for fa in financial_accounts:
            if not fa.is_open():
                continue

            account = await account_repo.get_by_id(fa.account_id)
            if account is None or account.stripe_id is None:
                continue

            await treasury_service.sync_balance(session, fa, account)
            count += 1

        log.info("treasury.sync_all_balances.complete", synced=count)


@actor(
    actor_name="treasury.sync_balance",
    priority=TaskPriority.DEFAULT,
)
async def sync_balance(account_id: uuid.UUID) -> None:
    """Sync balance for a specific Financial Account."""
    from polar.account.repository import AccountRepository

    from .repository import FinancialAccountRepository
    from .service import treasury_service

    async with AsyncSessionMaker() as session:
        fa_repo = FinancialAccountRepository(session)
        account_repo = AccountRepository(session)

        fa = await fa_repo.get_by_account_id(account_id)
        if fa is None:
            log.warning(
                "treasury.sync_balance.no_financial_account",
                account_id=str(account_id),
            )
            return

        account = await account_repo.get_by_id(account_id)
        if account is None or account.stripe_id is None:
            log.warning(
                "treasury.sync_balance.account_not_found",
                account_id=str(account_id),
            )
            return

        await treasury_service.sync_balance(session, fa, account)


@actor(
    actor_name="treasury.handle_financial_account_webhook",
    priority=TaskPriority.DEFAULT,
)
async def handle_financial_account_webhook(
    stripe_financial_account_id: str,
    stripe_account_id: str,
) -> None:
    """Handle a treasury.financial_account webhook event."""
    from .service import treasury_service

    async with AsyncSessionMaker() as session:
        await treasury_service.handle_financial_account_updated(
            session,
            stripe_financial_account_id=stripe_financial_account_id,
            stripe_account_id=stripe_account_id,
        )
