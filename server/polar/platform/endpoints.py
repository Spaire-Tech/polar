"""Dashboard-facing endpoints for Spaire's own platform billing.

  GET  /v1/platform/plans
      Lists Free/Pro/Scale with their pricing and entitlements.

  GET  /v1/platform/organizations/{organization_id}/subscription
      Current Spaire subscription state for a creator org plus the
      resolved entitlements.

  POST /v1/platform/organizations/{organization_id}/upgrade-checkout
      Starts a Polar checkout for the target Pro/Scale tier. Returns
      a URL the creator visits to enter their card and complete the
      upgrade.
"""

from datetime import datetime
from uuid import UUID

from fastapi import Depends

from polar.entitlements.schemas import Entitlements
from polar.entitlements.service import entitlements as entitlements_service
from polar.entitlements.tiers import TierKey, get_definition
from polar.exceptions import ResourceNotFound
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncReadSession, AsyncSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from . import auth
from .repository import (
    platform_customer_repository,
    platform_product_repository,
    platform_subscription_repository,
)
from .schemas import (
    CurrentSpaireSubscription,
    TierPlan,
    TierPlanList,
    UpgradeCheckout,
    UpgradeCheckoutCreate,
)
from .service import platform as platform_service
from .upgrade import platform_upgrade

router = APIRouter(prefix="/platform", tags=["platform", APITag.private])


_PLAN_TIERS = (TierKey.free, TierKey.pro, TierKey.scale)
_TIER_NAMES = {
    TierKey.free: "Spaire Free",
    TierKey.pro: "Spaire Pro",
    TierKey.scale: "Spaire Scale",
}
_TIER_TRIAL_DAYS = {
    TierKey.free: None,
    TierKey.pro: 14,
    TierKey.scale: None,
}


async def _plan_for_tier(
    session: AsyncReadSession, platform_org_id: UUID | None, tier: TierKey
) -> TierPlan:
    definition = get_definition(tier)
    product_id: UUID | None = None
    if platform_org_id is not None:
        product_repo = platform_product_repository(session)
        product = await product_repo.get_by_tier(platform_org_id, tier.value)
        if product is not None:
            product_id = product.id
    return TierPlan(
        tier=tier,
        name=_TIER_NAMES[tier],
        description=None,
        product_id=product_id,
        monthly_price_cents=definition.monthly_price_cents,
        trial_days=_TIER_TRIAL_DAYS[tier],
        transaction_fee=Entitlements.from_dataclass(definition).transaction_fee,
        features=Entitlements.from_dataclass(definition).features,
        limits=Entitlements.from_dataclass(definition).limits,
    )


@router.get(
    "/plans",
    summary="List Spaire Plans",
    response_model=TierPlanList,
)
async def list_plans(
    auth_subject: auth.PlatformRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> TierPlanList:
    """Return the three subscribable Spaire plans (Free, Pro, Scale)
    with their list pricing, trial config, and entitlements.

    Used by the dashboard to render the upgrade modal.
    """
    _ = auth_subject  # auth is for access gating only
    platform_org_id: UUID | None = None
    if platform_service.is_configured():
        platform_org_id = platform_service.get_id()
    items = [
        await _plan_for_tier(session, platform_org_id, tier)
        for tier in _PLAN_TIERS
    ]
    return TierPlanList(items=items)


@router.get(
    "/organizations/{organization_id}/subscription",
    summary="Get Current Spaire Subscription",
    response_model=CurrentSpaireSubscription,
)
async def get_subscription(
    organization_id: OrganizationID,
    auth_subject: auth.PlatformRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CurrentSpaireSubscription:
    """Return the creator org's current Spaire subscription state."""
    org_repository = OrganizationRepository.from_session(session)
    readable = org_repository.get_readable_statement(auth_subject).where(
        OrganizationRepository.model.id == organization_id
    )
    organization = await org_repository.get_one_or_none(readable)
    if organization is None:
        raise ResourceNotFound("Organization not found.")

    entitlements_dataclass = await entitlements_service.get_for_organization(
        session, organization.id
    )

    status_label = "none"
    monthly_price_cents = entitlements_dataclass.monthly_price_cents
    current_period_end: datetime | None = None
    trial_end: datetime | None = None
    cancel_at_period_end = False

    if platform_service.is_configured():
        platform_org_id = platform_service.get_id()
        customer_repo = platform_customer_repository(session)
        customer = await customer_repo.get_for_creator_org(
            platform_org_id, organization.id
        )
        if customer is not None:
            subscription_repo = platform_subscription_repository(session)
            subscription = await subscription_repo.get_active_for_customer(
                customer.id
            )
            if subscription is not None:
                status_label = subscription.status.value
                monthly_price_cents = subscription.amount
                current_period_end = subscription.current_period_end
                trial_end = subscription.trial_end
                cancel_at_period_end = subscription.cancel_at_period_end

    return CurrentSpaireSubscription(
        tier=entitlements_dataclass.tier,
        status=status_label,
        monthly_price_cents=monthly_price_cents,
        current_period_end=current_period_end,
        trial_end=trial_end,
        cancel_at_period_end=cancel_at_period_end,
        entitlements=Entitlements.from_dataclass(entitlements_dataclass),
    )


@router.post(
    "/organizations/{organization_id}/upgrade-checkout",
    summary="Create Upgrade Checkout",
    response_model=UpgradeCheckout,
    status_code=201,
)
async def create_upgrade_checkout(
    organization_id: OrganizationID,
    body: UpgradeCheckoutCreate,
    auth_subject: auth.PlatformWrite,
    session: AsyncSession = Depends(get_db_session),
) -> UpgradeCheckout:
    """Create a Polar checkout for the target Pro/Scale tier on the
    Spaire platform org. Returns a URL the creator visits to enter their
    card and complete the upgrade.
    """
    org_repository = OrganizationRepository.from_session(session)
    readable = org_repository.get_readable_statement(auth_subject).where(
        OrganizationRepository.model.id == organization_id
    )
    organization = await org_repository.get_one_or_none(readable)
    if organization is None:
        raise ResourceNotFound("Organization not found.")

    checkout = await platform_upgrade.create_checkout(
        session,
        organization=organization,
        tier=body.tier,
        success_url=body.success_url,
    )

    return UpgradeCheckout(
        checkout_id=checkout.id,
        checkout_url=checkout.url,
        client_secret=checkout.client_secret,
    )
