from uuid import UUID

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select

from polar.entitlements.tiers import TierKey
from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, Organization, Product, Subscription
from polar.models.subscription import SubscriptionStatus
from scripts.grandfather_orgs import (
    GRANDFATHER_TAG,
    grandfather_organizations,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    PriceFixtureType,
    create_customer,
    create_organization,
    create_product,
    create_subscription,
)


def _patch_platform_org_id(mocker: MockerFixture, org_id: UUID | None) -> None:
    mocker.patch("polar.platform.service.settings.PLATFORM_ORG_ID", org_id)


async def _seed_tier_product(
    save_fixture: SaveFixture,
    *,
    platform_org: Organization,
    tier: str,
    monthly_cents: int = 0,
) -> Product:
    prices: list[PriceFixtureType] = (
        [(None, "usd")] if monthly_cents == 0 else [(monthly_cents, "usd")]
    )
    product = await create_product(
        save_fixture,
        organization=platform_org,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=prices,
    )
    product.user_metadata = {"tier": tier}
    await save_fixture(product)
    return product


@pytest.mark.asyncio
class TestGrandfatherOrganizations:
    async def test_subscribes_uncovered_orgs_to_legacy(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier=TierKey.legacy.value
        )

        creators = [
            await create_organization(save_fixture) for _ in range(3)
        ]

        stats = await grandfather_organizations(
            session,
            platform_org=platform_org,
            dry_run=False,
        )

        # Each creator was scanned and grandfathered.
        assert stats.scanned == 3
        assert stats.grandfathered == 3
        assert stats.already_subscribed == 0

        # Each creator now has a Customer on the platform org + a Legacy sub.
        for creator in creators:
            customer = (
                await session.execute(
                    select(Customer)
                    .where(Customer.organization_id == platform_org.id)
                    .where(
                        Customer.user_metadata["creator_org_id"].astext
                        == str(creator.id)
                    )
                )
            ).scalar_one()
            subscription = (
                await session.execute(
                    select(Subscription).where(
                        Subscription.customer_id == customer.id
                    )
                )
            ).scalar_one()
            assert subscription.status == SubscriptionStatus.active
            assert subscription.user_metadata.get("managed_by") == GRANDFATHER_TAG

    async def test_skips_orgs_with_existing_subscription(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """An org that already has any active platform-org subscription
        (e.g. a Pro trial created by the org-create hook) must not be touched."""
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        pro_product = await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier=TierKey.starter.value
        )
        await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier=TierKey.legacy.value
        )

        already_on_pro = await create_organization(save_fixture)
        existing_customer = await create_customer(
            save_fixture,
            organization=platform_org,
            email=f"creator-{already_on_pro.id}@billing.spaire",
            user_metadata={"creator_org_id": str(already_on_pro.id)},
        )
        await create_subscription(
            save_fixture,
            product=pro_product,
            customer=existing_customer,
            status=SubscriptionStatus.active,
        )

        uncovered_creator = await create_organization(save_fixture)

        stats = await grandfather_organizations(
            session,
            platform_org=platform_org,
            dry_run=False,
        )

        assert stats.scanned == 2
        assert stats.already_subscribed == 1
        assert stats.grandfathered == 1

        # The already-on-Pro org's subscription is unchanged (still on Pro,
        # not downgraded to Legacy).
        unchanged = (
            await session.execute(
                select(Subscription).where(
                    Subscription.customer_id == existing_customer.id
                )
            )
        ).scalars().all()
        assert len(unchanged) == 1
        assert unchanged[0].product_id == pro_product.id

        # The other org got grandfathered.
        new_customer = (
            await session.execute(
                select(Customer)
                .where(Customer.organization_id == platform_org.id)
                .where(
                    Customer.user_metadata["creator_org_id"].astext
                    == str(uncovered_creator.id)
                )
            )
        ).scalar_one()
        new_sub = (
            await session.execute(
                select(Subscription).where(
                    Subscription.customer_id == new_customer.id
                )
            )
        ).scalar_one()
        assert new_sub.user_metadata.get("managed_by") == GRANDFATHER_TAG

    async def test_dry_run_makes_no_writes(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier=TierKey.legacy.value
        )
        await create_organization(save_fixture)
        await create_organization(save_fixture)

        stats = await grandfather_organizations(
            session,
            platform_org=platform_org,
            dry_run=True,
        )

        assert stats.scanned == 2
        assert stats.grandfathered == 2  # reported as "would_grandfather"
        # But no Customers or Subscriptions were created on the platform org.
        customer_count = (
            await session.execute(
                select(func.count(Customer.id)).where(
                    Customer.organization_id == platform_org.id
                )
            )
        ).scalar_one()
        subscription_count = (
            await session.execute(select(func.count(Subscription.id)))
        ).scalar_one()
        assert customer_count == 0
        assert subscription_count == 0

    async def test_limit_caps_scan(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier=TierKey.legacy.value
        )
        for _ in range(5):
            await create_organization(save_fixture)

        stats = await grandfather_organizations(
            session, platform_org=platform_org, dry_run=False, limit=2
        )

        assert stats.scanned == 2
        assert stats.grandfathered == 2

    async def test_excludes_platform_org_itself(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier=TierKey.legacy.value
        )

        stats = await grandfather_organizations(
            session, platform_org=platform_org, dry_run=False
        )

        assert stats.scanned == 0
        assert stats.grandfathered == 0
        # Platform org should not have a self-subscription.
        platform_customers = (
            await session.execute(
                select(Customer).where(
                    Customer.organization_id == platform_org.id
                )
            )
        ).scalars().all()
        assert len(platform_customers) == 0

    async def test_idempotent_when_rerun(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier=TierKey.legacy.value
        )
        creator = await create_organization(save_fixture)

        first = await grandfather_organizations(
            session, platform_org=platform_org, dry_run=False
        )
        assert first.grandfathered == 1

        second = await grandfather_organizations(
            session, platform_org=platform_org, dry_run=False
        )
        assert second.grandfathered == 0
        assert second.already_subscribed == 1

        customer_count = (
            await session.execute(
                select(func.count(Customer.id)).where(
                    Customer.organization_id == platform_org.id
                )
            )
        ).scalar_one()
        subscription_count = (
            await session.execute(select(func.count(Subscription.id)))
        ).scalar_one()
        assert customer_count == 1
        assert subscription_count == 1
        _ = creator  # silence unused-var
