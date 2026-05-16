from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.kit.repository import RepositoryBase
from polar.models import Customer, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncReadSession


class _PlatformProductRepository(RepositoryBase[Product]):
    model = Product

    async def get_by_tier(
        self, platform_org_id: UUID, tier: str
    ) -> Product | None:
        """Return the monthly product for a tier — kept as the default
        lookup for the startup check and any caller that doesn't care
        about billing interval. For interval-aware lookups, use
        `get_by_tier_and_interval`."""
        return await self.get_by_tier_and_interval(
            platform_org_id, tier, "month"
        )

    async def get_by_tier_and_interval(
        self,
        platform_org_id: UUID,
        tier: str,
        billing_interval: str,
    ) -> Product | None:
        """Resolve the platform-org Product for (tier, billing_interval).

        Falls back to ignoring billing_interval when no row stores it
        (pre-annual seed) — that way a stale DB still returns the
        monthly row for "month" lookups before re-seeding lands.
        """
        statement = (
            select(Product)
            .where(Product.organization_id == platform_org_id)
            .where(Product.user_metadata["tier"].astext == tier)
            .where(
                Product.user_metadata["billing_interval"].astext == billing_interval
            )
            .where(Product.deleted_at.is_(None))
            .where(Product.is_archived.is_(False))
        )
        product = await self.get_one_or_none(statement)
        if product is not None or billing_interval != "month":
            return product

        # Backcompat: a pre-annual seed didn't stamp billing_interval.
        # For a "month" lookup, fall back to any tier-matching product
        # without the key so existing deploys still work.
        fallback = (
            select(Product)
            .where(Product.organization_id == platform_org_id)
            .where(Product.user_metadata["tier"].astext == tier)
            .where(Product.deleted_at.is_(None))
            .where(Product.is_archived.is_(False))
        )
        return await self.get_one_or_none(fallback)


class _PlatformCustomerRepository(RepositoryBase[Customer]):
    model = Customer

    async def get_for_creator_org(
        self, platform_org_id: UUID, creator_org_id: UUID
    ) -> Customer | None:
        statement = (
            select(Customer)
            .where(Customer.organization_id == platform_org_id)
            .where(
                Customer.user_metadata["creator_org_id"].astext
                == str(creator_org_id)
            )
            .where(Customer.deleted_at.is_(None))
        )
        return await self.get_one_or_none(statement)


class _PlatformSubscriptionRepository(RepositoryBase[Subscription]):
    model = Subscription

    async def get_active_for_customer(
        self, customer_id: UUID
    ) -> Subscription | None:
        # Subscription.product is lazy="raise" so we have to eager-load
        # it here — every caller of this method reads .product (to read
        # user_metadata.tier or product.id) so deferring would just trip
        # InvalidRequestError on the access.
        statement = (
            select(Subscription)
            .where(Subscription.customer_id == customer_id)
            .where(
                Subscription.status.in_(SubscriptionStatus.active_statuses())
            )
            .where(Subscription.deleted_at.is_(None))
            .options(selectinload(Subscription.product))
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def list_expired_trials(
        self, platform_org_id: UUID, *, before: datetime
    ) -> list[Subscription]:
        """All trialing platform-org subscriptions whose `trial_end`
        has already passed `before`. Joined to Customer so the cron task
        can read user_metadata.creator_org_id without an extra round-trip.
        """
        statement = (
            select(Subscription)
            .join(Customer, Subscription.customer_id == Customer.id)
            .where(Customer.organization_id == platform_org_id)
            .where(Customer.deleted_at.is_(None))
            .where(Subscription.status == SubscriptionStatus.trialing)
            .where(Subscription.deleted_at.is_(None))
            .where(Subscription.trial_end.is_not(None))
            .where(Subscription.trial_end < before)
            .options(
                selectinload(Subscription.product),
                selectinload(Subscription.customer),
            )
        )
        return list(await self.get_all(statement))


def platform_product_repository(
    session: AsyncReadSession,
) -> _PlatformProductRepository:
    return _PlatformProductRepository.from_session(session)


def platform_customer_repository(
    session: AsyncReadSession,
) -> _PlatformCustomerRepository:
    return _PlatformCustomerRepository.from_session(session)


def platform_subscription_repository(
    session: AsyncReadSession,
) -> _PlatformSubscriptionRepository:
    return _PlatformSubscriptionRepository.from_session(session)
