from uuid import UUID

from sqlalchemy import select

from polar.kit.repository import RepositoryBase
from polar.models import Customer, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncReadSession


class _PlatformProductRepository(RepositoryBase[Product]):
    model = Product

    async def get_by_tier(
        self, platform_org_id: UUID, tier: str
    ) -> Product | None:
        statement = (
            select(Product)
            .where(Product.organization_id == platform_org_id)
            .where(Product.user_metadata["tier"].astext == tier)
            .where(Product.deleted_at.is_(None))
            .where(Product.is_archived.is_(False))
        )
        return await self.get_one_or_none(statement)


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
        statement = (
            select(Subscription)
            .where(Subscription.customer_id == customer_id)
            .where(
                Subscription.status.in_(SubscriptionStatus.active_statuses())
            )
            .where(Subscription.deleted_at.is_(None))
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)


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
