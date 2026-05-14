"""Resolve a creator organization's active Spaire subscription tier and
return the entitlements (transaction fee, limits, feature flags) for it.

Every downstream consumer that needs to gate behavior on a tier reads from
this service. The static tier definitions live in `tiers.py`.

Resolution path:
1. If no platform org is configured, return the legacy entitlements
   (unlimited / global default fee). This preserves single-tenant and
   development-mode behavior.
2. If the org being queried IS the platform org itself, return legacy.
   The platform org is the seller, not a buyer.
3. Look up the Customer record on the platform org whose
   user_metadata.creator_org_id == <organization_id>.
4. Find that Customer's most recent active or trialing Subscription.
5. Read the Product's user_metadata.tier to determine the tier.
6. Any miss along the way returns legacy entitlements.
"""

from uuid import UUID

from polar.models import Product
from polar.platform.service import platform as platform_service
from polar.postgres import AsyncReadSession

from .repository import (
    platform_customer_repository,
    platform_subscription_repository,
)
from .tiers import TierEntitlements, TierKey, get_definition


class EntitlementsService:
    async def get_for_organization(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
    ) -> TierEntitlements:
        tier = await self.get_tier(session, organization_id)
        return get_definition(tier)

    async def get_tier(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
    ) -> TierKey:
        if not platform_service.is_configured():
            return TierKey.legacy

        if platform_service.is_platform_organization(organization_id):
            return TierKey.legacy

        platform_org_id = platform_service.get_id()

        customer_repo = platform_customer_repository(session)
        customer = await customer_repo.get_platform_customer_for_creator_org(
            platform_org_id, organization_id
        )
        if customer is None:
            return TierKey.legacy

        subscription_repo = platform_subscription_repository(session)
        subscription = await subscription_repo.get_active_for_customer_with_product(
            customer.id
        )
        if subscription is None:
            return TierKey.legacy

        product: Product | None = subscription.product
        if product is None:
            return TierKey.legacy

        tier_value = (product.user_metadata or {}).get("tier")
        if not isinstance(tier_value, str):
            return TierKey.legacy

        try:
            return TierKey(tier_value)
        except ValueError:
            return TierKey.legacy


entitlements = EntitlementsService()
