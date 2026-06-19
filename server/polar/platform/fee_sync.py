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
from polar.entitlements.tiers import PAID_TIERS, tier_from_value
from polar.enums import RateLimitGroup
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import Organization, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.organization.repository import OrganizationRepository
from polar.platform.repository import platform_subscription_repository
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

        # Non-paid tier (unmanaged / inactive): reset the Account fee columns
        # to NULL so the global default applies via the Account.platform_fee
        # fallback. This is the churn path — a creator who previously held
        # Studio/Scale (and therefore had a lower rate written onto their
        # Account) must NOT keep that negotiated rate once they have no plan.
        # Nulling rather than writing the default explicitly preserves the
        # "never synced == on global default" semantics. The lock check above
        # already returned for locked accounts, so reaching here means
        # unlocked (or force=True).
        if tier_entitlements.tier not in PAID_TIERS:
            if (
                account._platform_fee_percent is not None
                or account._platform_fee_fixed is not None
            ):
                previous_percent = account._platform_fee_percent
                previous_fixed = account._platform_fee_fixed
                account._platform_fee_percent = None
                account._platform_fee_fixed = None
                log.info(
                    "platform.fee_sync.reset_to_default",
                    organization_id=str(organization.id),
                    account_id=str(account.id),
                    tier=tier_entitlements.tier.value,
                    previous_percent=previous_percent,
                    previous_fixed=previous_fixed,
                )
                return _SyncResult(changed=True, reason="reset_to_default")
            return _SyncResult(
                changed=rate_limit_changed,
                reason="rate_limit_only" if rate_limit_changed else "non_paid_tier",
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


async def maybe_supersede_platform_trial(
    session: AsyncSession, subscription: Subscription
) -> None:
    """When a creator's NEW *paid* Spaire subscription is created (via the
    upgrade checkout), cancel their other active platform subscriptions —
    the auto-attached Starter trial they're converting from, or a Legacy
    fallback — so they end up holding exactly the one paid subscription.

    This is the counterpart to NOT pre-revoking the trial before checkout:
    the trial stays live (and the creator keeps their entitlements + the
    remaining trial days) until payment actually succeeds and this runs.
    If the creator abandons checkout, no new sub is created, this never
    fires, and the trial is untouched.

    No-op unless `subscription` is a creator's platform sub on a paid tier.
    The auto-trial itself (managed_by=trial) and Legacy resubscribes are
    skipped so they never cancel anything.
    """
    if not platform_service.is_configured():
        return

    managed_by = (subscription.user_metadata or {}).get("managed_by")
    if managed_by == "trial":
        # We're creating the auto-trial itself — nothing to supersede.
        return

    customer_repository = CustomerRepository.from_session(session)
    customer = await customer_repository.get_by_id(subscription.customer_id)
    if customer is None:
        return
    if not platform_service.is_platform_organization(customer.organization_id):
        return

    # Only a paid-tier subscription supersedes.
    product = subscription.product
    tier_value = (product.user_metadata or {}).get("tier") if product else None
    tier = tier_from_value(tier_value) if isinstance(tier_value, str) else None
    if tier not in PAID_TIERS:
        return

    subscription_repo = platform_subscription_repository(session)
    others = await subscription_repo.list_active_for_customer(customer.id)
    now = utc_now()
    superseded: list[str] = []
    for other in others:
        if other.id == subscription.id:
            continue
        other.status = SubscriptionStatus.canceled
        other.canceled_at = now
        other.ended_at = now
        other.cancel_at_period_end = False
        superseded.append(str(other.id))

    if superseded:
        await session.flush()
        log.info(
            "platform.supersede_trial.done",
            organization_id=customer.user_metadata.get("creator_org_id"),
            customer_id=str(customer.id),
            new_subscription_id=str(subscription.id),
            new_tier=tier.value,
            superseded_subscription_ids=superseded,
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
