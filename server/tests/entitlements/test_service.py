from uuid import UUID, uuid4

import pytest
from pytest_mock import MockerFixture

from polar.entitlements.service import entitlements
from polar.entitlements.tiers import TierKey
from polar.enums import SubscriptionRecurringInterval
from polar.models import Organization, Product
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
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
class TestGetTier:
    async def test_no_platform_org_configured_returns_legacy(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        _patch_platform_org_id(mocker, None)
        creator = await create_organization(save_fixture)

        tier = await entitlements.get_tier(session, creator.id)

        assert tier == TierKey.legacy

    async def test_platform_org_itself_returns_legacy(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)

        tier = await entitlements.get_tier(session, platform_org.id)

        assert tier == TierKey.legacy

    async def test_no_platform_customer_returns_legacy(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        creator = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)

        tier = await entitlements.get_tier(session, creator.id)

        assert tier == TierKey.legacy

    async def test_no_active_subscription_returns_legacy(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        creator = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)

        product = await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier="pro", monthly_cents=4900
        )
        customer = await create_customer(
            save_fixture,
            organization=platform_org,
            email=f"creator-{creator.id}@billing.spaire",
            user_metadata={"creator_org_id": str(creator.id)},
        )
        # Subscription exists but is canceled.
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
        )

        tier = await entitlements.get_tier(session, creator.id)

        assert tier == TierKey.legacy

    @pytest.mark.parametrize(
        "tier_label,expected,monthly_cents",
        [
            ("free", TierKey.free, 0),
            ("pro", TierKey.pro, 4900),
            ("scale", TierKey.scale, 29900),
        ],
    )
    async def test_active_subscription_returns_product_tier(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        tier_label: str,
        expected: TierKey,
        monthly_cents: int,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        creator = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)

        product = await _seed_tier_product(
            save_fixture,
            platform_org=platform_org,
            tier=tier_label,
            monthly_cents=monthly_cents,
        )
        customer = await create_customer(
            save_fixture,
            organization=platform_org,
            email=f"creator-{creator.id}@billing.spaire",
            user_metadata={"creator_org_id": str(creator.id)},
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        tier = await entitlements.get_tier(session, creator.id)

        assert tier == expected

    async def test_trialing_subscription_returns_product_tier(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        creator = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)

        product = await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier="pro", monthly_cents=4900
        )
        customer = await create_customer(
            save_fixture,
            organization=platform_org,
            email=f"creator-{creator.id}@billing.spaire",
            user_metadata={"creator_org_id": str(creator.id)},
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trialing,
        )

        tier = await entitlements.get_tier(session, creator.id)

        assert tier == TierKey.pro

    async def test_unrecognized_tier_metadata_returns_legacy(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        creator = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)

        product = await _seed_tier_product(
            save_fixture,
            platform_org=platform_org,
            tier="enterprise_xxl",
            monthly_cents=99900,
        )
        customer = await create_customer(
            save_fixture,
            organization=platform_org,
            email=f"creator-{creator.id}@billing.spaire",
            user_metadata={"creator_org_id": str(creator.id)},
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        tier = await entitlements.get_tier(session, creator.id)

        assert tier == TierKey.legacy

    async def test_missing_org_with_platform_configured_returns_legacy(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)

        tier = await entitlements.get_tier(session, uuid4())

        assert tier == TierKey.legacy


@pytest.mark.asyncio
class TestGetForOrganization:
    async def test_returns_tier_definition(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        creator = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)

        product = await _seed_tier_product(
            save_fixture, platform_org=platform_org, tier="pro", monthly_cents=4900
        )
        customer = await create_customer(
            save_fixture,
            organization=platform_org,
            email=f"creator-{creator.id}@billing.spaire",
            user_metadata={"creator_org_id": str(creator.id)},
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.active,
        )

        result = await entitlements.get_for_organization(session, creator.id)

        assert result.tier == TierKey.pro
        assert result.transaction_fee.percent_basis_points == 400
        assert result.transaction_fee.fixed_cents == 40
        assert result.monthly_price_cents == 4900
        assert result.features.email_sequences_and_segments is True
        assert result.features.white_label_course_player is False
        assert result.features.customer_wallet is False
        assert result.limits.published_courses is None
        assert result.limits.email_sends_monthly == 250_000

    async def test_legacy_has_unlimited_limits(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        _patch_platform_org_id(mocker, None)
        creator = await create_organization(save_fixture)

        result = await entitlements.get_for_organization(session, creator.id)

        assert result.tier == TierKey.legacy
        assert result.limits.published_courses is None
        assert result.limits.email_sends_monthly is None
        assert result.features.custom_email_sender_domain is True


class TestTierDefinitions:
    """Smoke-test the static tier definitions to guard the pricing-page contract."""

    def test_free_shape(self) -> None:
        from polar.entitlements.tiers import get_definition

        free = get_definition(TierKey.free)
        assert free.monthly_price_cents == 0
        assert free.transaction_fee.percent_basis_points == 500
        assert free.transaction_fee.fixed_cents == 50
        assert free.limits.published_courses == 1
        assert free.limits.lessons_per_course == 10
        assert free.limits.video_hours_hosted == 5
        assert free.limits.email_sends_monthly == 5000
        assert free.features.email_sequences_and_segments is False
        assert free.features.custom_pricing_negotiation is False

    def test_pro_shape(self) -> None:
        from polar.entitlements.tiers import get_definition

        pro = get_definition(TierKey.pro)
        assert pro.monthly_price_cents == 4900
        assert pro.transaction_fee.percent_basis_points == 400
        assert pro.transaction_fee.fixed_cents == 40
        assert pro.limits.published_courses is None
        assert pro.limits.email_sends_monthly == 250_000
        assert pro.features.email_sequences_and_segments is True
        assert pro.features.customer_wallet is False
        assert pro.rate_limit_group == "elevated"

    def test_scale_shape(self) -> None:
        from polar.entitlements.tiers import get_definition

        scale = get_definition(TierKey.scale)
        assert scale.monthly_price_cents == 29900
        assert scale.transaction_fee.percent_basis_points == 350
        assert scale.transaction_fee.fixed_cents == 30
        assert scale.limits.video_hours_hosted is None
        assert scale.limits.dashboard_team_seats is None
        assert scale.features.custom_pricing_negotiation is True
        assert scale.features.customer_wallet is True
        assert scale.features.white_label_course_player is True
