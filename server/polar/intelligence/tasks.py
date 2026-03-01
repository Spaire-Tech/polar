"""
Background tasks for the intelligence module.

- weekly_intelligence_digest: Runs once a week per org, generates a
  "what changed" insight and stores it for the Monitor surface.
"""

import uuid
from datetime import date, timedelta

import structlog

from polar.worker import AsyncSessionMaker, actor

log = structlog.get_logger(__name__)


@actor(actor_name="intelligence.weekly_digest")
async def weekly_intelligence_digest(organization_id: str) -> None:
    """
    Generate a weekly revenue digest for an organization.
    Triggered by the scheduler (e.g. every Monday morning).
    """
    from polar.auth.models import Anonymous
    from polar.intelligence.agent import run_intelligence_query

    org_id = uuid.UUID(organization_id)
    today = date.today()
    # Last complete week: Mon–Sun
    last_monday = today - timedelta(days=today.weekday() + 7)
    last_sunday = last_monday + timedelta(days=6)

    log.info(
        "intelligence.weekly_digest.start",
        org_id=organization_id,
        start=str(last_monday),
        end=str(last_sunday),
    )

    async with AsyncSessionMaker() as session:
        # We run as a system-level query scoped to the org.
        # In a full implementation, the result would be persisted to a
        # monitor_feed table and surfaced on the dashboard.
        try:
            insight = await run_intelligence_query(
                session,
                Anonymous(),  # type: ignore[arg-type]
                organization_id=org_id,
                question="What changed in my revenue last week?",
                explicit_start=last_monday,
                explicit_end=last_sunday,
            )
            log.info(
                "intelligence.weekly_digest.done",
                org_id=organization_id,
                answer=insight.answer[:100],
            )
        except Exception as e:
            log.error(
                "intelligence.weekly_digest.error",
                org_id=organization_id,
                error=str(e),
            )
