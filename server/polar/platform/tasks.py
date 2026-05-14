import uuid

import structlog
from sqlalchemy import select

from polar.entitlements.tiers import TierKey
from polar.exceptions import PolarTaskError
from polar.integrations.resend import domains as resend_domains
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.organization.repository import OrganizationRepository
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .billing import TierProductMissing, platform_billing
from .fee_sync import platform_fee_sync

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


@actor(
    actor_name="platform.resubscribe_to_free",
    priority=TaskPriority.LOW,
)
async def platform_resubscribe_to_free(organization_id: uuid.UUID) -> None:
    """Auto-resubscribe a creator org to the Free plan after their paid
    Spaire subscription is revoked (cancellation reaches end of period
    or immediate revoke).

    Idempotent: ensure_subscription returns the existing active sub if
    one exists, so multiple revoke events in rapid succession do not
    create duplicates.
    """
    async with AsyncSessionMaker() as session:
        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_id(organization_id, include_blocked=True)
        if organization is None:
            log.warning(
                "platform.resubscribe_to_free.org_missing",
                organization_id=str(organization_id),
            )
            return

        try:
            subscription = await platform_billing.ensure_subscription(
                session,
                organization,
                tier=TierKey.free,
                managed_by="auto_downgrade_on_revoke",
            )
        except TierProductMissing as e:
            log.warning(
                "platform.resubscribe_to_free.skipped",
                organization_id=str(organization_id),
                reason=e.message,
            )
            return

        log.info(
            "platform.resubscribe_to_free.done",
            organization_id=str(organization_id),
            subscription_id=str(subscription.id) if subscription else None,
        )


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
