"""Background tasks for the fund lifecycle engine."""

import uuid

import structlog

from polar.exceptions import PolarError
from polar.logging import Logger
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

log: Logger = structlog.get_logger()


class FundLifecycleTaskError(PolarError):
    pass


class AccountDoesNotExist(FundLifecycleTaskError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"Account {account_id} does not exist."
        super().__init__(message)


@actor(
    actor_name="fund_lifecycle.scheduled_recalculation",
    cron_trigger=CronTrigger(minute="*/15"),
    priority=TaskPriority.LOW,
)
async def scheduled_recalculation() -> None:
    """Periodic recalculation of fund states for all treasury-enabled accounts."""
    from .service import fund_lifecycle_service

    async with AsyncSessionMaker() as session:
        count = await fund_lifecycle_service.recalculate_all(session)
        log.info("fund_lifecycle.scheduled_recalculation.complete", accounts=count)


@actor(
    actor_name="fund_lifecycle.targeted_recalculation",
    priority=TaskPriority.DEFAULT,
)
async def targeted_recalculation(account_id: uuid.UUID, reason: str) -> None:
    """Event-driven recalculation for a specific account."""
    from polar.account.repository import AccountRepository

    from .service import fund_lifecycle_service

    async with AsyncSessionMaker() as session:
        account_repo = AccountRepository.from_session(session)
        account = await account_repo.get_by_id(account_id)
        if account is None:
            raise AccountDoesNotExist(account_id)

        await fund_lifecycle_service.recalculate(
            session, account, reason=reason
        )


@actor(
    actor_name="fund_lifecycle.payment_received",
    priority=TaskPriority.DEFAULT,
)
async def payment_received(
    account_id: uuid.UUID,
    amount: int,
    currency: str = "usd",
    transaction_id: uuid.UUID | None = None,
) -> None:
    """Record an incoming payment and trigger targeted recalculation."""
    from polar.account.repository import AccountRepository

    from .service import fund_lifecycle_service

    async with AsyncSessionMaker() as session:
        account_repo = AccountRepository.from_session(session)
        account = await account_repo.get_by_id(account_id)
        if account is None:
            raise AccountDoesNotExist(account_id)

        await fund_lifecycle_service.record_payment_received(
            session,
            account_id=account_id,
            amount=amount,
            currency=currency,
            transaction_id=transaction_id,
        )

        await fund_lifecycle_service.recalculate(
            session, account, reason="payment_received"
        )


@actor(
    actor_name="fund_lifecycle.clawback",
    priority=TaskPriority.HIGH,
)
async def clawback(
    account_id: uuid.UUID,
    amount: int,
    reason: str,
) -> None:
    """Record a clawback (refund/dispute) and trigger targeted recalculation."""
    from polar.account.repository import AccountRepository

    from .service import fund_lifecycle_service

    async with AsyncSessionMaker() as session:
        account_repo = AccountRepository.from_session(session)
        account = await account_repo.get_by_id(account_id)
        if account is None:
            raise AccountDoesNotExist(account_id)

        await fund_lifecycle_service.record_clawback(
            session,
            account_id=account_id,
            amount=amount,
            reason=reason,
        )

        await fund_lifecycle_service.recalculate(
            session, account, reason=f"clawback:{reason}"
        )
