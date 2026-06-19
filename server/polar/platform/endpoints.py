"""Dashboard-facing endpoints for Spaire's own platform billing.

  GET  /v1/platform/plans
      Lists Pro/Studio/Scale with their pricing and entitlements.

  GET  /v1/platform/organizations/{organization_id}/subscription
      Current Spaire subscription state for a creator org plus the
      resolved entitlements.

  POST /v1/platform/organizations/{organization_id}/upgrade-checkout
      Starts a Polar checkout for the target Pro/Studio/Scale tier.
      Returns a URL the creator visits to enter their card and complete
      the upgrade.
"""

from datetime import datetime
from uuid import UUID

from fastapi import Depends

from polar.auth.models import is_user
from polar.customer_session.service import (
    customer_session as customer_session_service,
)
from polar.entitlements.schemas import Entitlements
from polar.entitlements.service import entitlements as entitlements_service
from polar.entitlements.tiers import TierKey, get_definition
from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import ResourceNotFound
from polar.integrations.resend import domains as resend_domains
from polar.kit.trial import TrialInterval
from polar.kit.utils import utc_now
from polar.locker import Locker, get_locker
from polar.models import Product
from polar.models.product_price import ProductPriceFixed
from polar.models.subscription import SubscriptionStatus
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
from polar.organization.schemas import OrganizationID
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.quotas.definitions import QuotaKey
from polar.quotas.schemas import OrganizationUsage
from polar.quotas.schemas import QuotaUsage as QuotaUsageSchema
from polar.quotas.service import quotas as quotas_service
from polar.routing import APIRouter
from polar.subscription.schemas import Subscription as SubscriptionSchema

from . import auth
from .management import platform_management
from .repository import (
    platform_customer_repository,
    platform_product_repository,
    platform_subscription_repository,
)
from .schemas import (
    CancelSpaireSubscription,
    CurrentSpaireSubscription,
    CustomerPortalSession,
    CustomerPortalSessionCreate,
    EmailSenderDomainStatus,
    SwitchPlan,
    TierPlan,
    TierPlanList,
    UpgradeCheckout,
    UpgradeCheckoutCreate,
)
from .service import platform as platform_service
from .upgrade import platform_upgrade

router = APIRouter(prefix="/platform", tags=["platform", APITag.private])


_PLAN_TIERS = (TierKey.starter, TierKey.studio, TierKey.scale)
_TIER_NAMES = {
    TierKey.starter: "Spaire Starter",
    TierKey.studio: "Spaire Studio",
    TierKey.scale: "Spaire Scale",
}


def _trial_days_from_product(product: Product | None) -> int | None:
    """Resolve trial length from the seeded Product row. Source of truth
    is `seed_platform_products.PRODUCT_SPECS[*].trial`; the frontend
    surfaces this number on the upgrade modal cards.

    Only `day`-interval trials are translated to a days integer (every
    spec uses `day` today). Other intervals or unset trial config
    return None.
    """
    if product is None:
        return None
    if product.trial_interval is None or product.trial_interval_count is None:
        return None
    if product.trial_interval == TrialInterval.day:
        return product.trial_interval_count
    return None


def _annual_price_cents(annual_product: Product | None) -> int | None:
    """Pull the actual yearly amount off the annual Product's catalog
    price row. Returns None when annual hasn't been seeded so the
    frontend can hide the annual toggle for that tier."""
    if annual_product is None:
        return None
    for price in annual_product.prices:
        if isinstance(price, ProductPriceFixed) and not price.is_archived:
            return price.price_amount
    return None


