from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import ManualInvoice
from polar.models.manual_invoice import ManualInvoiceStatus
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .repository import ManualInvoiceRepository
from .schemas import (
    ManualInvoiceCreate,
    ManualInvoiceID,
    ManualInvoiceNotFound,
    ManualInvoiceRead,
    ManualInvoiceUpdate,
)
from .service import ManualInvoiceError, manual_invoice_service

router = APIRouter(
    prefix="/manual-invoices",
    tags=["manual-invoices", APITag.public],
)


@router.get(
    "/",
    summary="List Manual Invoices",
    response_model=ListResource[ManualInvoiceRead],
)
async def list(
    auth_subject: auth.ManualInvoicesRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: str | None = Query(None),
    status: ManualInvoiceStatus | None = Query(None),
    session: AsyncSession = Depends(get_db_read_session),
) -> ListResource[ManualInvoiceRead]:
    repository = ManualInvoiceRepository.from_session(session)
    statement = repository.get_base_statement()

    if organization_id is not None:
        statement = statement.where(
            ManualInvoice.organization_id == organization_id
        )
    if status is not None:
        statement = statement.where(ManualInvoice.status == status)

    statement = repository.apply_sorting(statement, sorting)
    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    return ListResource.from_paginated_results(
        [ManualInvoiceRead.model_validate(i) for i in items],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Manual Invoice",
    response_model=ManualInvoiceRead,
    responses={404: ManualInvoiceNotFound},
)
async def get(
    id: ManualInvoiceID,
    auth_subject: auth.ManualInvoicesRead,
    session: AsyncSession = Depends(get_db_read_session),
) -> ManualInvoiceRead:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)
    if manual_invoice is None:
        raise ResourceNotFound()
    return ManualInvoiceRead.model_validate(manual_invoice)


@router.post(
    "/",
    summary="Create Manual Invoice",
    response_model=ManualInvoiceRead,
    status_code=201,
)
async def create(
    body: ManualInvoiceCreate,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceRead:
    from polar.organization.service import organization as organization_service

    organization = await organization_service.get(
        session, auth_subject, body.organization_id
    )
    if organization is None:
        raise ResourceNotFound()

    items_data = [item.model_dump() for item in body.items] if body.items else None

    manual_invoice = await manual_invoice_service.create_draft(
        session,
        organization=organization,
        currency=body.currency,
        customer_id=body.customer_id,
        billing_name=body.billing_name,
        notes=body.notes,
        items=items_data,
    )
    return ManualInvoiceRead.model_validate(manual_invoice)


@router.patch(
    "/{id}",
    summary="Update Manual Invoice",
    response_model=ManualInvoiceRead,
    responses={404: ManualInvoiceNotFound},
)
async def update(
    id: ManualInvoiceID,
    body: ManualInvoiceUpdate,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceRead:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)
    if manual_invoice is None:
        raise ResourceNotFound()

    items_data = (
        [item.model_dump() for item in body.items] if body.items is not None else None
    )

    manual_invoice = await manual_invoice_service.update_draft(
        session,
        manual_invoice,
        customer_id=body.customer_id,
        billing_name=body.billing_name,
        notes=body.notes,
        currency=body.currency,
        items=items_data,
        set_customer_id=body.customer_id is not None,
    )
    return ManualInvoiceRead.model_validate(manual_invoice)


@router.post(
    "/{id}/issue",
    summary="Issue Manual Invoice",
    response_model=ManualInvoiceRead,
    responses={404: ManualInvoiceNotFound},
)
async def issue(
    id: ManualInvoiceID,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceRead:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)
    if manual_invoice is None:
        raise ResourceNotFound()

    manual_invoice = await manual_invoice_service.issue(session, manual_invoice)
    return ManualInvoiceRead.model_validate(manual_invoice)


@router.post(
    "/{id}/mark-paid",
    summary="Mark Manual Invoice as Paid",
    response_model=ManualInvoiceRead,
    responses={404: ManualInvoiceNotFound},
)
async def mark_paid(
    id: ManualInvoiceID,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceRead:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)
    if manual_invoice is None:
        raise ResourceNotFound()

    manual_invoice = await manual_invoice_service.mark_paid(session, manual_invoice)
    return ManualInvoiceRead.model_validate(manual_invoice)


@router.post(
    "/{id}/void",
    summary="Void Manual Invoice",
    response_model=ManualInvoiceRead,
    responses={404: ManualInvoiceNotFound},
)
async def void(
    id: ManualInvoiceID,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceRead:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)
    if manual_invoice is None:
        raise ResourceNotFound()

    manual_invoice = await manual_invoice_service.void(session, manual_invoice)
    return ManualInvoiceRead.model_validate(manual_invoice)


@router.post(
    "/{id}/generate-payment-link",
    summary="Generate Payment Link",
    response_model=ManualInvoiceRead,
    responses={404: ManualInvoiceNotFound},
)
async def generate_payment_link(
    id: ManualInvoiceID,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceRead:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)
    if manual_invoice is None:
        raise ResourceNotFound()

    manual_invoice = await manual_invoice_service.generate_payment_link(
        session, manual_invoice
    )
    return ManualInvoiceRead.model_validate(manual_invoice)


@router.post(
    "/{id}/send-email",
    summary="Send Invoice Email",
    response_model=ManualInvoiceRead,
    responses={404: ManualInvoiceNotFound},
)
async def send_email(
    id: ManualInvoiceID,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceRead:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)
    if manual_invoice is None:
        raise ResourceNotFound()

    manual_invoice = await manual_invoice_service.send_invoice_email(
        session, manual_invoice
    )
    return ManualInvoiceRead.model_validate(manual_invoice)


@router.delete(
    "/{id}",
    summary="Delete Manual Invoice",
    status_code=204,
    responses={404: ManualInvoiceNotFound},
)
async def delete(
    id: ManualInvoiceID,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)
    if manual_invoice is None:
        raise ResourceNotFound()

    await manual_invoice_service.delete_draft(session, manual_invoice)
