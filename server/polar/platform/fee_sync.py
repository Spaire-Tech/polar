"""Sync Account.platform_fee_* fields with the creator org's current
Spaire tier.

Background: every transaction's platform fee is read from
`Account._platform_fee_percent` / `_platform_fee_fixed`. The tier-list
fee for a creator org is determined by which Spaire subscription they
hold. This service keeps the two in sync.

Override: `Account.platform_fee_locked_at` is the manual-negotiation
escape hatch. When set, the sync is a no-op (use `force=True` to bypass).
This protects Scale customers on bespoke rates from being overwritten by
the tier-list defaults.
"""

import logging
from uuid import UUID

import structlog

from polar.account.repository import AccountRepository
from polar.customer.repository import CustomerRepository
from polar.entitlements.service import entitlements as entitlements_service
from polar.entitlements.tiers import TierKey
from polar.exceptions import PolarError
from polar.models import Organization, Subscription
from polar.organization.repository import OrganizationRepository
from polar.platform.service import platform as platform_service
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

log: structlog.stdlib.BoundLogger = structlog.get_logger()
logging.getLogger(__name__)


class PlatformFeeSyncError(PolarError): ...


class _SyncResult:
    __slots__ = ("changed", "reason")

    def __init__(self, *, changed: bool, reason: str) -> None:
        self.changed = changed
        self.reason = reason

    def __repr__(self) -> str:
        return f"_SyncResult(changed={self.changed}, reason={self.reason!r})"


class PlatformFeeSyncService:
    async def sync_for_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        force: bool = False,
    ) -> _SyncResult:
        """Read tier entitlements for `organization`, write them onto its
        Account (if any). Returns a _SyncResult describing what happened.

        Never raises on missing prerequisites — it's safe to call on every
        subscription state change, including ones where the org doesn't
        have a Stripe Account yet (sync will run when the account is set).
        """
        if organization.account_id is None:
            return _SyncResult(changed=False, reason="no_account")

        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_id(organization.account_id)
        if account is None:
            return _SyncResult(changed=False, reason="account_missing")

        if account.platform_fee_locked_at is not None and not force:
            return _SyncResult(changed=False, reason="locked")

        tier_entitlements = await entitlements_service.get_for_organization(
            session, organization.id
        )

        # Legacy tier: leave the Account columns as-is — the global default
        # already kicks in via Account.platform_fee fallback. Writing the
        # global default values explicitly would be lossy (we'd no longer
        # be able to tell "never synced" from "synced to global default").
        if tier_entitlements.tier == TierKey.legacy:
            return _SyncResult(changed=False, reason="legacy_tier")

        target_percent = tier_entitlements.transaction_fee.percent_basis_points
        target_fixed = tier_entitlements.transaction_fee.fixed_cents

        if (
            account._platform_fee_percent == target_percent
            and account._platform_fee_fixed == target_fixed
        ):
            return _SyncResult(changed=False, reason="up_to_date")

        previous_percent = account._platform_fee_percent
        previous_fixed = account._platform_fee_fixed
        account._platform_fee_percent = target_percent
        account._platform_fee_fixed = target_fixed

        log.info(
            "platform.fee_sync.updated",
            organization_id=str(organization.id),
            account_id=str(account.id),
            tier=tier_entitlements.tier.value,
            previous_percent=previous_percent,
            previous_fixed=previous_fixed,
            new_percent=target_percent,
            new_fixed=target_fixed,
        )
        return _SyncResult(changed=True, reason="updated")

    async def sync_by_organization_id(
        self,
        session: AsyncSession,
        organization_id: UUID,
        *,
        force: bool = False,
    ) -> _SyncResult:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(
            organization_id, include_blocked=True
        )
        if organization is None:
            return _SyncResult(changed=False, reason="org_missing")
        return await self.sync_for_organization(session, organization, force=force)


platform_fee_sync = PlatformFeeSyncService()


def enqueue_sync(organization_id: UUID) -> None:
    """Schedule a tier-fee sync for the organization.

    Safe to call from synchronous hot paths. The actor (registered in
    `polar/platform/tasks.py`) reloads state in a fresh session and applies
    the sync idempotently.
    """
    enqueue_job("platform.fee_sync", organization_id=organization_id)


async def maybe_enqueue_sync_from_subscription(
    session: AsyncSession, subscription: Subscription
) -> None:
    """If `subscription` is a platform-org subscription (Spaire selling to
    a creator), enqueue a fee sync for that creator org. Otherwise a no-op.

    Called from subscription/service.py after subscription state changes
    so creator orgs that upgrade or downgrade through the normal checkout
    path get their fees updated automatically.
    """
    if not platform_service.is_configured():
        return

    customer_repository = CustomerRepository.from_session(session)
    customer = await customer_repository.get_by_id(subscription.customer_id)
    if customer is None:
        return

    if not platform_service.is_platform_organization(customer.organization_id):
        return

    creator_org_id_raw = (customer.user_metadata or {}).get("creator_org_id")
    if not isinstance(creator_org_id_raw, str):
        return

    try:
        creator_org_id = UUID(creator_org_id_raw)
    except ValueError:
        return

    enqueue_sync(creator_org_id)
