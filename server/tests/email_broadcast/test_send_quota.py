"""The email-send monthly quota is enforced at schedule/send time (not only
per-recipient in the worker), so an over-cap broadcast fails fast with a 402.

These tests cover the new _enforce_send_quota gate's wiring; the underlying
quota check semantics (grace, blocking) are covered by tests/quotas.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture

from polar.email_broadcast.service import email_broadcast
from polar.postgres import AsyncSession
from polar.quotas.definitions import QuotaKey
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization


@pytest.mark.asyncio
class TestEnforceSendQuota:
    async def test_noop_for_zero_recipients(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        enforce = mocker.patch("polar.quotas.producers.enforce", new=AsyncMock())
        await email_broadcast._enforce_send_quota(
            session, SimpleNamespace(organization_id=uuid4()), 0
        )
        enforce.assert_not_called()

    async def test_enforces_with_recipient_count(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        organization = await create_organization(save_fixture)
        enforce = mocker.patch("polar.quotas.producers.enforce", new=AsyncMock())

        await email_broadcast._enforce_send_quota(
            session,
            SimpleNamespace(organization_id=organization.id),
            5000,
        )

        enforce.assert_awaited_once()
        # (session, organization, QuotaKey.email_sends_monthly,
        #  requested_storage_units=5000)
        assert enforce.await_args.args[2] == QuotaKey.email_sends_monthly
        assert enforce.await_args.kwargs["requested_storage_units"] == 5000

    async def test_noop_when_org_missing(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        enforce = mocker.patch("polar.quotas.producers.enforce", new=AsyncMock())
        await email_broadcast._enforce_send_quota(
            session, SimpleNamespace(organization_id=uuid4()), 100
        )
        enforce.assert_not_called()
