"""Money movement API endpoints — recipients, outbound payments, outbound transfers."""

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
    OutboundPaymentCreate,
    OutboundPaymentRead,
    OutboundTransferCreate,
    OutboundTransferRead,
    RecipientCreate,
    RecipientRead,
    RecipientUpdate,
)
from .service import money_movement_service

router = APIRouter(
    prefix="/money-movement",
    tags=["money-movement", APITag.private],
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


# ── Recipient endpoints ──


@router.get(
    "/organizations/{organization_id}/recipients",
    response_model=list[RecipientRead],
)
async def list_recipients(
    organization_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[RecipientRead]:
    """List all payment recipients for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await money_movement_service.list_recipients(session, account.id)


@router.get(
    "/organizations/{organization_id}/recipients/{recipient_id}",
    response_model=RecipientRead,
)
async def get_recipient(
    organization_id: UUID,
    recipient_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> RecipientRead:
    """Get a specific payment recipient."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    result = await money_movement_service.get_recipient(
        session, account.id, recipient_id
    )
    if result is None:
        raise ResourceNotFound("Recipient not found")
    return result


@router.post(
    "/organizations/{organization_id}/recipients",
    response_model=RecipientRead,
    status_code=201,
)
async def create_recipient(
    organization_id: UUID,
    params: RecipientCreate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> RecipientRead:
    """Create a payment recipient for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await money_movement_service.create_recipient(
        session, account, params
    )


@router.patch(
    "/organizations/{organization_id}/recipients/{recipient_id}",
    response_model=RecipientRead,
)
async def update_recipient(
    organization_id: UUID,
    recipient_id: UUID,
    params: RecipientUpdate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> RecipientRead:
    """Update a payment recipient."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await money_movement_service.update_recipient(
        session, account, recipient_id, params
    )


@router.delete(
    "/organizations/{organization_id}/recipients/{recipient_id}",
    status_code=204,
)
async def delete_recipient(
    organization_id: UUID,
    recipient_id: UUID,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a payment recipient."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    await money_movement_service.delete_recipient(
        session, account, recipient_id
    )


# ── Outbound Payment endpoints ──


@router.get(
    "/organizations/{organization_id}/outbound-payments",
    response_model=list[OutboundPaymentRead],
)
async def list_outbound_payments(
    organization_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[OutboundPaymentRead]:
    """List all outbound payments for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await money_movement_service.list_outbound_payments(
        session, account.id
    )


@router.get(
    "/organizations/{organization_id}/outbound-payments/{payment_id}",
    response_model=OutboundPaymentRead,
)
async def get_outbound_payment(
    organization_id: UUID,
    payment_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OutboundPaymentRead:
    """Get a specific outbound payment."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    result = await money_movement_service.get_outbound_payment(
        session, account.id, payment_id
    )
    if result is None:
        raise ResourceNotFound("Outbound payment not found")
    return result


@router.post(
    "/organizations/{organization_id}/outbound-payments",
    response_model=OutboundPaymentRead,
    status_code=201,
)
async def create_outbound_payment(
    organization_id: UUID,
    params: OutboundPaymentCreate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> OutboundPaymentRead:
    """Send an outbound payment (ACH/wire) to a recipient.

    Pre-checks spendable balance before sending.
    """
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await money_movement_service.create_outbound_payment(
        session, account, params
    )


@router.post(
    "/organizations/{organization_id}/outbound-payments/{payment_id}/cancel",
    response_model=OutboundPaymentRead,
)
async def cancel_outbound_payment(
    organization_id: UUID,
    payment_id: UUID,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> OutboundPaymentRead:
    """Cancel a processing outbound payment."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await money_movement_service.cancel_outbound_payment(
        session, account, payment_id
    )


# ── Outbound Transfer endpoints ──


@router.get(
    "/organizations/{organization_id}/outbound-transfers",
    response_model=list[OutboundTransferRead],
)
async def list_outbound_transfers(
    organization_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[OutboundTransferRead]:
    """List all outbound transfers for an organization."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await money_movement_service.list_outbound_transfers(
        session, account.id
    )


@router.get(
    "/organizations/{organization_id}/outbound-transfers/{transfer_id}",
    response_model=OutboundTransferRead,
)
async def get_outbound_transfer(
    organization_id: UUID,
    transfer_id: UUID,
    auth_subject: WebUserRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OutboundTransferRead:
    """Get a specific outbound transfer."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    result = await money_movement_service.get_outbound_transfer(
        session, account.id, transfer_id
    )
    if result is None:
        raise ResourceNotFound("Outbound transfer not found")
    return result


@router.post(
    "/organizations/{organization_id}/outbound-transfers",
    response_model=OutboundTransferRead,
    status_code=201,
)
async def create_outbound_transfer(
    organization_id: UUID,
    params: OutboundTransferCreate,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> OutboundTransferRead:
    """Transfer funds from Financial Account to merchant's own bank.

    Pre-checks spendable balance before sending.
    """
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await money_movement_service.create_outbound_transfer(
        session, account, params
    )


@router.post(
    "/organizations/{organization_id}/outbound-transfers/{transfer_id}/cancel",
    response_model=OutboundTransferRead,
)
async def cancel_outbound_transfer(
    organization_id: UUID,
    transfer_id: UUID,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> OutboundTransferRead:
    """Cancel a processing outbound transfer."""
    account = await _get_account_for_org(session, auth_subject, organization_id)
    return await money_movement_service.cancel_outbound_transfer(
        session, account, transfer_id
    )
