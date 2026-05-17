import uuid
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.held_balance.service import HeldBalanceService
from polar.held_balance.service import held_balance as held_balance_service
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Organization, User
from polar.models.organization import OrganizationStatus
from polar.organization.tasks import (
    OrganizationDoesNotExist,
    organization_created,
    organization_reviewed,
    organization_under_review,
)
from tests.fixtures.database import SaveFixture


@pytest.fixture(autouse=True)
def enqueue_email_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.organization.tasks.enqueue_email", autospec=True)


@pytest.mark.asyncio
class TestOrganizationCreated:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_created(uuid.uuid4())

    async def test_existing_organization(
        self, organization: Organization, session: AsyncSession
    ) -> None:
        # then
        session.expunge_all()

        await organization_created(organization.id)

    async def test_starts_pro_trial(
        self,
        mocker: MockerFixture,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        """The org-creation hook auto-attaches a 14-day Pro trial so the
        new creator lands on real Pro entitlements instead of silently
        falling through EntitlementsService's no-sub -> legacy branch
        (which used to grant unlimited everything)."""
        ensure_trial_mock = mocker.patch(
            "polar.organization.tasks.platform_billing.ensure_pro_trial_subscription",
            return_value=None,
        )

        session.expunge_all()

        await organization_created(organization.id)

        ensure_trial_mock.assert_called_once()
        called_org = ensure_trial_mock.call_args.args[1]
        assert called_org.id == organization.id

    async def test_falls_back_to_customer_when_tier_products_missing(
        self,
        mocker: MockerFixture,
        organization: Organization,
        session: AsyncSession,
    ) -> None:
        """Dev / single-tenant deploys won't have the platform tier
        products seeded yet — the hook should log and still create the
        platform Customer row so upgrade-checkout has something to
        attach to once the products land."""
        from polar.entitlements.tiers import TierKey
        from polar.platform.billing import TierProductMissing as _TPM

        mocker.patch(
            "polar.organization.tasks.platform_billing.ensure_pro_trial_subscription",
            side_effect=_TPM(TierKey.pro),
        )
        ensure_customer_mock = mocker.patch(
            "polar.organization.tasks.platform_billing.ensure_platform_customer",
            return_value=None,
        )

        session.expunge_all()

        await organization_created(organization.id)

        ensure_customer_mock.assert_called_once()


@pytest.mark.asyncio
class TestOrganizationUnderReview:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_under_review(uuid.uuid4())

    async def test_existing_organization(
        self,
        mocker: MockerFixture,
        enqueue_email_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # Update organization to have under review status
        organization.status = OrganizationStatus.INITIAL_REVIEW
        await save_fixture(organization)

        # then
        session.expunge_all()

        create_organization_review_thread_mock = mocker.patch(
            "polar.organization.tasks.plain_service.create_organization_review_thread"
        )
        get_admin_user_mock = mocker.patch(
            "polar.organization.tasks.OrganizationRepository.get_admin_user",
            return_value=user,
        )

        await organization_under_review(organization.id)

        enqueue_email_mock.assert_called_once()
        create_organization_review_thread_mock.assert_called_once()
        get_admin_user_mock.assert_called_once()

    async def test_existing_organization_with_account(
        self,
        mocker: MockerFixture,
        enqueue_email_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        # Update organization to have under review status and account
        organization.status = OrganizationStatus.INITIAL_REVIEW
        organization.account_id = account.id
        await save_fixture(organization)

        # then
        session.expunge_all()

        create_organization_review_thread_mock = mocker.patch(
            "polar.organization.tasks.plain_service.create_organization_review_thread"
        )
        get_admin_user_mock = mocker.patch(
            "polar.organization.tasks.OrganizationRepository.get_admin_user",
            return_value=user,
        )

        await organization_under_review(organization.id)

        enqueue_email_mock.assert_called_once()
        create_organization_review_thread_mock.assert_called_once()
        get_admin_user_mock.assert_called_once()


@pytest.mark.asyncio
class TestOrganizationReviewed:
    async def test_not_existing_organization(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(OrganizationDoesNotExist):
            await organization_reviewed(uuid.uuid4())

    async def test_existing_organization(
        self,
        mocker: MockerFixture,
        enqueue_email_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
    ) -> None:
        # Update organization to have active status
        organization.status = OrganizationStatus.ACTIVE
        await save_fixture(organization)

        mocker.patch.object(
            held_balance_service,
            "release_account",
            spec=HeldBalanceService.release_account,
        )
        get_admin_user_mock = mocker.patch(
            "polar.organization.tasks.OrganizationRepository.get_admin_user",
            return_value=user,
        )

        # then
        session.expunge_all()

        await organization_reviewed(organization.id, initial_review=True)

        enqueue_email_mock.assert_called_once()
        get_admin_user_mock.assert_called_once()

    async def test_existing_organization_with_account(
        self,
        mocker: MockerFixture,
        enqueue_email_mock: MagicMock,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        account: Account,
        user: User,
    ) -> None:
        # Update organization to have active status and account
        organization.status = OrganizationStatus.ACTIVE
        organization.account_id = account.id
        await save_fixture(organization)

        release_account_mock = mocker.patch.object(
            held_balance_service,
            "release_account",
            spec=HeldBalanceService.release_account,
        )
        get_admin_user_mock = mocker.patch(
            "polar.organization.tasks.OrganizationRepository.get_admin_user",
            return_value=user,
        )

        # then
        session.expunge_all()

        await organization_reviewed(organization.id, initial_review=True)

        release_account_mock.assert_called_once()
        enqueue_email_mock.assert_called_once()
        get_admin_user_mock.assert_called_once()
