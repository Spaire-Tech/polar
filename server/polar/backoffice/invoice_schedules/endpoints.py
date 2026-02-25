from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, ValidationError
from sqlalchemy.orm import joinedload
from tagflow import tag, text

from polar.enums import SubscriptionRecurringInterval
from polar.kit.currency import format_currency
from polar.kit.pagination import PaginationParamsQuery
from polar.manual_invoice.schedule_repository import ManualInvoiceScheduleRepository
from polar.manual_invoice.schedule_service import (
    ManualInvoiceScheduleError,
    manual_invoice_schedule_service,
)
from polar.models import Customer, Organization
from polar.models.manual_invoice_schedule import (
    ManualInvoiceSchedule,
    ManualInvoiceScheduleStatus,
)
from polar.models.manual_invoice_schedule_item import ManualInvoiceScheduleItem
from polar.postgres import AsyncSession, get_db_read_session, get_db_session

from .. import formatters
from ..components import button, datatable, description_list, input, modal
from ..layout import layout
from ..responses import HXRedirectResponse
from ..toast import add_toast
from .components import schedule_status_badge, schedules_datatable
from .forms import AddItemForm, ScheduleCreateForm, ScheduleEditForm

router = APIRouter()


# --- Description List Items ---


class StatusItem(description_list.DescriptionListItem[ManualInvoiceSchedule]):
    def __init__(self) -> None:
        super().__init__("Status")

    def render(self, request: Request, item: ManualInvoiceSchedule) -> Any:
        with schedule_status_badge(item.status):
            pass
        return None


class TotalAmountItem(description_list.DescriptionListItem[ManualInvoiceSchedule]):
    def __init__(self) -> None:
        super().__init__("Amount per Invoice")

    def render(self, request: Request, item: ManualInvoiceSchedule) -> Any:
        text(formatters.currency(item.total_amount, item.currency))
        return None


class IntervalItem(description_list.DescriptionListItem[ManualInvoiceSchedule]):
    def __init__(self) -> None:
        super().__init__("Recurrence")

    def render(self, request: Request, item: ManualInvoiceSchedule) -> Any:
        count = item.recurring_interval_count
        interval = item.recurring_interval
        if count == 1:
            text(f"Every {interval}")
        else:
            text(f"Every {count} {interval}s")
        return None


# --- List ---


