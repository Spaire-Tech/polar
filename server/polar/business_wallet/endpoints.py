from fastapi import Depends, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.openapi import APITag
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth as bw_auth
from .schemas import (
    FinancialAccount as FinancialAccountSchema,
    FinancialAccountCreate,
    IssuingCard as IssuingCardSchema,
    IssuingCardCreate,
    IssuingCardDetails,
    IssuingCardUpdate,
    OnboardingStatus,
    OutboundPaymentCreate,
    TreasuryTransaction as TreasuryTransactionSchema,
)
from .service import business_wallet_service

router = APIRouter(
    prefix="/business-wallets", tags=["business-wallets", APITag.private]
)


# -----------------------------------------------------------------------
# Financial Account
# -----------------------------------------------------------------------


@router.get(
    "/financial-account",
    response_model=FinancialAccountSchema,
)
async def get_financial_account(
    auth_subject: bw_auth.BusinessWalletRead,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> FinancialAccountSchema:
    """Get the financial account for an organization."""
    fa = await business_wallet_service.get_financial_account(
        session, auth_subject, organization_id
    )
    if fa is None:
        raise ResourceNotFound()
    return FinancialAccountSchema.model_validate(fa)


@router.post(
    "/financial-account",
    response_model=FinancialAccountSchema,
    status_code=201,
)
async def create_financial_account(
    auth_subject: bw_auth.BusinessWalletWrite,
    body: FinancialAccountCreate,
    session: AsyncSession = Depends(get_db_session),
) -> FinancialAccountSchema:
    """Create a new financial account for an organization."""
    org = await organization_service.get(session, body.organization_id)
    if org is None:
        raise ResourceNotFound()

    fa = await business_wallet_service.create_financial_account(
        session, auth_subject, organization=org
    )
    return FinancialAccountSchema.model_validate(fa)


@router.get(
    "/onboarding-status",
    response_model=OnboardingStatus,
)
async def get_onboarding_status(
    auth_subject: bw_auth.BusinessWalletRead,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> OnboardingStatus:
    """Get the onboarding status for an organization's business wallet."""
    result = await business_wallet_service.get_onboarding_status(
        session, auth_subject, organization_id
    )
    return OnboardingStatus.model_validate(result)


@router.post(
    "/onboarding-link",
    response_model=dict,
)
async def get_onboarding_link(
    auth_subject: bw_auth.BusinessWalletWrite,
    organization_id: UUID4,
    return_path: str = Query(
        ..., description="Frontend path to redirect to after onboarding."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get a Stripe onboarding link for the connected account."""
    org = await organization_service.get(session, organization_id)
    if org is None:
        raise ResourceNotFound()

    url = await business_wallet_service.get_onboarding_link(
        session, auth_subject, organization=org, return_path=return_path
    )
    return {"url": url}


# -----------------------------------------------------------------------
# Issuing Cards
# -----------------------------------------------------------------------


@router.get(
    "/cards",
    response_model=list[IssuingCardSchema],
)
async def list_cards(
    auth_subject: bw_auth.BusinessWalletRead,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> list[IssuingCardSchema]:
    """List all issuing cards for an organization."""
    cards = await business_wallet_service.list_cards(
        session, auth_subject, organization_id
    )
    return [IssuingCardSchema.model_validate(c) for c in cards]


@router.post(
    "/cards",
    response_model=IssuingCardSchema,
    status_code=201,
)
async def create_card(
    auth_subject: bw_auth.BusinessWalletWrite,
    body: IssuingCardCreate,
    session: AsyncSession = Depends(get_db_session),
) -> IssuingCardSchema:
    """Create a new issuing card."""
    from .repository import FinancialAccountRepository

    fa_repo = FinancialAccountRepository.from_session(session)
    fa = await fa_repo.get_by_id(body.financial_account_id)
    if fa is None:
        raise ResourceNotFound()

    org = await organization_service.get(session, fa.organization_id)
    if org is None:
        raise ResourceNotFound()

    card = await business_wallet_service.create_card(
        session,
        auth_subject,
        financial_account=fa,
        organization=org,
        cardholder_name=body.cardholder_name,
        card_type=body.card_type,
        card_color=body.card_color,
        spending_limit_amount=body.spending_limit_amount,
        spending_limit_interval=(
            body.spending_limit_interval.value
            if body.spending_limit_interval
            else None
        ),
    )
    return IssuingCardSchema.model_validate(card)


@router.get(
    "/cards/{card_id}",
    response_model=IssuingCardSchema,
)
async def get_card(
    card_id: UUID4,
    auth_subject: bw_auth.BusinessWalletRead,
    session: AsyncSession = Depends(get_db_session),
) -> IssuingCardSchema:
    """Get a specific issuing card."""
    card = await business_wallet_service.get_card(session, auth_subject, card_id)
    if card is None:
        raise ResourceNotFound()
    return IssuingCardSchema.model_validate(card)


@router.patch(
    "/cards/{card_id}",
    response_model=IssuingCardSchema,
)
async def update_card(
    card_id: UUID4,
    body: IssuingCardUpdate,
    auth_subject: bw_auth.BusinessWalletWrite,
    session: AsyncSession = Depends(get_db_session),
) -> IssuingCardSchema:
    """Update an issuing card (status, color, spending limits)."""
    card = await business_wallet_service.get_card(session, auth_subject, card_id)
    if card is None:
        raise ResourceNotFound()

    card = await business_wallet_service.update_card(
        session,
        auth_subject,
        card=card,
        status=body.status,
        card_color=body.card_color,
        spending_limit_amount=body.spending_limit_amount,
        spending_limit_interval=(
            body.spending_limit_interval.value
            if body.spending_limit_interval
            else None
        ),
    )
    return IssuingCardSchema.model_validate(card)


@router.get(
    "/cards/{card_id}/details",
    response_model=IssuingCardDetails,
)
async def get_card_details(
    card_id: UUID4,
    auth_subject: bw_auth.BusinessWalletRead,
    session: AsyncSession = Depends(get_db_session),
) -> IssuingCardDetails:
    """Get sensitive card details (full number, CVC). Use with care."""
    card = await business_wallet_service.get_card(session, auth_subject, card_id)
    if card is None:
        raise ResourceNotFound()

    details = await business_wallet_service.get_card_details(
        session, auth_subject, card
    )
    return IssuingCardDetails.model_validate(details)


# -----------------------------------------------------------------------
# Treasury Transactions
# -----------------------------------------------------------------------


@router.get(
    "/transactions",
    response_model=ListResource[TreasuryTransactionSchema],
)
async def list_transactions(
    auth_subject: bw_auth.BusinessWalletRead,
    financial_account_id: UUID4,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[TreasuryTransactionSchema]:
    """List treasury transactions for a financial account."""
    results, count = await business_wallet_service.list_transactions(
        session,
        auth_subject,
        financial_account_id,
        limit=pagination.limit,
        page=pagination.page,
    )
    return ListResource.from_paginated_results(
        [TreasuryTransactionSchema.model_validate(r) for r in results],
        count,
        pagination,
    )


@router.post(
    "/transactions/sync",
    status_code=200,
)
async def sync_transactions(
    auth_subject: bw_auth.BusinessWalletWrite,
    financial_account_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Sync transactions from Stripe for a financial account."""
    from .repository import FinancialAccountRepository

    fa_repo = FinancialAccountRepository.from_session(session)
    fa = await fa_repo.get_by_id(financial_account_id)
    if fa is None:
        raise ResourceNotFound()

    synced = await business_wallet_service.sync_transactions_from_stripe(session, fa)
    return {"synced": synced}


# -----------------------------------------------------------------------
# Outbound Payments
# -----------------------------------------------------------------------


@router.post(
    "/outbound-payments",
    response_model=TreasuryTransactionSchema,
    status_code=201,
)
async def create_outbound_payment(
    auth_subject: bw_auth.BusinessWalletWrite,
    body: OutboundPaymentCreate,
    session: AsyncSession = Depends(get_db_session),
) -> TreasuryTransactionSchema:
    """Create an outbound payment from the financial account."""
    from .repository import FinancialAccountRepository

    fa_repo = FinancialAccountRepository.from_session(session)
    fa = await fa_repo.get_by_id(body.financial_account_id)
    if fa is None:
        raise ResourceNotFound()

    tx = await business_wallet_service.create_outbound_payment(
        session,
        auth_subject,
        financial_account=fa,
        amount=body.amount,
        currency=body.currency,
        destination_account_number=body.destination_account_number,
        destination_routing_number=body.destination_routing_number,
        description=body.description,
        counterparty_name=body.counterparty_name,
    )
    return TreasuryTransactionSchema.model_validate(tx)
