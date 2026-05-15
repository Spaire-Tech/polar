"""Server-side helpers for managing an existing Spaire subscription:
switching between paid tiers (Pro <-> Studio <-> Scale) and canceling
a paid subscription. Cancellation triggers auto-resubscribe-to-Legacy
via polar.platform.fee_sync.maybe_enqueue_resubscribe_from_revoke when
the subscription actually revokes; trialing subs are revoked
immediately (no end-of-period schedule, since there's no payment cycle
to wait for).
"""

from typing import Literal

import structlog

from polar.entitlements.tiers import TierKey
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models import Organization, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.platform.repository import (
    platform_customer_repository,
    platform_product_repository,
    platform_subscription_repository,
)
from polar.platform.service import platform as platform_service
from polar.postgres import AsyncSession
from polar.subscription.service import subscription as subscription_service
from polar.worker import enqueue_job

log: structlog.stdlib.BoundLogger = structlog.get_logger()


_PAID_TIERS = (TierKey.pro, TierKey.studio, TierKey.scale)


class PlatformManagementError(PolarError): ...


class NoActiveSubscription(PlatformManagementError):
    def __init__(self) -> None:
        super().__init__(
            "Your organization has no active Spaire subscription to modify.",
            404,
        )


class CannotSwitchToSameTier(PlatformManagementError):
    def __init__(self) -> None:
        super().__init__(
            "Cannot switch to the tier you are already on.",
            400,
        )


class CannotSwitchToNonPaidTier(PlatformManagementError):
    def __init__(self) -> None:
        super().__init__(
            "Use the cancel endpoint to end your paid Spaire subscription.",
            400,
        )


class SwitchRequiresPaidTier(PlatformManagementError):
    def __init__(self) -> None:
        super().__init__(
            "Plan switching is only available between paid tiers. Use the "
            "upgrade-checkout endpoint to start a paid subscription.",
            409,
        )


class CannotSwitchDuringTrial(PlatformManagementError):
    def __init__(self) -> None:
        super().__init__(
            "Plan switching is disabled while your trial is active. Convert "
            "your trial through the upgrade-checkout endpoint and pick the "
            "tier you want there.",
            409,
        )


class _ResolvedSubscription:
    __slots__ = ("subscription", "current_tier", "current_interval")

    def __init__(
        self,
        subscription: Subscription,
        current_tier: TierKey,
        current_interval: Literal["month", "year"],
    ) -> None:
        self.subscription = subscription
        self.current_tier = current_tier
        self.current_interval = current_interval


async def _resolve_active(
    session: AsyncSession, organization: Organization
) -> _ResolvedSubscription:
    if not platform_service.is_configured():
        raise NoActiveSubscription()

    platform_org_id = platform_service.get_id()
    customer_repo = platform_customer_repository(session)
    customer = await customer_repo.get_for_creator_org(
        platform_org_id, organization.id
    )
    if customer is None:
        raise NoActiveSubscription()

    subscription_repo = platform_subscription_repository(session)
    subscription = await subscription_repo.get_active_for_customer(customer.id)
    if subscription is None or subscription.product is None:
        raise NoActiveSubscription()

    tier_value = (subscription.product.user_metadata or {}).get("tier")
    if not isinstance(tier_value, str):
        raise NoActiveSubscription()
    try:
        current_tier = TierKey(tier_value)
    except ValueError as exc:
        raise NoActiveSubscription() from exc

    # Derive the current billing interval from the subscription itself
    # (single source of truth — the Product's user_metadata may not be
    # stamped on legacy seed rows).
    current_interval: Literal["month", "year"]
    if subscription.recurring_interval == SubscriptionRecurringInterval.year:
        current_interval = "year"
    else:
        current_interval = "month"

    return _ResolvedSubscription(subscription, current_tier, current_interval)