@router.get("/", name="invoice_schedules:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    status: str | None = Query(None),
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    statement = (
        repository.get_base_statement()
        .join(Customer, ManualInvoiceSchedule.customer_id == Customer.id)
        .join(Organization, ManualInvoiceSchedule.organization_id == Organization.id)
    )

    if status:
        statement = statement.where(ManualInvoiceSchedule.status == status)

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [("Invoice Schedules", str(request.url_for("invoice_schedules:list")))],
        "invoice_schedules:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    text("Invoice Schedules")
                with button(
                    hx_get=str(request.url_for("invoice_schedules:create")),
                    hx_target="#modal",
                    variant="primary",
                ):
                    text("Create Schedule")

            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.select(
                    [
                        ("All Statuses", ""),
                        ("Active", ManualInvoiceScheduleStatus.active.value),
                        ("Paused", ManualInvoiceScheduleStatus.paused.value),
                        ("Canceled", ManualInvoiceScheduleStatus.canceled.value),
                    ],
                    status or "",
                    name="status",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")

            with schedules_datatable(request, items):
                pass
            with datatable.pagination(request, pagination, count):
                pass


# --- Detail ---


@router.get("/{id}", name="invoice_schedules:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(
        id,
        options=(
            joinedload(ManualInvoiceSchedule.customer),
            joinedload(ManualInvoiceSchedule.organization),
        ),
    )

    if schedule is None:
        raise HTTPException(status_code=404)

    with layout(
        request,
        [
            (f"{schedule.id}", str(request.url)),
            (
                "Invoice Schedules",
                str(request.url_for("invoice_schedules:list")),
            ),
        ],
        "invoice_schedules:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            # Header with title and action buttons
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    text("Invoice Schedule")

                with tag.div(classes="flex gap-2"):
                    if schedule.status == ManualInvoiceScheduleStatus.active:
                        with button(
                            hx_get=str(
                                request.url_for(
                                    "invoice_schedules:edit", id=schedule.id
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Edit")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "invoice_schedules:generate_now_action",
                                    id=schedule.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="primary"):
                                text("Generate Invoice Now")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "invoice_schedules:pause_action",
                                    id=schedule.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="warning", outline=True):
                                text("Pause")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "invoice_schedules:cancel_action",
                                    id=schedule.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="error", outline=True):
                                text("Cancel")

                    elif schedule.status == ManualInvoiceScheduleStatus.paused:
                        with button(
                            hx_get=str(
                                request.url_for(
                                    "invoice_schedules:edit", id=schedule.id
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Edit")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "invoice_schedules:resume_action",
                                    id=schedule.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="primary"):
                                text("Resume")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "invoice_schedules:cancel_action",
                                    id=schedule.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="error", outline=True):
                                text("Cancel")

            # Main detail grid
            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                # Schedule details card
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Schedule Details")
                        with description_list.DescriptionList[ManualInvoiceSchedule](
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "created_at", "Created"
                            ),
                            StatusItem(),
                            IntervalItem(),
                            description_list.DescriptionListAttrItem(
                                "currency", "Currency"
                            ),
                            TotalAmountItem(),
                            description_list.DescriptionListDateTimeItem(
                                "next_issue_date", "Next Issue Date"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "last_issued_at", "Last Issued"
                            ),
                            description_list.DescriptionListAttrItem(
                                "notes", "Notes"
                            ),
                        ).render(request, schedule):
                            pass

                # Automation card
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Automation")
                        with tag.div(classes="flex flex-col gap-2"):
                            with tag.div(classes="flex items-center gap-2"):
                                if schedule.auto_issue:
                                    with tag.div(classes="badge badge-success"):
                                        text("Auto-issue enabled")
                                else:
                                    with tag.div(classes="badge badge-ghost"):
                                        text("Manual issue")
                            with tag.div(classes="flex items-center gap-2"):
                                if schedule.auto_send_email:
                                    with tag.div(classes="badge badge-success"):
                                        text("Auto-email enabled")
                                else:
                                    with tag.div(classes="badge badge-ghost"):
                                        text("Manual email")

                # Customer card
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Customer")
                        with description_list.DescriptionList[ManualInvoiceSchedule](
                            description_list.DescriptionListAttrItem(
                                "customer.id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "customer.email", "Email", clipboard=True
                            ),
                            description_list.DescriptionListAttrItem(
                                "customer.name", "Name"
                            ),
                            description_list.DescriptionListAttrItem(
                                "billing_name", "Billing Name"
                            ),
                        ).render(request, schedule):
                            pass

                # Organization card
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Organization")
                        with description_list.DescriptionList[ManualInvoiceSchedule](
                            description_list.DescriptionListLinkItem[
                                ManualInvoiceSchedule
                            ](
                                "organization.name",
                                "Organization",
                                href_getter=lambda r, i: str(
                                    r.url_for(
                                        "organizations:get",
                                        id=i.organization_id,
                                    )
                                ),
                            ),
                        ).render(request, schedule):
                            pass

            # Line Items table
            with tag.div(classes="mt-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.div(classes="flex justify-between items-center"):
                            with tag.h2(classes="card-title"):
                                text("Line Items Template")
                            if schedule.status != ManualInvoiceScheduleStatus.canceled:
                                with button(
                                    hx_get=str(
                                        request.url_for(
                                            "invoice_schedules:add_item",
                                            id=schedule.id,
                                        )
                                    ),
                                    hx_target="#modal",
                                    size="sm",
                                ):
                                    text("Add Item")

                        if schedule.items:
                            with tag.div(classes="overflow-x-auto mt-4"):
                                with tag.table(classes="table w-full"):
                                    with tag.thead():
                                        with tag.tr():
                                            with tag.th():
                                                text("Description")
                                            with tag.th(classes="text-right"):
                                                text("Qty")
                                            with tag.th(classes="text-right"):
                                                text("Unit Price")
                                            with tag.th(classes="text-right"):
                                                text("Amount")
                                            if schedule.status != ManualInvoiceScheduleStatus.canceled:
                                                with tag.th(classes="text-right"):
                                                    text("Actions")
                                    with tag.tbody():
                                        for item in schedule.items:
                                            with tag.tr():
                                                with tag.td():
                                                    text(item.description)
                                                with tag.td(classes="text-right"):
                                                    text(str(item.quantity))
                                                with tag.td(classes="text-right"):
                                                    text(
                                                        formatters.currency(
                                                            item.unit_amount,
                                                            schedule.currency,
                                                        )
                                                    )
                                                with tag.td(classes="text-right"):
                                                    text(
                                                        formatters.currency(
                                                            item.amount,
                                                            schedule.currency,
                                                        )
                                                    )
                                                if schedule.status != ManualInvoiceScheduleStatus.canceled:
                                                    with tag.td(classes="text-right"):
                                                        with tag.form(
                                                            method="POST",
                                                            action=str(
                                                                request.url_for(
                                                                    "invoice_schedules:remove_item",
                                                                    id=schedule.id,
                                                                    item_id=item.id,
                                                                )
                                                            ),
                                                        ):
                                                            with button(
                                                                type="submit",
                                                                size="xs",
                                                                variant="error",
                                                                ghost=True,
                                                            ):
                                                                text("Remove")

                                    with tag.tfoot():
                                        with tag.tr(classes="border-t-2"):
                                            with tag.td(
                                                colspan="3",
                                                classes="text-right font-bold",
                                            ):
                                                text("Total")
                                            with tag.td(
                                                classes="text-right font-bold"
                                            ):
                                                text(
                                                    formatters.currency(
                                                        schedule.total_amount,
                                                        schedule.currency,
                                                    )
                                                )
                                            if schedule.status != ManualInvoiceScheduleStatus.canceled:
                                                with tag.td():
                                                    pass
                        else:
                            with tag.p(classes="text-gray-500 mt-4"):
                                text("No line items yet.")


# --- Create ---


@router.api_route(
    "/create", name="invoice_schedules:create", methods=["GET", "POST"]
)
async def create(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = ScheduleCreateForm.model_validate_form(data)

            from polar.organization.service import organization as organization_service

            organization = await organization_service.get_anonymous(
                session, form.organization_id
            )
            if organization is None:
                await add_toast(request, "Organization not found.", "error")
            else:
                next_issue_date = datetime.fromisoformat(form.next_issue_date)
                if next_issue_date.tzinfo is None:
                    next_issue_date = next_issue_date.replace(tzinfo=timezone.utc)

                schedule = await manual_invoice_schedule_service.create(
                    session,
                    organization=organization,
                    customer_id=form.customer_id,
                    currency=form.currency,
                    recurring_interval=SubscriptionRecurringInterval(
                        form.recurring_interval
                    ),
                    recurring_interval_count=form.recurring_interval_count,
                    next_issue_date=next_issue_date,
                    billing_name=form.billing_name,
                    notes=form.notes,
                    auto_issue=bool(form.auto_issue),
                    auto_send_email=bool(form.auto_send_email),
                )
                await add_toast(request, "Schedule created.", "success")
                return HXRedirectResponse(
                    request,
                    str(
                        request.url_for(
                            "invoice_schedules:get", id=schedule.id
                        )
                    ),
                    303,
                )
        except ValidationError as e:
            validation_error = e
        except ValueError as e:
            await add_toast(request, f"Invalid date format: {e}", "error")

    with modal("Create Invoice Schedule", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with ScheduleCreateForm.render(
                hx_post=str(request.url_for("invoice_schedules:create")),
                hx_target="#modal",
                classes="flex flex-col",
                validation_error=validation_error,
            ):
                with tag.div(classes="modal-action"):
                    with tag.form(method="dialog"):
                        with button(ghost=True):
                            text("Cancel")
                    with button(type="submit", variant="primary"):
                        text("Create")


# --- Edit ---


@router.api_route(
    "/{id}/edit", name="invoice_schedules:edit", methods=["GET", "POST"]
)
async def edit(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)

    if schedule is None:
        raise HTTPException(status_code=404)

    if schedule.status == ManualInvoiceScheduleStatus.canceled:
        await add_toast(request, "Canceled schedules cannot be edited.", "error")
        return HXRedirectResponse(
            request, str(request.url_for("invoice_schedules:get", id=id)), 303
        )

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = ScheduleEditForm.model_validate_form(data)

            next_issue_date = datetime.fromisoformat(form.next_issue_date)
            if next_issue_date.tzinfo is None:
                next_issue_date = next_issue_date.replace(tzinfo=timezone.utc)

            schedule = await manual_invoice_schedule_service.update(
                session,
                schedule,
                customer_id=form.customer_id,
                billing_name=form.billing_name,
                notes=form.notes,
                currency=form.currency,
                recurring_interval=SubscriptionRecurringInterval(
                    form.recurring_interval
                ),
                recurring_interval_count=form.recurring_interval_count,
                next_issue_date=next_issue_date,
                auto_issue=bool(form.auto_issue),
                auto_send_email=bool(form.auto_send_email),
                set_customer_id=True,
            )
            await add_toast(request, "Schedule updated.", "success")
            return HXRedirectResponse(
                request,
                str(request.url_for("invoice_schedules:get", id=id)),
                303,
            )
        except ValidationError as e:
            validation_error = e
        except ManualInvoiceScheduleError as e:
            await add_toast(request, str(e), "error")
        except ValueError as e:
            await add_toast(request, f"Invalid date format: {e}", "error")

    with modal("Edit Invoice Schedule", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with ScheduleEditForm.render(
                data=schedule,
                hx_post=str(
                    request.url_for("invoice_schedules:edit", id=id)
                ),
                hx_target="#modal",
                classes="flex flex-col",
                validation_error=validation_error,
            ):
                with tag.div(classes="modal-action"):
                    with tag.form(method="dialog"):
                        with button(ghost=True):
                            text("Cancel")
                    with button(type="submit", variant="primary"):
                        text("Save")


# --- Add Item ---


@router.api_route(
    "/{id}/add-item", name="invoice_schedules:add_item", methods=["GET", "POST"]
)
async def add_item(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)

    if schedule is None:
        raise HTTPException(status_code=404)

    if schedule.status == ManualInvoiceScheduleStatus.canceled:
        await add_toast(
            request, "Canceled schedules cannot have items added.", "error"
        )
        return HXRedirectResponse(
            request, str(request.url_for("invoice_schedules:get", id=id)), 303
        )

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = AddItemForm.model_validate_form(data)
            unit_amount_cents = int(form.unit_amount * 100)
            schedule.items.append(
                ManualInvoiceScheduleItem(
                    description=form.description,
                    quantity=form.quantity,
                    unit_amount=unit_amount_cents,
                )
            )
            await session.flush()
            await add_toast(request, "Item added.", "success")
            return HXRedirectResponse(
                request,
                str(request.url_for("invoice_schedules:get", id=id)),
                303,
            )
        except ValidationError as e:
            validation_error = e

    with modal("Add Line Item", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with AddItemForm.render(
                hx_post=str(
                    request.url_for("invoice_schedules:add_item", id=id)
                ),
                hx_target="#modal",
                classes="flex flex-col",
                validation_error=validation_error,
            ):
                with tag.div(classes="modal-action"):
                    with tag.form(method="dialog"):
                        with button(ghost=True):
                            text("Cancel")
                    with button(type="submit", variant="primary"):
                        text("Add")


# --- Remove Item ---


@router.post("/{id}/remove-item/{item_id}", name="invoice_schedules:remove_item")
async def remove_item(
    request: Request,
    id: UUID4,
    item_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)

    if schedule is None:
        raise HTTPException(status_code=404)

    for item in schedule.items:
        if item.id == item_id:
            schedule.items.remove(item)
            await session.flush()
            await add_toast(request, "Item removed.", "success")
            break
    else:
        await add_toast(request, "Item not found.", "error")

    return HXRedirectResponse(
        request, str(request.url_for("invoice_schedules:get", id=id)), 303
    )


# --- Generate Now ---


@router.post(
    "/{id}/generate-now", name="invoice_schedules:generate_now_action"
)
async def generate_now_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)

    if schedule is None:
        raise HTTPException(status_code=404)

    try:
        invoice = await manual_invoice_schedule_service.generate_invoice_from_schedule(
            session, schedule
        )
        await add_toast(request, "Invoice generated from schedule.", "success")
        return HXRedirectResponse(
            request,
            str(request.url_for("manual_invoices:get", id=invoice.id)),
            303,
        )
    except ManualInvoiceScheduleError as e:
        await add_toast(request, str(e), "error")

    return HXRedirectResponse(
        request, str(request.url_for("invoice_schedules:get", id=id)), 303
    )


# --- Pause ---


@router.post("/{id}/pause", name="invoice_schedules:pause_action")
async def pause_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)

    if schedule is None:
        raise HTTPException(status_code=404)

    try:
        await manual_invoice_schedule_service.pause(session, schedule)
        await add_toast(request, "Schedule paused.", "success")
    except ManualInvoiceScheduleError as e:
        await add_toast(request, str(e), "error")

    return HXRedirectResponse(
        request, str(request.url_for("invoice_schedules:get", id=id)), 303
    )


# --- Resume ---


@router.post("/{id}/resume", name="invoice_schedules:resume_action")
async def resume_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)

    if schedule is None:
        raise HTTPException(status_code=404)

    try:
        await manual_invoice_schedule_service.resume(session, schedule)
        await add_toast(request, "Schedule resumed.", "success")
    except ManualInvoiceScheduleError as e:
        await add_toast(request, str(e), "error")

    return HXRedirectResponse(
        request, str(request.url_for("invoice_schedules:get", id=id)), 303
    )


# --- Cancel ---


@router.post("/{id}/cancel", name="invoice_schedules:cancel_action")
async def cancel_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceScheduleRepository.from_session(session)
    schedule = await repository.get_by_id(id)

    if schedule is None:
        raise HTTPException(status_code=404)

    try:
        await manual_invoice_schedule_service.cancel(session, schedule)
        await add_toast(request, "Schedule canceled.", "success")
    except ManualInvoiceScheduleError as e:
        await add_toast(request, str(e), "error")

    return HXRedirectResponse(
        request, str(request.url_for("invoice_schedules:get", id=id)), 303
    )
