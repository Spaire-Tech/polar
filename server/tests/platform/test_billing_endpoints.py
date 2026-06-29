"""The dashboard-native Spaire billing endpoints resolve the creator org's
platform Customer and return its cards / orders / billing details — so a
creator manages their Spaire subscription inside the dashboard instead of
being redirected to the customer portal.

These drive the endpoint functions directly with an Organization auth
subject (the creator org), exercising the real org->platform-customer
resolution + serialization.
"""

import uuid

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncSession

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.enums import PaymentProcessor
from polar.kit.address import AddressInput, CountryAlpha2
from polar.kit.pagination import PaginationParams
from polar.models import (
    Customer,
    Order,
    OrderItem,
    Organization,
    PaymentMethod,
)
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.platform import endpoints as platform_endpoints
from polar.platform.schemas import PlatformBillingDetailsUpdate
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_organization,
)

_SCOPES = {
    Scope.web_read,
    Scope.web_write,
    Scope.organizations_read,
    Scope.organizations_write,
}
_PAGINATION = PaginationParams(page=1, limit=20)


async def _setup(
    save_fixture: SaveFixture, mocker: MockerFixture
) -> tuple[Organization, Organization, Customer]:
    """Platform (Spaire) org + a creator org that is its Customer."""
    platform_org = await create_organization(save_fixture)
    mocker.patch("polar.platform.service.settings.PLATFORM_ORG_ID", platform_org.id)
    creator = await create_organization(save_fixture)
    customer = await create_customer(
        save_fixture,
        organization=platform_org,
        email="creator+billing@gmail.com",
        user_metadata={"creator_org_id": str(creator.id)},
    )
    # No Stripe customer in tests — billing-address updates skip the Stripe
    # sync (which is exercised in the customer-service tests); we're testing
    # the platform endpoint resolution + persistence here.
    customer.stripe_customer_id = None
    await save_fixture(customer)
    return platform_org, creator, customer


def _auth(creator: Organization) -> AuthSubject[Organization]:
    return AuthSubject(creator, _SCOPES, None)


@pytest.mark.asyncio
class TestPlatformBillingEndpoints:
    async def test_list_payment_methods(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        _, creator, customer = await _setup(save_fixture, mocker)
        pm = PaymentMethod(
            processor=PaymentProcessor.stripe,
            processor_id="pm_test_123",
            type="card",
            method_metadata={
                "brand": "visa",
                "last4": "4242",
                "exp_month": 12,
                "exp_year": 2030,
            },
            customer=customer,
        )
        await save_fixture(pm)

        result = await platform_endpoints.list_payment_methods(
            organization_id=creator.id,
            auth_subject=_auth(creator),
            pagination=_PAGINATION,
            session=session,
        )

        assert result.pagination.total_count == 1
        assert result.items[0].id == pm.id

    async def test_list_orders(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        _, creator, customer = await _setup(save_fixture, mocker)
        order = Order(
            status=OrderStatus.paid,
            subtotal_amount=12900,
            discount_amount=0,
            net_amount=12900,
            tax_amount=0,
            applied_balance_amount=0,
            currency="usd",
            billing_reason=OrderBillingReasonInternal.subscription_cycle,
            invoice_number=f"SPAIRE-{uuid.uuid4().hex[:6].upper()}-0001",
            customer=customer,
            items=[
                OrderItem(
                    label="Studio plan",
                    amount=12900,
                    net_amount=12900,
                    tax_amount=0,
                    proration=False,
                )
            ],
            custom_field_data={},
            user_metadata={},
        )
        await save_fixture(order)

        result = await platform_endpoints.list_orders(
            organization_id=creator.id,
            auth_subject=_auth(creator),
            pagination=_PAGINATION,
            session=session,
        )

        assert result.pagination.total_count == 1
        item = result.items[0]
        assert item.id == order.id
        assert item.total_amount == 12900
        assert item.status == "paid"
        assert item.is_invoice_generated is False

    async def test_get_and_update_billing_details(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        _, creator, customer = await _setup(save_fixture, mocker)

        before = await platform_endpoints.get_billing_details(
            organization_id=creator.id,
            auth_subject=_auth(creator),
            session=session,
        )
        assert before.billing_name != "Jane Creator"

        updated = await platform_endpoints.update_billing_details(
            organization_id=creator.id,
            body=PlatformBillingDetailsUpdate(
                billing_name="Jane Creator",
                billing_address=AddressInput(country=CountryAlpha2("US")),
            ),
            auth_subject=_auth(creator),
            session=session,
        )
        assert updated.billing_name == "Jane Creator"
        assert updated.billing_address is not None
        assert updated.billing_address.country == "US"

    async def test_unprovisioned_org_404s(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        # A creator org with no platform Customer yet -> ResourceNotFound.
        platform_org = await create_organization(save_fixture)
        mocker.patch(
            "polar.platform.service.settings.PLATFORM_ORG_ID", platform_org.id
        )
        creator = await create_organization(save_fixture)

        from polar.exceptions import ResourceNotFound

        with pytest.raises(ResourceNotFound):
            await platform_endpoints.get_billing_details(
                organization_id=creator.id,
                auth_subject=_auth(creator),
                session=session,
            )
