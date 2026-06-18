"""Server-side helper that creates an upgrade checkout for a creator
organization on Spaire's own platform-org products.

Used by polar.platform.endpoints.POST .../upgrade-checkout. Constructs
an internal AuthSubject scoped to the platform organization so the
existing checkout creation path's auth validation passes — the platform
org owns the product, so it's authorized to sell it.
"""

from typing import Literal
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.checkout.schemas import CheckoutProductCreate
from polar.checkout.service import checkout as checkout_service
from polar.entitlements.tiers import TierKey
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import Checkout, Organization
from polar.models.subscription import SubscriptionStatus
from polar.platform.billing import platform_billing
from polar.platform.repository import (
    platform_customer_repository,
    platform_product_repository,
    platform_subscription_repository,
)
from polar.platform.service import platform as platform_service
from polar.postgres import AsyncSession

log: structlog.stdlib.BoundLogger = structlog.get_logger()


_UPGRADEABLE_TIERS = (TierKey.starter, TierKey.studio, TierKey.scale)


class PlatformUpgradeError(PolarError): ...


class TierNotUpgradeable(PlatformUpgradeError):
    def __init__(self, tier: TierKey) -> None:
        super().__init__(
            f"Tier '{tier.value}' is not a valid upgrade target. "
            "Use 'starter', 'studio', or 'scale'.",
            400,
        )


class PlatformOrgNotConfigured(PlatformUpgradeError):
    def __init__(self) -> None:
        super().__init__(
            "Spaire platform billing is not configured on this server.",
            503,
        )


class TierProductNotFound(PlatformUpgradeError):
    def __init__(self, tier: TierKey) -> None:
        super().__init__(
            f"Spaire {tier.value.capitalize()} product is not available. "
            "Contact support.",
            503,
        )


class AlreadyOnPaidTier(PlatformUpgradeError):
    def __init__(self) -> None:
        super().__init__(
            "Your organization is already on a paid Spaire plan. Use the "
            "subscription management flow to switch plans.",
            409,
        )


class MissingPlatformCustomer(PlatformUpgradeError):
    def __init__(self) -> None:
        super().__init__(
            "Your organization has not been provisioned on Spaire billing yet. "
            "Try again in a moment.",
            503,
        )


