"""Tests for the platform trial-expiry cron.

platform_expire_trials is now the SOLE owner of the auto-attached Starter
trial's end-of-life (the generic subscription-cycle scheduler excludes it).
These tests verify it lapses an expired trial and hands the org off to the
resubscribe-to-Legacy actor, and leaves a not-yet-expired trial alone.
"""

from datetime import timedelta
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import Organization, Product
from polar.models.subscription import SubscriptionStatus
from polar.platform.tasks import platform_expire_trials
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


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.platform.tasks.enqueue_job")


async def _starter_product(
    save_fixture: SaveFixture, *, platform_org: Organization
) -> Product:
    prices: list[PriceFixtureType] = [(4900, "usd")]
    product = await create_product(
        save_fixture,
        organization=platform_org,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=prices,
    )
    product.user_metadata = {"tier": "starter", "billing_interval": "month"}
    await save_fixture(product)
    return product


@pytest.mark.asyncio
class TestPlatformExpireTrials:
    async def test_expired_trial_is_canceled_and_handed_off(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        customer = await create_customer(
            save_fixture,
            organization=platform_org,
            email=f"creator-{creator.slug}@billing.spairehq.internal",
            user_metadata={"creator_org_id": str(creator.id)},
        )
        product = await _starter_product(save_fixture, platform_org=platform_org)
        trial = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trialing,
            trial_end=utc_now() - timedelta(hours=1),
            user_metadata={"managed_by": "trial"},
        )

        session.expunge_all()

        await platform_expire_trials()

        refreshed = await session.get(type(trial), trial.id)
        assert refreshed is not None
        assert refreshed.status == SubscriptionStatus.canceled
        assert refreshed.ended_at is not None

        enqueue_job_mock.assert_any_call(
            "platform.resubscribe_to_legacy",
            organization_id=creator.id,
        )

    async def test_active_trial_is_left_alone(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: MagicMock,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        _patch_platform_org_id(mocker, platform_org.id)
        creator = await create_organization(save_fixture)
        customer = await create_customer(
            save_fixture,
            organization=platform_org,
            email=f"creator-{creator.slug}@billing.spairehq.internal",
            user_metadata={"creator_org_id": str(creator.id)},
        )
        product = await _starter_product(save_fixture, platform_org=platform_org)
        trial = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trialing,
            trial_end=utc_now() + timedelta(days=5),
            user_metadata={"managed_by": "trial"},
        )

        session.expunge_all()

        await platform_expire_trials()

        refreshed = await session.get(type(trial), trial.id)
        assert refreshed is not None
        assert refreshed.status == SubscriptionStatus.trialing
        enqueue_job_mock.assert_not_called()
