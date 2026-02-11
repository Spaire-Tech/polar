"""Treasury API endpoints."""

from uuid import UUID

from fastapi import Depends

from polar.auth.dependencies import WebUserRead, WebUserWrite
from polar.exceptions import ResourceNotFound
from polar.models import Account
from polar.openapi import APITag
from polar.organization.service import organization as organization_service
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .schemas import (
    FinancialAccountCreate,
    FinancialAccountRead,
    TreasuryTransactionList,
)
from .service import treasury_service

router = APIRouter(
    prefix="/treasury",
    tags=["treasury", APITag.private],
)


async def _get_account_for_org(
    session: AsyncReadSession,
    auth_subject: WebUserRead,
    organization_id: UUID,
) -> Account:
    """Helper to resolve and validate an organization's account."""
    org = await organization_service.get(session, auth_subject, organization_id)
    if org is None:
        raise ResourceNotFound("Organization not found")

    if org.account_id is None:
        raise ResourceNotFound("Organization has no account")

    from polar.account.service import account as account_service

    account = await account_service._get_unrestricted(session, org.account_id)
    if account is None:
        raise ResourceNotFound("Account not found")

    return account


@router.get(
    "/organizations/{organization_id}/financial-account",
    response_model=FinancialAccountRead,
)
async def get_financial_account(
    organization_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> FinancialAccountRead:
    """Get the Financial Account for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    result = await treasury_service.get_financial_account(session, account.id)
    if result is None:
        raise ResourceNotFound("Financial Account not found")
    return result


@router.post(
    "/organizations/{organization_id}/financial-account",
    response_model=FinancialAccountRead,
    status_code=201,
)
async def create_financial_account(
    organization_id: UUID,
    params: FinancialAccountCreate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> FinancialAccountRead:
    """Create a Financial Account for an organization.

    Requires a Custom connected account with treasury capability enabled.
    """
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await treasury_service.create_financial_account(
        session, account, params
    )


@router.get(
    "/organizations/{organization_id}/transactions",
    response_model=TreasuryTransactionList,
)
async def list_transactions(
    organization_id: UUID,
    auth_subject: WebUserRead,
    limit: int = 20,
    starting_after: str | None = None,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> TreasuryTransactionList:
    """List Treasury transactions for an organization's Financial Account."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await treasury_service.list_transactions(
        session,
        account.id,
        limit=limit,
        starting_after=starting_after,
    )


@router.post(
    "/organizations/{organization_id}/sync-balance",
    response_model=FinancialAccountRead,
)
async def sync_balance(
    organization_id: UUID,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> FinancialAccountRead:
    """Manually trigger a balance sync from Stripe for an organization's FA."""
    from polar.account.service import account as account_service

    account = await _get_account_for_org(session, auth_subject, organization_id)

    from .repository import FinancialAccountRepository

    repo = FinancialAccountRepository(session)
    fa = await repo.get_by_account_id(account.id)
    if fa is None:
        raise ResourceNotFound("Financial Account not found")

    updated = await treasury_service.sync_balance(session, fa, account)
    return treasury_service._to_read_schema(updated)