class PlatformManagementService:
    async def switch_plan(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        target_tier: TierKey,
        target_interval: Literal["month", "year"] | None = None,
    ) -> Subscription:
        """Switch a creator org between paid tiers and/or billing intervals.

        Examples (all valid):
          - Pro monthly  -> Studio monthly  (tier switch)
          - Studio monthly -> Studio yearly (interval switch, same tier)
          - Pro monthly  -> Scale yearly    (both at once)

        Uses subscription.update_product directly (no checkout needed —
        the customer's card is already on file). Proration is invoice-
        immediately so the customer sees the change on their next bill.

        `target_interval=None` keeps the current cadence.
        """
        if target_tier == TierKey.legacy:
            raise CannotSwitchToNonPaidTier()
        if target_tier not in _PAID_TIERS:
            raise CannotSwitchToNonPaidTier()

        resolved = await _resolve_active(session, organization)

        if resolved.current_tier not in _PAID_TIERS:
            # Legacy -> paid goes through checkout, not update_product,
            # since no card is on file yet. Surface a 409 with a hint.
            raise SwitchRequiresPaidTier()

        if resolved.subscription.trialing:
            # subscription_service.update_product raises TrialingSubscription
            # on trialing subs; surface a domain-specific 409 here so the
            # frontend can route the user to the trial-conversion flow
            # instead of bouncing on a generic error.
            raise CannotSwitchDuringTrial()

        effective_interval = target_interval or resolved.current_interval
        if (
            resolved.current_tier == target_tier
            and effective_interval == resolved.current_interval
        ):
            raise CannotSwitchToSameTier()

        platform_org_id = platform_service.get_id()
        product_repo = platform_product_repository(session)
        target_product = await product_repo.get_by_tier_and_interval(
            platform_org_id, target_tier.value, effective_interval
        )
        if target_product is None:
            # Bail with a 404-ish message; pre-deploy seed should have
            # created every (tier, interval) pair.
            raise NoActiveSubscription()

        updated = await subscription_service.update_product(
            session,
            resolved.subscription,
            product_id=target_product.id,
            proration_behavior=SubscriptionProrationBehavior.invoice,
        )

        log.info(
            "platform.switch_plan.done",
            organization_id=str(organization.id),
            from_tier=resolved.current_tier.value,
            from_interval=resolved.current_interval,
            to_tier=target_tier.value,
            to_interval=effective_interval,
            subscription_id=str(updated.id),
        )
        return updated

    async def cancel_at_period_end(
        self,
        session: AsyncSession,
        locker: Locker,
        *,
        organization: Organization,
    ) -> Subscription:
        """Cancel the creator org's Spaire subscription.

        - Active paid subs schedule end-of-period cancellation; the
          subscription stays valid through the current billing window
          and the `platform.resubscribe_to_legacy` actor takes over
          when the revoke event fires.
        - Trialing subs (no payment method, no billing cycle to honor)
          are revoked immediately. The customer loses Pro/Studio/Scale
          entitlements right away and is enqueued for resubscribe to
          Legacy on the next worker pass.
        - Legacy is a no-op (no payment liability to release).
        """
        resolved = await _resolve_active(session, organization)

        if resolved.current_tier not in _PAID_TIERS:
            return resolved.subscription

        if resolved.subscription.trialing:
            now = utc_now()
            resolved.subscription.status = SubscriptionStatus.canceled
            resolved.subscription.canceled_at = now
            resolved.subscription.ended_at = now
            resolved.subscription.cancel_at_period_end = False
            await session.flush()

            enqueue_job(
                "platform.resubscribe_to_legacy",
                organization_id=organization.id,
            )

            log.info(
                "platform.cancel.trial_revoked",
                organization_id=str(organization.id),
                subscription_id=str(resolved.subscription.id),
            )
            return resolved.subscription

        async with subscription_service.lock(locker, resolved.subscription):
            canceled = await subscription_service.cancel(
                session, resolved.subscription
            )

        log.info(
            "platform.cancel.scheduled",
            organization_id=str(organization.id),
            subscription_id=str(canceled.id),
            ends_at=canceled.ends_at.isoformat() if canceled.ends_at else None,
        )
        return canceled


platform_management = PlatformManagementService()
