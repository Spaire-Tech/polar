"""Platform-side billing: subscribe creator organizations to Spaire's own
Free/Pro/Scale plans.

This is the write counterpart to polar.entitlements.service (read-only).
Spaire is itself an Organization (the "platform org"); every creator org
is a Customer of that platform org and holds a Subscription to one of
the platform's products. This module manages that linkage.
"""

import logging
from uuid import UUID

import structlog

from polar.entitlements.tiers import TierKey
from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models import Customer, Organization, Product, Subscription
from polar.models.product_price import (
    ProductPriceFixed,
    ProductPriceFree,
)
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_product_price import SubscriptionProductPrice
from polar.platform.service import platform as platform_service
from polar.postgres import AsyncSession

from .repository import (
    platform_customer_repository,
    platform_product_repository,
    platform_subscription_repository,
)

log: structlog.stdlib.BoundLogger = structlog.get_logger()
logging.getLogger(__name__)


class PlatformBillingError(PolarError): ...


class TierProductMissing(PlatformBillingError):
    """The platform-org product for a tier doesn't exist yet.

    Surfaces when scripts.seed_platform_products hasn't been run on this
    environment. The caller (a Dramatiq task) catches this, logs, and
    returns — we'd rather have an org without a Spaire subscription than
    block its creation.
    """

    def __init__(self, tier: TierKey) -> None:
        super().__init__(
            f"No platform-org product found with metadata.tier='{tier.value}'. "
            "Run `uv run task seed_platform_products` to create them.",
            500,
        )


def _billing_email(organization: Organization) -> str:
    """Synthetic Customer.email for the platform-org Customer that anchors
    this creator org's Spaire subscription. Free customers are never sent
    invoices, so the address doesn't need to be deliverable. When the
    creator upgrades, real billing details are captured at checkout and
    overwrite this synthetic value.
    """
    return f"creator-{organization.slug}@billing.spairehq.internal"


def _price_amount_cents(product: Product) -> int:
    """Resolve the recurring base amount in cents for a platform product.

    Treats Free / metered-only products as $0.
    """
    for price in product.prices:
        if isinstance(price, ProductPriceFree):
            return 0
        if isinstance(price, ProductPriceFixed):
            return price.price_amount
    return 0


class PlatformBillingService:
    async def ensure_free_subscription(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> Subscription | None:
        """Ensure the creator organization has an active platform-org
        subscription to the Free tier.

        Idempotent: re-running is a no-op once subscription exists.
        Returns None (without raising) when no platform org is configured
        or when the new organization IS the platform org itself.
        """
        if not platform_service.is_configured():
            return None

        platform_org_id = platform_service.get_id()
        if organization.id == platform_org_id:
            return None

        customer = await self._ensure_platform_customer(
            session, organization, platform_org_id
        )

        subscription_repo = platform_subscription_repository(session)
        existing = await subscription_repo.get_active_for_customer(customer.id)
        if existing is not None:
            return existing

        product_repo = platform_product_repository(session)
        free_product = await product_repo.get_by_tier(
            platform_org_id, TierKey.free.value
        )
        if free_product is None:
            raise TierProductMissing(TierKey.free)

        return await self._create_subscription(
            session, customer=customer, product=free_product
        )

    async def _ensure_platform_customer(
        self,
        session: AsyncSession,
        organization: Organization,
        platform_org_id: UUID,
    ) -> Customer:
        customer_repo = platform_customer_repository(session)
        existing = await customer_repo.get_for_creator_org(
            platform_org_id, organization.id
        )
        if existing is not None:
            return existing

        customer = Customer(
            email=_billing_email(organization),
            name=organization.name,
            organization_id=platform_org_id,
            user_metadata={"creator_org_id": str(organization.id)},
        )
        session.add(customer)
        await session.flush()
        return customer

    async def _create_subscription(
        self,
        session: AsyncSession,
        *,
        customer: Customer,
        product: Product,
    ) -> Subscription:
        recurring_interval = (
            product.recurring_interval or SubscriptionRecurringInterval.month
        )
        recurring_interval_count = product.recurring_interval_count or 1
        amount = _price_amount_cents(product)
        currency = "usd"

        now = utc_now()
        current_period_end = recurring_interval.get_next_period(
            now, recurring_interval_count
        )

        subscription_prices = [
            SubscriptionProductPrice.from_price(price) for price in product.prices
        ]

        subscription = Subscription(
            amount=amount,
            net_amount=amount,
            currency=currency,
            recurring_interval=recurring_interval,
            recurring_interval_count=recurring_interval_count,
            status=SubscriptionStatus.active,
            current_period_start=now,
            current_period_end=current_period_end,
            cancel_at_period_end=False,
            started_at=now,
            customer_id=customer.id,
            product_id=product.id,
            subscription_product_prices=subscription_prices,
        )
        session.add(subscription)
        await session.flush()

        log.info(
            "platform_billing.subscribed_to_free",
            creator_org_id=customer.user_metadata.get("creator_org_id"),
            customer_id=str(customer.id),
            subscription_id=str(subscription.id),
            product_id=str(product.id),
        )
        return subscription


platform_billing = PlatformBillingService()