async def _plan_for_tier(
    session: AsyncReadSession, platform_org_id: UUID | None, tier: TierKey
) -> TierPlan:
    definition = get_definition(tier)
    monthly_product: Product | None = None
    annual_product: Product | None = None
    if platform_org_id is not None:
        product_repo = platform_product_repository(session)
        monthly_product = await product_repo.get_by_tier_and_interval(
            platform_org_id, tier.value, "month"
        )
        annual_product = await product_repo.get_by_tier_and_interval(
            platform_org_id, tier.value, "year"
        )
    return TierPlan(
        tier=tier,
        name=_TIER_NAMES[tier],
        description=None,
        product_id=monthly_product.id if monthly_product is not None else None,
        annual_product_id=annual_product.id if annual_product is not None else None,
        monthly_price_cents=definition.monthly_price_cents,
        annual_price_cents=_annual_price_cents(annual_product),
        annual_savings_percent=20,
        trial_days=_trial_days_from_product(monthly_product),
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
    """Return the three subscribable Spaire plans (Pro, Studio, Scale)
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
    billing_interval: str | None = None
    is_default_trial = False
    past_due_at: datetime | None = None
    suspension_at: datetime | None = None

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
                # `amount` on the subscription row is the per-period
                # amount (monthly for month subs, yearly for year subs).
                # Normalize to a monthly figure for the dashboard so the
                # "Recurring monthly cost" copy stays accurate even on
                # annual plans.
                if subscription.recurring_interval == SubscriptionRecurringInterval.year:
                    billing_interval = "year"
                    monthly_price_cents = subscription.amount // 12
                else:
                    billing_interval = "month"
                    monthly_price_cents = subscription.amount
                current_period_end = subscription.current_period_end
                trial_end = subscription.trial_end
                cancel_at_period_end = subscription.cancel_at_period_end
                # Surface the dunning state so the dashboard can show a
                # "payment failed, pay by {date}" banner. past_due_deadline
                # is past_due_at + the dunning retry window; after it, the
                # sub is canceled and the org drops to `inactive`.
                if subscription.status == SubscriptionStatus.past_due:
                    past_due_at = subscription.past_due_at
                    suspension_at = subscription.past_due_deadline
                # The org-creation hook stamps managed_by=trial on the
                # auto-attached Pro trial. After the creator goes
                # through upgrade-checkout, Polar creates a new
                # subscription on the chosen tier and that becomes the
                # most-recent active sub — it carries no managed_by, so
                # is_default_trial flips False. The onboarding review
                # page reads this to verify a Stripe checkout actually
                # completed when it sees ?upgraded=1.
                managed_by = (subscription.user_metadata or {}).get(
                    "managed_by"
                )
                is_default_trial = managed_by == "trial"

    return CurrentSpaireSubscription(
        tier=entitlements_dataclass.tier,
        billing_interval=billing_interval,  # type: ignore[arg-type]
        status=status_label,
        monthly_price_cents=monthly_price_cents,
        current_period_end=current_period_end,
        trial_end=trial_end,
        cancel_at_period_end=cancel_at_period_end,
        past_due_at=past_due_at,
        suspension_at=suspension_at,
        is_default_trial=is_default_trial,
        entitlements=Entitlements.from_dataclass(entitlements_dataclass),
    )


@router.get(
    "/organizations/{organization_id}/usage",
    summary="Get Quota Usage",
    response_model=OrganizationUsage,
)
async def get_usage(
    organization_id: OrganizationID,
    auth_subject: auth.PlatformRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationUsage:
    """Current usage and tier-defined limit for every gated quota.

    Returns one entry per QuotaKey (video hours, video views, storage,
    email sends). Unlimited quotas surface as ``limit: null`` and
    ``remaining: null``. Used by the dashboard's "Usage" widget and
    helpful for backoffice debugging.
    """
    org_repository = OrganizationRepository.from_session(session)
    readable = org_repository.get_readable_statement(auth_subject).where(
        OrganizationRepository.model.id == organization_id
    )
    organization = await org_repository.get_one_or_none(readable)
    if organization is None:
        raise ResourceNotFound("Organization not found.")

    usage_map = await quotas_service.get_all_usage(session, organization.id)
    items = [QuotaUsageSchema.from_dataclass(usage_map[k]) for k in QuotaKey]
    return OrganizationUsage(items=items)


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

    # Resolve the billing email to stamp onto the platform customer.
    # Prefer an explicit value from the request; otherwise fall back to
    # the calling user's email. With either, the synthetic placeholder
    # email from PR 4 is replaced before checkout runs, so Stripe and
    # the customer portal see the real address.
    billing_email = body.billing_email
    if billing_email is None and is_user(auth_subject):
        billing_email = auth_subject.subject.email

    checkout = await platform_upgrade.create_checkout(
        session,
        organization=organization,
        tier=body.tier,
        billing_interval=body.billing_interval,
        success_url=body.success_url,
        billing_email=billing_email,
    )

    return UpgradeCheckout(
        checkout_id=checkout.id,
        checkout_url=checkout.url,
        client_secret=checkout.client_secret,
    )


@router.post(
    "/organizations/{organization_id}/switch-plan",
    summary="Switch Spaire Plan",
    response_model=SubscriptionSchema,
)
async def switch_plan(
    organization_id: OrganizationID,
    body: SwitchPlan,
    auth_subject: auth.PlatformWrite,
    session: AsyncSession = Depends(get_db_session),
) -> SubscriptionSchema:
    """Switch a creator's current Spaire subscription from one paid tier
    to another (Pro <-> Studio <-> Scale). The card on file is reused;
    proration is invoiced immediately. Use the upgrade-checkout endpoint
    to convert a trialing or Legacy subscription, and the cancel endpoint
    to end the paid subscription (org falls back to Legacy).
    """
    org_repository = OrganizationRepository.from_session(session)
    readable = org_repository.get_readable_statement(auth_subject).where(
        OrganizationRepository.model.id == organization_id
    )
    organization = await org_repository.get_one_or_none(readable)
    if organization is None:
        raise ResourceNotFound("Organization not found.")

    subscription = await platform_management.switch_plan(
        session,
        organization=organization,
        target_tier=body.tier,
        target_interval=body.billing_interval,
    )
    return SubscriptionSchema.model_validate(subscription)


@router.post(
    "/organizations/{organization_id}/cancel",
    summary="Cancel Spaire Subscription",
    response_model=SubscriptionSchema,
)
async def cancel_subscription(
    organization_id: OrganizationID,
    body: CancelSpaireSubscription,
    auth_subject: auth.PlatformWrite,
    session: AsyncSession = Depends(get_db_session),
    locker: Locker = Depends(get_locker),
) -> SubscriptionSchema:
    """Schedule the creator's current paid Spaire subscription to cancel
    at the end of the current billing period. When the subscription
    revokes the org is automatically re-subscribed to Legacy (no charge,
    no enforcement).

    Canceling on Legacy is a no-op (the Legacy subscription stays active).
    """
    _ = body  # Body kept for future cancel-reason capture.
    org_repository = OrganizationRepository.from_session(session)
    readable = org_repository.get_readable_statement(auth_subject).where(
        OrganizationRepository.model.id == organization_id
    )
    organization = await org_repository.get_one_or_none(readable)
    if organization is None:
        raise ResourceNotFound("Organization not found.")

    subscription = await platform_management.cancel_at_period_end(
        session, locker, organization=organization
    )
    return SubscriptionSchema.model_validate(subscription)


@router.post(
    "/organizations/{organization_id}/customer-portal-session",
    summary="Mint Customer Portal Session",
    response_model=CustomerPortalSession,
    status_code=201,
)
async def create_customer_portal_session(
    organization_id: OrganizationID,
    body: CustomerPortalSessionCreate,
    auth_subject: auth.PlatformWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerPortalSession:
    """Mint a short-lived customer-portal session for the platform-org
    customer that represents this creator. Returns a URL the creator
    can visit to view invoices, update payment methods, and cancel
    their Spaire subscription.

    The session token authenticates as the platform-org customer, which
    is necessarily a different identity from the dashboard user — so the
    portal shows the Spaire subscription (creator-as-buyer view), not the
    creator's own customers.
    """
    org_repository = OrganizationRepository.from_session(session)
    readable = org_repository.get_readable_statement(auth_subject).where(
        OrganizationRepository.model.id == organization_id
    )
    organization = await org_repository.get_one_or_none(readable)
    if organization is None:
        raise ResourceNotFound("Organization not found.")

    if not platform_service.is_configured():
        raise ResourceNotFound(
            "Spaire platform billing is not configured on this server."
        )

    platform_org_id = platform_service.get_id()
    customer_repo = platform_customer_repository(session)
    customer = await customer_repo.get_for_creator_org(
        platform_org_id, organization.id
    )
    if customer is None:
        # Should have been created by PR 4 on org-create or by PR 6's
        # grandfather migration; surface as 404 if neither has run.
        raise ResourceNotFound(
            "Your organization has not been provisioned on Spaire billing yet."
        )

    return_url = body.return_url
    token, customer_session = await customer_session_service.create_customer_session(
        session, customer, return_url=None if return_url is None else return_url  # type: ignore[arg-type]
    )
    customer_session.raw_token = token

    return CustomerPortalSession(
        token=token,
        expires_at=customer_session.expires_at,
        customer_portal_url=customer_session.customer_portal_url,
    )


@router.get(
    "/organizations/{organization_id}/email-sender-domain",
    summary="Get Custom Email Sender Domain Status",
    response_model=EmailSenderDomainStatus,
)
async def get_email_sender_domain(
    organization_id: OrganizationID,
    auth_subject: auth.PlatformRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> EmailSenderDomainStatus:
    """Current state of the org's custom outbound email sender domain:
    configured domain, Resend id, the DNS records the creator must
    install, and whether DKIM has verified.
    """
    org_repository = OrganizationRepository.from_session(session)
    readable = org_repository.get_readable_statement(auth_subject).where(
        OrganizationRepository.model.id == organization_id
    )
    organization = await org_repository.get_one_or_none(readable)
    if organization is None:
        raise ResourceNotFound("Organization not found.")
    return EmailSenderDomainStatus(
        domain=organization.email_sender_domain,
        verified_at=organization.email_sender_verified_at,
        resend_id=organization.email_sender_resend_id,
        dns_records=organization.email_sender_dns_records,
    )


@router.post(
    "/organizations/{organization_id}/email-sender-domain/verify",
    summary="Verify Custom Email Sender Domain",
    response_model=EmailSenderDomainStatus,
)
async def verify_email_sender_domain(
    organization_id: OrganizationID,
    auth_subject: auth.PlatformWrite,
    session: AsyncSession = Depends(get_db_session),
) -> EmailSenderDomainStatus:
    """Ask Resend to re-check the domain's DKIM records and stamp the
    verification timestamp if successful. Returns the updated state.

    The creator must have installed the DNS records returned by the
    GET endpoint before this call will succeed.
    """
    org_repository = OrganizationRepository.from_session(session)
    readable = org_repository.get_readable_statement(auth_subject).where(
        OrganizationRepository.model.id == organization_id
    )
    organization = await org_repository.get_one_or_none(readable)
    if organization is None:
        raise ResourceNotFound("Organization not found.")

    await entitlements_service.require_feature(
        session, organization.id, "custom_email_sender_domain"
    )

    if organization.email_sender_resend_id is None:
        raise ResourceNotFound(
            "No domain registered. Set email_sender_domain first via "
            "the organization update endpoint."
        )

    response = await resend_domains.verify_domain(
        organization.email_sender_resend_id
    )

    # Update cached records (Resend sometimes returns refreshed values).
    records = response.get("records")
    if isinstance(records, list):
        organization.email_sender_dns_records = records

    status = response.get("status")
    if status == "verified":
        if organization.email_sender_verified_at is None:
            organization.email_sender_verified_at = utc_now()
    else:
        # Status came back not_started / pending / failed — make sure
        # we don't claim verification.
        organization.email_sender_verified_at = None

    return EmailSenderDomainStatus(
        domain=organization.email_sender_domain,
        verified_at=organization.email_sender_verified_at,
        resend_id=organization.email_sender_resend_id,
        dns_records=organization.email_sender_dns_records,
    )
