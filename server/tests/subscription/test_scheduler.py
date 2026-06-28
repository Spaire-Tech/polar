"""The subscription cycle scheduler must not pick up the auto-attached
Spaire Starter trial (managed_by=trial). Those subscriptions carry no
payment method; cycling one would flip it to active and emit an
uncollectable order. Their end-of-life is owned solely by the
platform.expire_trials cron.
"""

from datetime import timedelta

import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models.subscription import SubscriptionStatus
from polar.postgres import AsyncSession
from polar.subscription.scheduler import SubscriptionJobStore
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_customer,
    create_organization,
    create_product,
    create_subscription,
)


def _base_statement():
    # Bypass __init__ so we don't spin up the scheduler's sync engine; the
    # statement builder itself uses no instance state.
    store = SubscriptionJobStore.__new__(SubscriptionJobStore)
    return store._get_base_statement()


@pytest.mark.asyncio
class TestSchedulerExcludesAutoTrial:
    async def test_trial_excluded_normal_included(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        organization = await create_organization(save_fixture)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(4900, "usd")],
        )
        customer = await create_customer(save_fixture, organization=organization)

        past = utc_now() - timedelta(hours=1)

        # Auto-trial: must NOT be returned by the scheduler.
        trial = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.trialing,
            current_period_end=past,
            trial_end=past,
            user_metadata={"managed_by": "trial"},
        )

        # A normal active subscription: must be returned.
        normal = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            current_period_end=past,
        )

        result = await session.execute(_base_statement())
        ids = {row.id for row in result.scalars().all()}

        assert trial.id not in ids
        assert normal.id in ids

    async def test_sub_without_managed_by_is_included(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        # A subscription whose metadata has no managed_by key (NULL) must
        # stay in scope — is_distinct_from('trial') keeps NULLs.
        organization = await create_organization(save_fixture)
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(4900, "usd")],
        )
        customer = await create_customer(save_fixture, organization=organization)
        sub = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            current_period_end=utc_now() - timedelta(hours=1),
        )
        assert "managed_by" not in (sub.user_metadata or {})

        result = await session.execute(_base_statement())
        ids = {row.id for row in result.scalars().all()}
        assert sub.id in ids
