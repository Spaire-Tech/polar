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
from polar.models import Checkout, Organization
from polar.platform.repository import (
    platform_customer_repository,
    platform_product_repository,
    platform_subscription_repository,
)
from polar.platform.service import platform as platform_service
from polar.postgres import AsyncSession

log: structlog.stdlib.BoundLogger = structlog.get_logger()


_UPGRADEABLE_TIERS = (TierKey.pro, TierKey.scale)


class PlatformUpgradeError(PolarError): ...


class TierNotUpgradeable(PlatformUpgradeError):
    def __init__(self, tier: TierKey) -> None:
        super().__init__(
            f"Tier '{tier.value}' is not a valid upgrade target. "
            "Use 'pro' or 'scale'.",
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


_SYNTHETIC_EMAIL_SUFFIX = "@billing.spairehq.internal"


def _is_synthetic_email(email: str | None) -> bool:
    if email is None:
        return False
    return email.lower().endswith(_SYNTHETIC_EMAIL_SUFFIX)


class PlatformUpgradeService:
    async def create_checkout(
        self,
        session: AsyncSession,
        *,
        organization: Organization,
        tier: TierKey,
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

        # Find the target tier's product.
        product_repo = platform_product_repository(session)
        target_product = await product_repo.get_by_tier(
            platform_org.id, tier.value
        )
        if target_product is None:
            raise TierProductNotFound(tier)

        # Find the creator's existing platform-org customer record.
        customer_repo = platform_customer_repository(session)
        customer = await customer_repo.get_for_creator_org(
            platform_org.id, organization.id
        )
        if customer is None:
            # PR 4's hook should have created this on org create, and PR 6
            # backfills existing orgs. If it's still missing the operator
            # hasn't run the grandfather migration yet.
            raise MissingPlatformCustomer()

        # The platform Customer was created with a synthetic email in PR 4
        # (creator-{slug}@billing.spairehq.internal). Replace it with the
        # caller's real email before kicking off checkout so:
        #   - Stripe charges the right customer record,
        #   - Spaire invoices for the $49 / $299 subscription actually
        #     reach the creator,
        #   - the customer portal session (PR 18) shows the right email
        #     in the UI.
        if billing_email is not None and _is_synthetic_email(customer.email):
            customer.email = billing_email
            await session.flush()
        elif billing_email is not None and customer.email != billing_email:
            # Creator explicitly asked for a different billing address.
            # Honor it — they'll see invoices there from now on.
            customer.email = billing_email
            await session.flush()

        # If the customer has an active subscription, it must currently be
        # on a Free or Legacy product. The CheckoutProductCreate path uses
        # `subscription_id` to upgrade in-place; it requires the existing
        # subscription to be on free pricing.
        subscription_repo = platform_subscription_repository(session)
        existing_sub = await subscription_repo.get_active_for_customer(customer.id)

        existing_subscription_id: UUID | None = None
        if existing_sub is not None:
            existing_tier = (
                (existing_sub.product.user_metadata or {}).get("tier")
                if existing_sub.product is not None
                else None
            )
            if existing_tier in (TierKey.free.value, TierKey.legacy.value):
                existing_subscription_id = existing_sub.id
            elif existing_tier == tier.value:
                # Already on the requested tier — surface as 409 so the
                # frontend can refresh and show the existing subscription.
                raise AlreadyOnPaidTier()
            else:
                # Pro <-> Scale switches use subscription.update_product,
                # not the upgrade checkout path. Surface clearly so the
                # frontend can route to the right flow.
                raise AlreadyOnPaidTier()

        # Use model_validate so pydantic coerces success_url (a plain str)
        # into the HttpUrl-shaped SuccessUrl type the schema requires.
        checkout_create = CheckoutProductCreate.model_validate(
            {
                "product_id": target_product.id,
                "customer_id": customer.id,
                "subscription_id": existing_subscription_id,
                "success_url": success_url,
            }
        )

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
            checkout_id=str(checkout.id),
            existing_subscription_id=(
                str(existing_subscription_id) if existing_subscription_id else None
            ),
        )
        return checkout


platform_upgrade = PlatformUpgradeService()
