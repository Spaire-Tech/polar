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
from polar.enums import RateLimitGroup
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
        tier_entitlements = await entitlements_service.get_for_organization(
            session, organization.id
        )

        # Rate-limit group is independent of Account state — it lives on
        # the Organization row itself and is read by the API middleware
        # on every request. Sync it first so a creator without an Account
        # yet still gets bumped from `default` to `elevated` when they
        # land on Pro/Studio/Scale. Legacy maps back to `default`.
        try:
            target_rate_limit_group = RateLimitGroup(
                tier_entitlements.rate_limit_group
            )
        except ValueError:
            log.warning(
                "platform.fee_sync.invalid_rate_limit_group",
                organization_id=str(organization.id),
                tier=tier_entitlements.tier.value,
                value=tier_entitlements.rate_limit_group,
            )
            target_rate_limit_group = organization.rate_limit_group
        rate_limit_changed = (
            organization.rate_limit_group != target_rate_limit_group
        )
        if rate_limit_changed:
            organization.rate_limit_group = target_rate_limit_group
            log.info(
                "platform.fee_sync.rate_limit_group_updated",
                organization_id=str(organization.id),
                tier=tier_entitlements.tier.value,
                rate_limit_group=target_rate_limit_group.value,
            )

        if organization.account_id is None:
            return _SyncResult(
                changed=rate_limit_changed,
                reason="rate_limit_only" if rate_limit_changed else "no_account",
            )

        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_id(organization.account_id)
        if account is None:
            return _SyncResult(
                changed=rate_limit_changed,
                reason="rate_limit_only" if rate_limit_changed else "account_missing",
            )

        if account.platform_fee_locked_at is not None and not force:
            return _SyncResult(
                changed=rate_limit_changed,
                reason="rate_limit_only" if rate_limit_changed else "locked",
            )

        # Legacy tier: leave the Account fee columns as-is — the global
        # default kicks in via Account.platform_fee fallback. Writing the
        # global default values explicitly would be lossy (we'd no longer
        # be able to tell "never synced" from "synced to global default").
        # Rate-limit group was already synced above.
        if tier_entitlements.tier == TierKey.legacy:
            return _SyncResult(
                changed=rate_limit_changed,
                reason="rate_limit_only" if rate_limit_changed else "legacy_tier",
            )

        target_percent = tier_entitlements.transaction_fee.percent_basis_points
        target_fixed = tier_entitlements.transaction_fee.fixed_cents

        if (
            account._platform_fee_percent == target_percent
            and account._platform_fee_fixed == target_fixed
        ):
            return _SyncResult(
                changed=rate_limit_changed,
                reason="rate_limit_only" if rate_limit_changed else "up_to_date",
            )

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

    No-op when running outside the API/worker process (one-off scripts,
    tests) where Dramatiq's JobQueueManager hasn't been initialized. In
    those contexts the caller is expected to either set up
    `JobQueueManager.open(...)` itself or accept that the sync will run
    on the next API request that touches this org via PR 5's hook.
    """
    try:
        enqueue_job("platform.fee_sync", organization_id=organization_id)
    except LookupError:
        log.debug(
            "platform.fee_sync.enqueue_skipped_no_queue_manager",
            organization_id=str(organization_id),
        )


async def maybe_enqueue_sync_from_subscription(
    session: AsyncSession, subscription: Subscription
) -> None:
    """If `subscription` is a platform-org subscription (Spaire selling to
    a creator), enqueue a fee sync for that creator org. Otherwise a no-op.

    Called from subscription/service.py after subscription state changes
    so creator orgs that upgrade or downgrade through the normal checkout
    path get their fees updated automatically.
    """
    creator_org_id = await _platform_creator_org_id(session, subscription)
    if creator_org_id is not None:
        enqueue_sync(creator_org_id)


async def maybe_enqueue_resubscribe_from_revoke(
    session: AsyncSession, subscription: Subscription
) -> None:
    """If `subscription` belongs to a creator on the platform org and has
    just been revoked, enqueue a job that re-creates an active Legacy
    subscription so the org keeps a valid Spaire entitlement record.

    Otherwise a no-op. Called from subscription/service.py inside
    _on_subscription_revoked.
    """
    creator_org_id = await _platform_creator_org_id(session, subscription)
    if creator_org_id is None:
        return
    try:
        enqueue_job(
            "platform.resubscribe_to_legacy", organization_id=creator_org_id
        )
    except LookupError:
        # Scripts / tests without a JobQueueManager — same logic as
        # enqueue_sync above. The caller can re-run platform_billing
        # .ensure_subscription(tier=legacy) manually if needed.
        log.debug(
            "platform.resubscribe_to_legacy.enqueue_skipped_no_queue_manager",
            organization_id=str(creator_org_id),
        )


async def _platform_creator_org_id(
    session: AsyncSession, subscription: Subscription
) -> UUID | None:
    """Resolve the creator-org id linked to a platform-org subscription's
    customer record. Returns None when the subscription isn't on the
    platform org, the customer is missing, or the metadata lookup fails.
    """
    if not platform_service.is_configured():
        return None

    customer_repository = CustomerRepository.from_session(session)
    customer = await customer_repository.get_by_id(subscription.customer_id)
    if customer is None:
        return None

    if not platform_service.is_platform_organization(customer.organization_id):
        return None

    creator_org_id_raw = (customer.user_metadata or {}).get("creator_org_id")
    if not isinstance(creator_org_id_raw, str):
        return None

    try:
        return UUID(creator_org_id_raw)
    except ValueError:
        return None
