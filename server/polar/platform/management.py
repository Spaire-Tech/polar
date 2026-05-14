"""Server-side helpers for managing an existing Spaire subscription:
switching between paid tiers (Pro <-> Scale) and canceling a paid
subscription. Cancellation triggers auto-resubscribe-to-Free via
polar.platform.fee_sync.maybe_enqueue_resubscribe_from_revoke when
the subscription actually revokes.
"""

import structlog

from polar.entitlements.tiers import TierKey
from polar.enums import SubscriptionProrationBehavior
from polar.exceptions import PolarError
from polar.locker import Locker
from polar.models import Organization, Subscription
from polar.platform.repository import (
    platform_customer_repository,
    platform_product_repository,
    platform_subscription_repository,
)
from polar.platform.service import platform as platform_service
from polar.postgres import AsyncSession
from polar.subscription.service import subscription as subscription_service

log: structlog.stdlib.BoundLogger = structlog.get_logger()


_PAID_TIERS = (TierKey.pro, TierKey.scale)


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


class CannotSwitchToFree(PlatformManagementError):
    def __init__(self) -> None:
        super().__init__(
            "Use the cancel endpoint to downgrade to Free.",
            400,
        )


class SwitchRequiresPaidTier(PlatformManagementError):
    def __init__(self) -> None:
        super().__init__(
            "Plan switching is only available between paid tiers. Use the "
            "upgrade-checkout endpoint to start a paid subscription.",
            409,
        )


class _ResolvedSubscription:
    __slots__ = ("subscription", "current_tier")

    def __init__(self, subscription: Subscription, current_tier: TierKey) -> None:
        self.subscription = subscription
        self.current_tier = current_tier


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

    return _ResolvedSubscription(subscription, current_tier)


class PlatformManagementService:
    async def switch_plan(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        target_tier: TierKey,
    ) -> Subscription:
        """Switch a creator org from one paid tier to another (Pro <-> Scale).

        Uses subscription.update_product directly (no checkout needed —
        the customer's card is already on file). Proration is invoice-
        immediately so the customer sees the change on their next bill.
        """
        if target_tier == TierKey.free or target_tier == TierKey.legacy:
            raise CannotSwitchToFree()
        if target_tier not in _PAID_TIERS:
            raise CannotSwitchToFree()

        resolved = await _resolve_active(session, organization)

        if resolved.current_tier not in _PAID_TIERS:
            # Free -> paid goes through checkout, not update_product, since
            # no card is on file yet. Surface a 409 with a hint.
            raise SwitchRequiresPaidTier()

        if resolved.current_tier == target_tier:
            raise CannotSwitchToSameTier()

        platform_org_id = platform_service.get_id()
        product_repo = platform_product_repository(session)
        target_product = await product_repo.get_by_tier(
            platform_org_id, target_tier.value
        )
        if target_product is None:
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
            to_tier=target_tier.value,
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
        """Schedule the creator org's paid Spaire subscription to cancel
        at the end of the current billing period. When the subscription
        revokes, the platform.resubscribe_to_free actor will create a
        fresh Free subscription so the org keeps a valid tier record.
        """
        resolved = await _resolve_active(session, organization)

        if resolved.current_tier not in _PAID_TIERS:
            # Cancelling Free has no effect — they already have no payment
            # liability. Surface as a no-op success rather than an error.
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
