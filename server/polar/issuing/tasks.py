import uuid

import structlog

from polar.logging import Logger
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

from .service import issuing

log: Logger = structlog.get_logger()


@actor(
    actor_name="issuing.risk_clearance_accounts",
    priority=TaskPriority.MEDIUM,
    cron_trigger=CronTrigger.from_crontab("0 * * * *"),
)
async def risk_clearance_accounts() -> None:
    async with AsyncSessionMaker() as session:
        updated_accounts = await issuing.run_risk_clearance(session)
        log.info("issuing.risk_clearance.completed", updated_accounts=updated_accounts)


@actor(actor_name="issuing.risk_clearance_account", priority=TaskPriority.MEDIUM)
async def risk_clearance_account(account_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        updated = await issuing.run_risk_clearance_for_account_id(session, account_id)
        log.info(
            "issuing.risk_clearance.account_completed",
            account_id=account_id,
            updated=updated,
        )
