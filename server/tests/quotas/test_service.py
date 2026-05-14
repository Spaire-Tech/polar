from datetime import UTC, datetime
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from polar.enums import SubscriptionRecurringInterval
from polar.models import Organization, Product
from polar.models.event import EventSource
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.quotas.definitions import QuotaKey
from polar.quotas.service import quotas
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    PriceFixtureType,
    create_customer,
    create_event,
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


async def _subscribe_to_tier(
    save_fixture: SaveFixture,
    *,
    platform_org: Organization,
    creator: Organization,
    tier: str,
    monthly_cents: int,
) -> None:
    product = await _seed_tier_product(
        save_fixture,
        platform_org=platform_org,
        tier=tier,
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


@pytest.mark.asyncio
class TestGetUsage:
    async def test_count_aggregation_for_email_sends(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="free",
            monthly_cents=0,
        )

        for _ in range(7):
            await create_event(
                save_fixture,
                organization=creator,
                source=EventSource.system,
                name="spaire.email.sent",
            )

        usage = await quotas.get_usage(
            session, creator.id, QuotaKey.email_sends_monthly
        )

        assert usage.used == 7
        assert usage.limit == 5000  # free tier
        assert usage.remaining == 4993
        assert usage.is_unlimited is False
        assert usage.is_exceeded is False

    async def test_sum_aggregation_for_video_hours(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="free",
            monthly_cents=0,
        )

        # Two videos: 1800s (30 min) and 5400s (90 min) = 7200s = 2 hours
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.video.uploaded",
            metadata={"duration_seconds": 1800},
        )
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.video.uploaded",
            metadata={"duration_seconds": 5400},
        )

        usage = await quotas.get_usage(
            session, creator.id, QuotaKey.video_hours_hosted
        )

        assert usage.used == 2  # 7200 seconds / 3600 = 2 hours
        assert usage.limit == 5
        assert usage.remaining == 3

    async def test_storage_bytes_sums_positive_and_negative(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="pro",
            monthly_cents=4900,
        )

        gb = 1024 * 1024 * 1024
        # Upload 3 files (15 GB total), delete one (5 GB)
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.storage.bytes",
            metadata={"bytes_delta": 5 * gb},
        )
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.storage.bytes",
            metadata={"bytes_delta": 5 * gb},
        )
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.storage.bytes",
            metadata={"bytes_delta": 5 * gb},
        )
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.storage.bytes",
            metadata={"bytes_delta": -5 * gb},
        )

        usage = await quotas.get_usage(
            session, creator.id, QuotaKey.storage_gb
        )

        assert usage.used == 10  # 15 GB - 5 GB
        assert usage.limit == 25  # pro tier

    async def test_user_source_events_are_ignored(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="free",
            monthly_cents=0,
        )

        # User-submitted events with the same name should NOT inflate quota
        # usage. Otherwise a creator could fake usage via the events API.
        for _ in range(50):
            await create_event(
                save_fixture,
                organization=creator,
                source=EventSource.user,
                name="spaire.email.sent",
            )

        usage = await quotas.get_usage(
            session, creator.id, QuotaKey.email_sends_monthly
        )

        assert usage.used == 0

    async def test_monthly_scope_ignores_previous_month_events(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="free",
            monthly_cents=0,
        )

        # 60 days ago — should be excluded
        old = datetime.now(UTC).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        ).replace(month=max(datetime.now(UTC).month - 2, 1))
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.email.sent",
            timestamp=old,
        )
        # Today — should count
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.email.sent",
        )

        usage = await quotas.get_usage(
            session, creator.id, QuotaKey.email_sends_monthly
        )

        assert usage.used == 1

    async def test_lifetime_scope_counts_old_events(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="free",
            monthly_cents=0,
        )

        old = datetime.now(UTC).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        ).replace(month=max(datetime.now(UTC).month - 6, 1))
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.video.uploaded",
            metadata={"duration_seconds": 3600},
            timestamp=old,
        )
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.video.uploaded",
            metadata={"duration_seconds": 3600},
        )

        usage = await quotas.get_usage(
            session, creator.id, QuotaKey.video_hours_hosted
        )

        # Both events count toward lifetime quota.
        assert usage.used == 2

    async def test_scale_tier_unlimited_returns_none_limit(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="scale",
            monthly_cents=29900,
        )

        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.video.uploaded",
            metadata={"duration_seconds": 100 * 3600},
        )

        usage = await quotas.get_usage(
            session, creator.id, QuotaKey.video_hours_hosted
        )

        assert usage.limit is None
        assert usage.remaining is None
        assert usage.is_unlimited is True
        assert usage.is_exceeded is False
        assert usage.used == 100


@pytest.mark.asyncio
class TestCheck:
    async def test_allows_when_under_limit(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="free",
            monthly_cents=0,
        )

        result = await quotas.check(
            session,
            creator.id,
            QuotaKey.email_sends_monthly,
            requested_storage_units=100,
        )

        assert result.allowed is True
        assert result.reason == "ok"
        assert result.limit == 5000
        assert result.used == 0
        assert result.remaining == 5000

    async def test_blocks_when_requested_would_exceed(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="free",
            monthly_cents=0,
        )
        for _ in range(4999):
            await create_event(
                save_fixture,
                organization=creator,
                source=EventSource.system,
                name="spaire.email.sent",
            )

        result = await quotas.check(
            session,
            creator.id,
            QuotaKey.email_sends_monthly,
            requested_storage_units=10,
        )

        assert result.allowed is False
        assert result.reason == "exceeded"
        assert result.used == 4999
        assert result.limit == 5000

    async def test_allows_unlimited_tier(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="scale",
            monthly_cents=29900,
        )

        result = await quotas.check(
            session,
            creator.id,
            QuotaKey.video_views_monthly,
            requested_storage_units=1_000_000,
        )

        assert result.allowed is True
        assert result.reason == "unlimited"
        assert result.limit is None

    async def test_legacy_tier_is_unlimited(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        # No platform org configured -> legacy tier returns None limits.
        _patch_platform_org_id(mocker, None)
        creator = await create_organization(save_fixture)

        result = await quotas.check(
            session,
            creator.id,
            QuotaKey.storage_gb,
            requested_storage_units=999 * 1024 * 1024 * 1024,
        )

        assert result.allowed is True
        assert result.reason == "unlimited"
        assert result.limit is None

    async def test_byte_precision_blocks_at_byte_level(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        """Storage check works at byte precision: an org under its 1 GB cap
        cannot upload a single byte that would push it over."""
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        await _subscribe_to_tier(
            save_fixture,
            platform_org=platform_org,
            creator=creator,
            tier="free",
            monthly_cents=0,
        )
        gb = 1024 * 1024 * 1024
        await create_event(
            save_fixture,
            organization=creator,
            source=EventSource.system,
            name="spaire.storage.bytes",
            metadata={"bytes_delta": gb - 100},
        )

        # 200 bytes more would push past the cap.
        block = await quotas.check(
            session,
            creator.id,
            QuotaKey.storage_gb,
            requested_storage_units=200,
        )
        assert block.allowed is False
        assert block.reason == "exceeded"
        # But 50 bytes still fits.
        allow = await quotas.check(
            session,
            creator.id,
            QuotaKey.storage_gb,
            requested_storage_units=50,
        )
        assert allow.allowed is True
        assert allow.reason == "ok"
