"""Fund lifecycle API endpoints."""

from uuid import UUID

from fastapi import Depends, Query

from polar.auth.dependencies import WebUserRead, WebUserWrite
from polar.enums import FundState
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
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
    FundPolicyRead,
    FundPolicyUpdate,
    FundStateEntryRead,
    FundStateStatus,
    FundStateSummary,
)
from .service import fund_lifecycle_service

router = APIRouter(
    prefix="/fund-lifecycle",
    tags=["fund-lifecycle", APITag.private],
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
    "/organizations/{organization_id}/status",
    response_model=FundStateStatus,
)
async def get_fund_status(
    organization_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> FundStateStatus:
    """Get fund lifecycle status for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await fund_lifecycle_service.get_fund_status(session, account)


@router.get(
    "/organizations/{organization_id}/entries",
    response_model=ListResource[FundStateEntryRead],
)
async def list_fund_entries(
    organization_id: UUID,
    auth_subject: WebUserRead,
    pagination: PaginationParamsQuery,
    state: FundState | None = Query(default=None),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[FundStateEntryRead]:
    """List fund state entries for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    results, count = await fund_lifecycle_service.list_entries(
        session, account.id, state=state, pagination=pagination
    )
    return ListResource.from_paginated_results(
        [FundStateEntryRead.model_validate(r) for r in results],
        count,
        pagination,
    )


@router.get(
    "/organizations/{organization_id}/policy",
    response_model=FundPolicyRead,
)
async def get_fund_policy(
    organization_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> FundPolicyRead:
    """Get the effective fund policy for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await fund_lifecycle_service.get_policy(session, account.id)


@router.patch(
    "/organizations/{organization_id}/policy",
    response_model=FundPolicyRead,
)
async def update_fund_policy(
    organization_id: UUID,
    policy_update: FundPolicyUpdate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> FundPolicyRead:
    """Update the fund policy for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    await fund_lifecycle_service.update_policy(session, account.id, policy_update)
    return await fund_lifecycle_service.get_policy(session, account.id)


@router.post(
    "/organizations/{organization_id}/recalculate",
    response_model=FundStateSummary,
)
async def trigger_recalculation(
    organization_id: UUID,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> FundStateSummary:
    """Manually trigger a fund state recalculation for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await fund_lifecycle_service.recalculate(
        session, account, reason="manual_trigger"
    )
