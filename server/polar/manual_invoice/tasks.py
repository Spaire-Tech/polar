import structlog

from polar.logging import Logger
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

log: Logger = structlog.get_logger()


@actor(
    actor_name="manual_invoice.process_scheduled",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
)
async def process_scheduled_invoices() -> None:
    """Daily cron job: generate invoices from due recurring schedules."""
    from .schedule_service import manual_invoice_schedule_service

    async with AsyncSessionMaker() as session:
        count = await manual_invoice_schedule_service.process_due_schedules(session)
        if count > 0:
            log.info(
                "manual_invoice.process_scheduled.completed",
                generated_count=count,
            )
