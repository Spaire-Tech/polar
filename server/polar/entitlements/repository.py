from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.kit.repository import RepositoryBase
from polar.models import Customer, Subscription
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncReadSession


class _EntitlementsCustomerRepository(RepositoryBase[Customer]):
    model = Customer

    async def get_platform_customer_for_creator_org(
        self,
        platform_org_id: UUID,
        creator_org_id: UUID,
    ) -> Customer | None:
        """Find the Customer record on the platform org that represents the
        given creator org. The link is stored in user_metadata.creator_org_id
        on the Customer (set when the creator org first subscribes — PR 4).
        """
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


class _EntitlementsSubscriptionRepository(RepositoryBase[Subscription]):
    model = Subscription

    async def get_active_for_customer_with_product(
        self,
        customer_id: UUID,
    ) -> Subscription | None:
        """Most recent active-or-trialing subscription for the customer, with
        the Product eager-loaded so the caller can read its metadata.tier.
        """
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


def platform_customer_repository(
    session: AsyncReadSession,
) -> _EntitlementsCustomerRepository:
    return _EntitlementsCustomerRepository.from_session(session)


def platform_subscription_repository(
    session: AsyncReadSession,
) -> _EntitlementsSubscriptionRepository:
    return _EntitlementsSubscriptionRepository.from_session(session)
