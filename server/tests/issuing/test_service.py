import uuid
from datetime import UTC, datetime, timedelta

import pytest
from pytest_mock import MockerFixture

from polar.enums import AccountType
from polar.issuing.service import issuing
from polar.models import Account, User
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestRunRiskClearance:
    async def test_feature_flag_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            stripe_id="acct_disabled",
            country="US",
            currency="usd",
            is_details_submitted=False,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            data={"money_state": "pending"},
        )
        await save_fixture(account)

        mocker.patch(
            "polar.issuing.service.settings.ISSUING_INSTANT_SPEND_ENABLED", False
        )

        updated = await issuing.run_risk_clearance(session)

        assert updated == 0

    async def test_pending_state_kept_before_window(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        pending_since = datetime.now(UTC) - timedelta(days=1)
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            stripe_id="acct_pending",
            country="US",
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=False,
            is_payouts_enabled=False,
            data={
                "money_state": "pending",
                "issuing_pending_since": pending_since.isoformat(),
            },
        )
        await save_fixture(account)

        mocker.patch(
            "polar.issuing.service.settings.ISSUING_INSTANT_SPEND_ENABLED", True
        )
        mocker.patch("polar.issuing.service.settings.ISSUING_PENDING_WINDOW_DAYS", 7)
        mocker.patch(
            "polar.issuing.service.transaction_service.get_transactions_sum",
            return_value=10_000,
        )

        updated = await issuing.run_risk_clearance(session)

        assert updated == 1
        assert account.data["money_state"] == "pending"
        assert account.data["issuing_balance_pending_amount"] == 10_000
        assert account.data["issuing_balance_available_amount"] == 9_000
        assert account.data["issuing_balance_reserve_amount"] == 1_000

    async def test_matured_pending_becomes_spendable_when_issuing_active(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        pending_since = datetime.now(UTC) - timedelta(days=10)
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            stripe_id="acct_spendable",
            country="US",
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            data={
                "money_state": "pending",
                "issuing_pending_since": pending_since.isoformat(),
                "issuing_onboarding_state": "issuing_active",
            },
        )
        await save_fixture(account)

        mocker.patch(
            "polar.issuing.service.settings.ISSUING_INSTANT_SPEND_ENABLED", True
        )
        mocker.patch("polar.issuing.service.settings.ISSUING_PENDING_WINDOW_DAYS", 7)
        mocker.patch(
            "polar.issuing.service.transaction_service.get_transactions_sum",
            return_value=20_000,
        )

        updated = await issuing.run_risk_clearance(session)

        assert updated == 1
        assert account.data["money_state"] == "spendable"
        assert account.data["issuing_balance_pending_amount"] == 0
        assert account.data["issuing_balance_available_amount"] == 0
        assert account.data["issuing_balance_spendable_amount"] == 18_000
        assert account.data["issuing_balance_reserve_amount"] == 2_000

    async def test_restricted_account_forces_reserve_state(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        pending_since = datetime.now(UTC) - timedelta(days=10)
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            stripe_id="acct_restricted",
            country="US",
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            status=Account.Status.UNDER_REVIEW,
            data={
                "money_state": "available",
                "issuing_pending_since": pending_since.isoformat(),
                "issuing_onboarding_state": "issuing_active",
            },
        )
        await save_fixture(account)

        mocker.patch(
            "polar.issuing.service.settings.ISSUING_INSTANT_SPEND_ENABLED", True
        )
        mocker.patch(
            "polar.issuing.service.transaction_service.get_transactions_sum",
            return_value=5_000,
        )

        updated = await issuing.run_risk_clearance(session)

        assert updated == 1
        assert account.data["money_state"] == "reserve"
        assert account.data["issuing_onboarding_state"] == "temporarily_restricted"
        assert account.data["issuing_block_reason"] == "account_restricted"
        assert account.data["issuing_balance_spendable_amount"] == 0
        assert account.data["issuing_balance_available_amount"] == 0
        assert account.data["issuing_balance_pending_amount"] == 0
        assert account.data["issuing_balance_reserve_amount"] == 5_000

    async def test_available_state_without_pending_since_gets_initialized(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        mocker: MockerFixture,
    ) -> None:
        account = Account(
            account_type=AccountType.stripe,
            admin_id=user.id,
            stripe_id="acct_available",
            country="US",
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            data={
                "money_state": "available",
                "issuing_onboarding_state": "onboarding_required",
            },
        )
        await save_fixture(account)

        mocker.patch(
            "polar.issuing.service.settings.ISSUING_INSTANT_SPEND_ENABLED", True
        )
        mocker.patch(
            "polar.issuing.service.transaction_service.get_transactions_sum",
            return_value=7_000,
        )

        updated = await issuing.run_risk_clearance(session)

        assert updated == 1
        assert account.data["money_state"] == "available"
        assert account.data["issuing_pending_since"] is not None
        assert account.data["issuing_balance_pending_amount"] == 0
        assert account.data["issuing_balance_available_amount"] == 6_300
        assert account.data["issuing_balance_reserve_amount"] == 700

    async def test_run_risk_clearance_for_account_id_not_found(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.issuing.service.settings.ISSUING_INSTANT_SPEND_ENABLED", True
        )

        updated = await issuing.run_risk_clearance_for_account_id(session, uuid.uuid4())

        assert updated is False
