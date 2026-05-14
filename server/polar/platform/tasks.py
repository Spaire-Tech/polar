import uuid

import structlog

from polar.entitlements.tiers import TierKey
from polar.exceptions import PolarTaskError
from polar.organization.repository import OrganizationRepository
from polar.worker import AsyncSessionMaker, TaskPriority, actor

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
