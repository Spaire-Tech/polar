from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import V2AccountInfo
from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization


@pytest.mark.asyncio
@pytest.mark.auth
async def test_create_invalid_account_type(
    client: AsyncClient, organization: Organization
) -> None:
    response = await client.post(
        "/v1/accounts",
        json={
            "account_type": "unknown",
            "country": "US",
            "organization_id": str(organization.id),
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
@pytest.mark.auth
async def test_create_personal_stripe(
    user: User,
    mocker: MockerFixture,
    client: AsyncClient,
    organization: Organization,
    user_organization: UserOrganization,
) -> None:
    fake_v2_info = V2AccountInfo(
        id="fake_stripe_id",
        email="foo@example.com",
        country="SE",
        currency="USD",
        is_details_submitted=False,
        is_transfers_enabled=False,
        is_payouts_enabled=False,
        business_type="company",
        data={},
    )

    mocker.patch(
        "polar.integrations.stripe.service.StripeService.create_account",
        return_value=fake_v2_info,
    )

    create_response = await client.post(
        "/v1/accounts",
        json={
            "account_type": "stripe",
            "country": "US",
            "organization_id": str(organization.id),
        },
    )

    assert create_response.status_code == 200
    assert create_response.json()["account_type"] == "stripe"
    assert create_response.json()["stripe_id"] == "fake_stripe_id"


@pytest.mark.asyncio
@pytest.mark.auth
async def test_dashboard_link_not_existing_account(
    user: User,
    organization: Organization,
    user_organization: UserOrganization,  # makes User a member of Organization
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/v1/accounts/3794dd38-54d1-4a64-bd68-fa22e1659e7b/dashboard_link"
    )

    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.auth
async def test_update(account: Account, client: AsyncClient) -> None:
    response = await client.patch(
        f"/v1/accounts/{account.id}",
        json={
            "billing_name": "John Doe",
            "billing_address": {
                "line1": "123 Main St",
                "postal_code": "10001",
                "city": "New York",
                "state": "NY",
                "country": "US",
            },
            "billing_notes": "This is a test billing note.",
        },
    )

    assert response.status_code == 200

    json = response.json()
    assert json["billing_name"] == "John Doe"
    assert json["billing_address"]["city"] == "New York"
    assert json["billing_notes"] == "This is a test billing note."


@pytest.mark.asyncio
@pytest.mark.auth
class TestConnectSession:
    async def test_not_existing_account(
        self,
        client: AsyncClient,
    ) -> None:
        response = await client.post(
            "/v1/accounts/3794dd38-54d1-4a64-bd68-fa22e1659e7b/connect_session",
            json={"scenario": "onboarding"},
        )
        assert response.status_code == 404

    async def test_unsupported_scenario(
        self,
        account: Account,
        client: AsyncClient,
    ) -> None:
        response = await client.post(
            f"/v1/accounts/{account.id}/connect_session",
            json={"scenario": "invalid_scenario"},
        )
        assert response.status_code == 422

    async def test_onboarding_success(
        self,
        account: Account,
        mocker: MockerFixture,
        client: AsyncClient,
    ) -> None:
        mock_session = MagicMock()
        mock_session.client_secret = "cas_test_secret_onboarding"

        mocker.patch(
            "polar.integrations.stripe.service.StripeService.create_account_session",
            return_value=mock_session,
        )

        response = await client.post(
            f"/v1/accounts/{account.id}/connect_session",
            json={"scenario": "onboarding"},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["client_secret"] == "cas_test_secret_onboarding"

    async def test_payouts_success(
        self,
        account: Account,
        mocker: MockerFixture,
        client: AsyncClient,
    ) -> None:
        mock_session = MagicMock()
        mock_session.client_secret = "cas_test_secret_payouts"

        mocker.patch(
            "polar.integrations.stripe.service.StripeService.create_account_session",
            return_value=mock_session,
        )

        response = await client.post(
            f"/v1/accounts/{account.id}/connect_session",
            json={"scenario": "payouts"},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["client_secret"] == "cas_test_secret_payouts"

    async def test_stripe_error(
        self,
        account: Account,
        mocker: MockerFixture,
        client: AsyncClient,
    ) -> None:
        mocker.patch(
            "polar.integrations.stripe.service.StripeService.create_account_session",
            side_effect=stripe_lib.StripeError("Something went wrong"),
        )

        response = await client.post(
            f"/v1/accounts/{account.id}/connect_session",
            json={"scenario": "onboarding"},
        )

        assert response.status_code == 500
