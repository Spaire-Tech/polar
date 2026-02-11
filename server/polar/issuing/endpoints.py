"""Issuing API endpoints — cardholder and card management."""

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
    CardholderCreate,
    CardholderRead,
    CardholderUpdate,
    IssuedCardCreate,
    IssuedCardRead,
    IssuedCardUpdate,
)
from .service import issuing_service

router = APIRouter(
    prefix="/issuing",
    tags=["issuing", APITag.private],
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


# ── Cardholder endpoints ──


@router.get(
    "/organizations/{organization_id}/cardholders",
    response_model=list[CardholderRead],
)
async def list_cardholders(
    organization_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[CardholderRead]:
    """List all cardholders for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await issuing_service.list_cardholders(session, account.id)


@router.get(
    "/organizations/{organization_id}/cardholders/{cardholder_id}",
    response_model=CardholderRead,
)
async def get_cardholder(
    organization_id: UUID,
    cardholder_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CardholderRead:
    """Get a specific cardholder."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    result = await issuing_service.get_cardholder(
        session, account.id, cardholder_id
    )
    if result is None:
        raise ResourceNotFound("Cardholder not found")
    return result


@router.post(
    "/organizations/{organization_id}/cardholders",
    response_model=CardholderRead,
    status_code=201,
)
async def create_cardholder(
    organization_id: UUID,
    params: CardholderCreate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CardholderRead:
    """Create a cardholder for an organization.

    Requires a Custom account with issuing_status=issuing_active.
    """
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await issuing_service.create_cardholder(session, account, params)


@router.patch(
    "/organizations/{organization_id}/cardholders/{cardholder_id}",
    response_model=CardholderRead,
)
async def update_cardholder(
    organization_id: UUID,
    cardholder_id: UUID,
    params: CardholderUpdate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CardholderRead:
    """Update a cardholder."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await issuing_service.update_cardholder(
        session, account, cardholder_id, params
    )


# ── Card endpoints ──


@router.get(
    "/organizations/{organization_id}/cards",
    response_model=list[IssuedCardRead],
)
async def list_cards(
    organization_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[IssuedCardRead]:
    """List all active cards for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await issuing_service.list_cards(session, account.id)


@router.get(
    "/organizations/{organization_id}/cards/{card_id}",
    response_model=IssuedCardRead,
)
async def get_card(
    organization_id: UUID,
    card_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> IssuedCardRead:
    """Get a specific card."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    result = await issuing_service.get_card(session, account.id, card_id)
    if result is None:
        raise ResourceNotFound("Card not found")
    return result


@router.post(
    "/organizations/{organization_id}/cards",
    response_model=IssuedCardRead,
    status_code=201,
)
async def create_card(
    organization_id: UUID,
    params: IssuedCardCreate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> IssuedCardRead:
    """Create an issued card for an organization.

    Requires a Custom account with issuing_status=issuing_active
    and an open Financial Account.
    """
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await issuing_service.create_card(session, account, params)


@router.patch(
    "/organizations/{organization_id}/cards/{card_id}",
    response_model=IssuedCardRead,
)
async def update_card(
    organization_id: UUID,
    card_id: UUID,
    params: IssuedCardUpdate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> IssuedCardRead:
    """Update a card (status, spending controls)."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await issuing_service.update_card(session, account, card_id, params)
