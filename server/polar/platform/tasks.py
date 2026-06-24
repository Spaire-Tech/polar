import uuid

import structlog
from sqlalchemy import select

from polar.exceptions import PolarTaskError
from polar.integrations.resend import domains as resend_domains
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .fee_sync import platform_fee_sync
from .trial_notifications import check_pending_trial_reminders

log: structlog.stdlib.BoundLogger = structlog.get_logger()


class PlatformTaskError(PolarTaskError): ...


@actor(actor_name="platform.fee_sync", priority=TaskPriority.LOW)
async def platform_fee_sync_task(organization_id: uuid.UUID) -> None:
    """Reconcile Account.platform_fee_* with the org's current tier list rate.

    Triggered whenever the org's Spaire subscription changes (creation,
    upgrade, downgrade, cancellation) or when the Stripe Account is first
    attached to the org. Idempotent and a no-op when:
      - the org has no Account yet,
      - the account is manually locked (`platform_fee_locked_at` set), or
      - the values already match the tier list rate.
    """
    async with AsyncSessionMaker() as session:
        result = await platform_fee_sync.sync_by_organization_id(
            session, organization_id
        )
        log.info(
            "platform.fee_sync.run",
            organization_id=str(organization_id),
            changed=result.changed,
            reason=result.reason,
        )


# ---------------------------------------------------------------------------
# Trial reminder emails (T-7, T-2, T-0 days before trial_end)
# ---------------------------------------------------------------------------
#
# Note: there is no trial-expiry cron. The 14-day trial is card-required, so
# at trial_end the generic subscription-cycle scheduler charges the card on
# file (trial -> active) or, on failure, hands off to Polar's dunning
# (past_due -> retry -> revoke -> inactive). Nothing needs to "lapse" a
# card-less trial because card-less trials no longer exist.
# ---------------------------------------------------------------------------


@actor(
    actor_name="platform.notify_trial_reminders",
    cron_trigger=CronTrigger(hour=14, minute=0),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def platform_notify_trial_reminders() -> None:
    """Daily sweep: send the next due trial reminder for every still-
    trialing platform-org subscription. Idempotency markers are
    stamped on subscription.user_metadata so a delayed cron run can't
    double-send.
    """
    async with AsyncSessionMaker() as session:
        counters = await check_pending_trial_reminders(session)
        log.info("platform.notify_trial_reminders.done", **counters)


# ---------------------------------------------------------------------------
# Custom email sender domain: hourly reconciliation with Resend
# ---------------------------------------------------------------------------


@actor(
    actor_name="platform.email_sender_domain.reconcile",
    cron_trigger=CronTrigger(minute=15),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def email_sender_domain_reconcile() -> None:
    """Fan out per-org checks for every organization that has a Resend
    domain registered but hasn't verified yet. Creators may install
    their DNS records without coming back to click the explicit verify
    button; this catches them automatically.
    """
    async with AsyncSessionMaker() as session:
        statement = select(Organization.id).where(
            Organization.deleted_at.is_(None),
            Organization.email_sender_resend_id.is_not(None),
            Organization.email_sender_verified_at.is_(None),
        )
        result = await session.stream_scalars(statement)
        count = 0
        async for organization_id in result:
            enqueue_job(
                "platform.email_sender_domain.reconcile_for_organization",
                organization_id=organization_id,
            )
            count += 1
        log.info(
            "platform.email_sender_domain.reconcile.scheduled", count=count
        )


@actor(
    actor_name="platform.email_sender_domain.reconcile_for_organization",
    priority=TaskPriority.LOW,
)
async def email_sender_domain_reconcile_for_organization(
    organization_id: uuid.UUID,
) -> None:
    async with AsyncSessionMaker() as session:
        organization = await session.get(Organization, organization_id)
        if organization is None:
            return
        resend_id = organization.email_sender_resend_id
        if resend_id is None or organization.email_sender_verified_at is not None:
            # Raced with a manual verify, or the creator cleared their
            # domain between fan-out and execution. No work to do.
            return

        try:
            response = await resend_domains.get_domain(resend_id)
        except resend_domains.ResendDomainsError as exc:
            log.warning(
                "platform.email_sender_domain.reconcile.fetch_failed",
                organization_id=str(organization_id),
                resend_id=resend_id,
                error=str(exc),
            )
            return

        records = response.get("records")
        if isinstance(records, list):
            organization.email_sender_dns_records = records

        status = response.get("status")
        if status == "verified":
            organization.email_sender_verified_at = utc_now()
            log.info(
                "platform.email_sender_domain.reconcile.verified",
                organization_id=str(organization_id),
                resend_id=resend_id,
            )
        else:
            log.info(
                "platform.email_sender_domain.reconcile.still_pending",
                organization_id=str(organization_id),
                resend_id=resend_id,
                status=status,
            )