class PlatformUpgradeService:
    async def create_checkout(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        tier: TierKey,
        billing_interval: Literal["month", "year"] = "month",
        success_url: str | None = None,
        billing_email: str | None = None,
    ) -> Checkout:
        if tier not in _UPGRADEABLE_TIERS:
            raise TierNotUpgradeable(tier)

        if not platform_service.is_configured():
            raise PlatformOrgNotConfigured()
        platform_org = await platform_service.get(session)

        if organization.id == platform_org.id:
            # Defensive — the platform org cannot upgrade itself.
            raise TierNotUpgradeable(tier)

        # Find the target tier's product for the chosen billing interval.
        product_repo = platform_product_repository(session)
        target_product = await product_repo.get_by_tier_and_interval(
            platform_org.id, tier.value, billing_interval
        )
        if target_product is None:
            raise TierProductNotFound(tier)

        # Find the creator's existing platform-org customer record.
        # The org-creation hook creates this synchronously now (no trial
        # sub, just the Customer row), but a creator hitting this
        # endpoint on a not-yet-processed actor still needs to be
        # rescued — so we bootstrap inline as a safety net.
        customer_repo = platform_customer_repository(session)
        customer = await customer_repo.get_for_creator_org(
            platform_org.id, organization.id
        )
        if customer is None:
            await platform_billing.ensure_platform_customer(session, organization)
            customer = await customer_repo.get_for_creator_org(
                platform_org.id, organization.id
            )
        if customer is None:
            raise MissingPlatformCustomer()

        # We deliberately do NOT overwrite customer.email with the user's
        # real email here. The platform-org `customers` table has a
        # unique constraint on (organization_id, lower(email)), and a
        # single creator who owns multiple Spaire orgs would have one
        # Customer per org — they can't all share the same real email.
        # The synthetic `creator-{slug}@billing.spairehq.internal`
        # address keeps each Customer row unique. Stripe still gets the
        # real email via CheckoutProductCreate.customer_email below, so
        # receipts and tax invoices reach the creator's actual inbox.

        # `subscription_id` on CheckoutProductCreate is Polar's "convert
        # from free to paid" hook — it only accepts subscriptions whose
        # prices are all free. So we pass it ONLY when the creator is on
        # the Legacy ($0) product (grandfathered orgs upgrading for the
        # first time). For paid trialing subs we instead revoke the
        # auto-trial inline (see below) — Polar's checkout uniqueness
        # check would otherwise reject the new checkout with
        # AlreadyActiveSubscriptionError.
        subscription_repo = platform_subscription_repository(session)
        existing_sub = await subscription_repo.get_active_for_customer(customer.id)

        existing_subscription_id: UUID | None = None
        if existing_sub is not None:
            existing_tier = (
                (existing_sub.product.user_metadata or {}).get("tier")
                if existing_sub.product is not None
                else None
            )
            managed_by = (existing_sub.user_metadata or {}).get("managed_by")
            if existing_tier == TierKey.legacy.value:
                # Legacy is the only $0 product we ship; safe to pass to
                # Polar's upgrade-from-free path.
                existing_subscription_id = existing_sub.id
            elif existing_sub.trialing and managed_by == "trial":
                # Auto-attached Pro trial from organization.created. The
                # Pro product is billable, so Polar's checkout-side
                # `_validate_subscription_uniqueness` will refuse to
                # create another billable subscription for this customer.
                # We can't pass `subscription_id` to upgrade-from either
                # — that only accepts $0 subs. Revoke the trial in
                # place so the customer's slate is clean before checkout
                # creates a fresh, payment-method-backed subscription on
                # the chosen tier. If checkout never completes the
                # creator simply lands on no platform sub (Legacy
                # fallback) and the dashboard plan-gate bounces them
                # back to /onboarding/plan to retry.
                now = utc_now()
                existing_sub.status = SubscriptionStatus.canceled
                existing_sub.canceled_at = now
                existing_sub.ended_at = now
                existing_sub.cancel_at_period_end = False
                await session.flush()
                log.info(
                    "platform.upgrade_checkout.revoked_auto_trial",
                    organization_id=str(organization.id),
                    subscription_id=str(existing_sub.id),
                    target_tier=tier.value,
                )
            elif existing_sub.trialing:
                # Trialing on a paid product that wasn't auto-attached
                # (rare — e.g. a creator who already converted once and
                # is now on a fresh Stripe-managed trial). Fall through
                # and let Polar's uniqueness check decide; we don't
                # want to revoke a real Stripe-managed subscription
                # from under the user.
                pass
            elif existing_tier == tier.value:
                # Active (non-trialing) on the same paid tier — already
                # paid for it, no upgrade to perform.
                raise AlreadyOnPaidTier()
            else:
                # Active on a different paid tier → use switch_plan,
                # not upgrade-checkout.
                raise AlreadyOnPaidTier()

        # Use model_validate so pydantic coerces success_url (a plain str)
        # into the HttpUrl-shaped SuccessUrl type the schema requires.
        # `customer_email` (when supplied) prefills the user's real email
        # on the Polar/Stripe checkout form so receipts and tax invoices
        # land in their actual inbox — independent of the synthetic
        # platform-Customer email kept above for uniqueness.
        checkout_payload: dict[str, object] = {
            "product_id": target_product.id,
            "customer_id": customer.id,
            "subscription_id": existing_subscription_id,
            "success_url": success_url,
        }
        if billing_email is not None:
            checkout_payload["customer_email"] = billing_email
        checkout_create = CheckoutProductCreate.model_validate(checkout_payload)

        # Construct an AuthSubject scoped to the platform org so the
        # checkout's auth-aware product lookup succeeds. The platform
        # org is the seller of the Pro/Scale product, so this is the
        # accurate authorization context.
        platform_auth_subject: AuthSubject[Organization] = AuthSubject(
            subject=platform_org,
            scopes={
                Scope.web_write,
                Scope.checkouts_write,
                Scope.checkouts_read,
            },
            session=None,
        )

        checkout = await checkout_service.create(
            session, checkout_create, platform_auth_subject
        )

        log.info(
            "platform.upgrade_checkout.created",
            organization_id=str(organization.id),
            tier=tier.value,
            billing_interval=billing_interval,
            checkout_id=str(checkout.id),
            existing_subscription_id=(
                str(existing_subscription_id) if existing_subscription_id else None
            ),
        )
        return checkout


platform_upgrade = PlatformUpgradeService()
