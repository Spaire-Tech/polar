from fastapi import Depends, Query

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models.manual_invoice_schedule import (
    ManualInvoiceSchedule,
    ManualInvoiceScheduleStatus,
)
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from . import auth
from .schedule_repository import ManualInvoiceScheduleRepository
from .schedule_schemas import (
    ManualInvoiceScheduleCreate,
    ManualInvoiceScheduleID,
    ManualInvoiceScheduleNotFound,
    ManualInvoiceScheduleRead,
    ManualInvoiceScheduleUpdate,
)
from .schedule_service import (
    ManualInvoiceScheduleError,
    manual_invoice_schedule_service,
)

router = APIRouter(
    prefix="/manual-invoice-schedules",
    tags=["manual-invoice-schedules", APITag.public],
)


@router.get(
    "/",
    summary="List Manual Invoice Schedules",
    response_model=ListResource[ManualInvoiceScheduleRead],
)
async def list(
    auth_subject: auth.ManualInvoicesRead,
    pagination: PaginationParamsQuery,
    organization_id: str | None = Query(None),
    status: ManualInvoiceScheduleStatus | None = Query(None),
    session: AsyncSession = Depends(get_db_read_session),
) -> ListResource[ManualInvoiceScheduleRead]:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    statement = repository.get_base_statement()

    if organization_id is not None:
        statement = statement.where(
            ManualInvoiceSchedule.organization_id == organization_id
        )
    if status is not None:
        statement = statement.where(ManualInvoiceSchedule.status == status)

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    return ListResource.from_paginated_results(
        [ManualInvoiceScheduleRead.model_validate(i) for i in items],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Manual Invoice Schedule",
    response_model=ManualInvoiceScheduleRead,
    responses={404: ManualInvoiceScheduleNotFound},
)
async def get(
    id: ManualInvoiceScheduleID,
    auth_subject: auth.ManualInvoicesRead,
    session: AsyncSession = Depends(get_db_read_session),
) -> ManualInvoiceScheduleRead:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)
    if schedule is None:
        raise ResourceNotFound()
    return ManualInvoiceScheduleRead.model_validate(schedule)


@router.post(
    "/",
    summary="Create Manual Invoice Schedule",
    response_model=ManualInvoiceScheduleRead,
    status_code=201,
)
async def create(
    body: ManualInvoiceScheduleCreate,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceScheduleRead:
    from polar.organization.service import organization as organization_service

    organization = await organization_service.get(session, body.organization_id)
    if organization is None:
        raise ResourceNotFound()

    items_data = [item.model_dump() for item in body.items] if body.items else None

    schedule = await manual_invoice_schedule_service.create(
        session,
        organization=organization,
        customer_id=body.customer_id,
        currency=body.currency,
        recurring_interval=body.recurring_interval,
        recurring_interval_count=body.recurring_interval_count,
        next_issue_date=body.next_issue_date,
        billing_name=body.billing_name,
        notes=body.notes,
        auto_issue=body.auto_issue,
        auto_send_email=body.auto_send_email,
        items=items_data,
    )
    return ManualInvoiceScheduleRead.model_validate(schedule)


@router.patch(
    "/{id}",
    summary="Update Manual Invoice Schedule",
    response_model=ManualInvoiceScheduleRead,
    responses={404: ManualInvoiceScheduleNotFound},
)
async def update(
    id: ManualInvoiceScheduleID,
    body: ManualInvoiceScheduleUpdate,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceScheduleRead:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)
    if schedule is None:
        raise ResourceNotFound()

    items_data = (
        [item.model_dump() for item in body.items] if body.items is not None else None
    )

    schedule = await manual_invoice_schedule_service.update(
        session,
        schedule,
        customer_id=body.customer_id,
        billing_name=body.billing_name,
        notes=body.notes,
        currency=body.currency,
        recurring_interval=body.recurring_interval,
        recurring_interval_count=body.recurring_interval_count,
        next_issue_date=body.next_issue_date,
        auto_issue=body.auto_issue,
        auto_send_email=body.auto_send_email,
        items=items_data,
        set_customer_id=body.customer_id is not None,
    )
    return ManualInvoiceScheduleRead.model_validate(schedule)


@router.post(
    "/{id}/pause",
    summary="Pause Manual Invoice Schedule",
    response_model=ManualInvoiceScheduleRead,
    responses={404: ManualInvoiceScheduleNotFound},
)
async def pause(
    id: ManualInvoiceScheduleID,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceScheduleRead:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)
    if schedule is None:
        raise ResourceNotFound()

    schedule = await manual_invoice_schedule_service.pause(session, schedule)
    return ManualInvoiceScheduleRead.model_validate(schedule)


@router.post(
    "/{id}/resume",
    summary="Resume Manual Invoice Schedule",
    response_model=ManualInvoiceScheduleRead,
    responses={404: ManualInvoiceScheduleNotFound},
)
async def resume(
    id: ManualInvoiceScheduleID,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceScheduleRead:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)
    if schedule is None:
        raise ResourceNotFound()

    schedule = await manual_invoice_schedule_service.resume(session, schedule)
    return ManualInvoiceScheduleRead.model_validate(schedule)


@router.post(
    "/{id}/cancel",
    summary="Cancel Manual Invoice Schedule",
    response_model=ManualInvoiceScheduleRead,
    responses={404: ManualInvoiceScheduleNotFound},
)
async def cancel(
    id: ManualInvoiceScheduleID,
    auth_subject: auth.ManualInvoicesWrite,
    session: AsyncSession = Depends(get_db_session),
) -> ManualInvoiceScheduleRead:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)
    if schedule is None:
        raise ResourceNotFound()

    schedule = await manual_invoice_schedule_service.cancel(session, schedule)
    return ManualInvoiceScheduleRead.model_validate(schedule)
