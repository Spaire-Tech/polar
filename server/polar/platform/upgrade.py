"""Server-side helper that creates an upgrade checkout for a creator
organization on Spaire's own platform-org products.

Used by polar.platform.endpoints.POST .../upgrade-checkout. Constructs
an internal AuthSubject scoped to the platform organization so the
existing checkout creation path's auth validation passes — the platform
org owns the product, so it's authorized to sell it.
"""

from datetime import datetime, timedelta
from math import ceil
from typing import Literal

import structlog

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.checkout.schemas import CheckoutProductCreate
from polar.checkout.service import checkout as checkout_service
from polar.customer.repository import CustomerRepository
from polar.entitlements.tiers import TierKey
from polar.exceptions import PolarError
from polar.kit.trial import TrialInterval
from polar.kit.utils import utc_now
from polar.models import Checkout, Customer, Organization
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
    async def _apply_real_billing_email(
        self,
        session: AsyncSession,
        customer: Customer,
        real_email: str | None,
    ) -> None:
        """Set the platform Customer's email to the creator's real address
        so Stripe receipts / tax invoices are deliverable.

        The platform `customers` table is unique on (organization_id,
        lower(email)). A single person who owns several Spaire orgs has one
        platform Customer per org; if they all share one real email, only
        the first can hold it. So we only adopt the real email when no other
        platform Customer in the org already has it — otherwise we keep the
        synthetic placeholder (the real email is still prefilled on the
        checkout form via customer_email).
        """
        if real_email is None:
            return
        if customer.email.lower() == real_email.lower():
            return
        customer_repository = CustomerRepository.from_session(session)
        existing = await customer_repository.get_by_email_and_organization(
            real_email, customer.organization_id
        )
        if existing is not None and existing.id != customer.id:
            return
        customer.email = real_email
        await session.flush()

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

        # Put the creator's real email on the platform Customer (when it
        # doesn't collide with another of their orgs) so Stripe receipts
        # and tax invoices reach a real inbox instead of the synthetic
        # `creator-{slug}@billing.spairehq.internal` placeholder.
        await self._apply_real_billing_email(session, customer, billing_email)

        # Resolve the creator's current active platform subscription to
        # decide how the checkout should treat it.
        #
        #   - Trialing (the auto-attached Starter trial, or any trial):
        #     carry the REMAINING trial days onto the paid subscription and
        #     leave the trial live. It is NOT revoked here — payment must
        #     succeed first, after which maybe_supersede_platform_trial
        #     cancels it. If the creator abandons checkout, the trial is
        #     untouched and they keep their remaining days. Polar's
        #     checkout uniqueness check is satisfied because the platform
        #     org runs with allow_multiple_subscriptions enabled.
        #   - Legacy ($0): convert it in place via Polar's upgrade-from-free
        #     hook (`subscription_id`). No trial — a churned/grandfathered
        #     creator pays immediately.
        #   - Active on a paid tier: not an upgrade-checkout operation
        #     (use switch-plan instead).
        subscription_repo = platform_subscription_repository(session)
        existing_sub = await subscription_repo.get_active_for_customer(customer.id)

        carryover_trial_end: datetime | None = None
        if existing_sub is not None:
            if existing_sub.trialing:
                carryover_trial_end = existing_sub.trial_end
            else:
                # Active (non-trialing) on a paid tier — same tier or a
                # different one both route through switch-plan, not here.
                # (An org with no active plan resolves to `inactive`, so
                # get_active_for_customer returns None and we fall through
                # to a fresh, immediate-charge checkout below.)
                raise AlreadyOnPaidTier()

        # Use model_validate so pydantic coerces success_url (a plain str)
        # into the HttpUrl-shaped SuccessUrl type the schema requires.
        checkout_payload: dict[str, object] = {
            "product_id": target_product.id,
            "customer_id": customer.id,
            "success_url": success_url,
        }

        now = utc_now()
        if carryover_trial_end is not None and carryover_trial_end > now:
            # Grant only the days remaining on the original trial, not a
            # fresh 14. Round up to whole days; clamp to the schema's 1..1000.
            remaining_days = ceil((carryover_trial_end - now) / timedelta(days=1))
            remaining_days = max(1, min(remaining_days, 1000))
            checkout_payload["trial_interval"] = TrialInterval.day
            checkout_payload["trial_interval_count"] = remaining_days
        else:
            # No active trial to carry (inactive / churned / expired): the
            # conversion bills immediately. This also closes the
            # "cancel trial, re-upgrade for a fresh 14 days" abuse loop —
            # once an org has no plan, an upgrade carries no trial.
            checkout_payload["allow_trial"] = False

        if billing_email is not None:
            # Also prefill the checkout form with the real email.
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
            carried_trial=carryover_trial_end is not None
            and carryover_trial_end > now,
        )
        return checkout


platform_upgrade = PlatformUpgradeService()
