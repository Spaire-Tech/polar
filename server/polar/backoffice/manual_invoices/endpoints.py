from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, BeforeValidator, ValidationError
from sqlalchemy.orm import contains_eager, joinedload
from tagflow import classes, tag, text

from polar.kit.currency import format_currency
from polar.kit.pagination import PaginationParamsQuery
from polar.kit.schemas import empty_str_to_none
from polar.manual_invoice import sorting
from polar.manual_invoice.repository import ManualInvoiceRepository
from polar.manual_invoice.service import ManualInvoiceError, manual_invoice_service
from polar.models import Customer, ManualInvoice, Organization
from polar.models.manual_invoice import ManualInvoiceStatus
from polar.models.manual_invoice_item import ManualInvoiceItem
from polar.postgres import AsyncSession, get_db_read_session, get_db_session

from .. import formatters
from ..components import button, datatable, description_list, input, modal
from ..layout import layout
from ..responses import HXRedirectResponse
from ..toast import add_toast
from .components import manual_invoice_status_badge, manual_invoices_datatable
from .forms import AddItemForm, ManualInvoiceCreateForm, ManualInvoiceEditForm

router = APIRouter()


# --- Description List Items ---


class StatusDescriptionListItem(description_list.DescriptionListItem[ManualInvoice]):
    def __init__(self, label: str) -> None:
        super().__init__(label)

    def render(
        self, request: Request, item: ManualInvoice
    ) -> Any:
        with manual_invoice_status_badge(item.status):
            pass
        return None


class TotalAmountItem(description_list.DescriptionListItem[ManualInvoice]):
    def __init__(self) -> None:
        super().__init__("Total Amount")

    def render(
        self, request: Request, item: ManualInvoice
    ) -> Any:
        text(formatters.currency(item.total_amount, item.currency))
        return None


# --- List ---


@router.get("/", name="manual_invoices:list")
async def list(
    request: Request,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    query: str | None = Query(None),
    status: Annotated[
        ManualInvoiceStatus | None, BeforeValidator(empty_str_to_none), Query()
    ] = None,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = ManualInvoiceRepository.from_session(session)
    statement = (
        repository.get_base_statement()
        .join(
            Customer, ManualInvoice.customer_id == Customer.id, isouter=True
        )
        .join(Organization, ManualInvoice.organization_id == Organization.id)
        .options(
            contains_eager(ManualInvoice.customer),
            contains_eager(ManualInvoice.organization),
        )
    )

    if query is not None:
        from sqlalchemy import or_
        import uuid as uuid_mod

        try:
            parsed_uuid = uuid_mod.UUID(query)
            statement = statement.where(
                or_(
                    ManualInvoice.id == parsed_uuid,
                    ManualInvoice.customer_id == parsed_uuid,
                    ManualInvoice.organization_id == parsed_uuid,
                )
            )
        except ValueError:
            statement = statement.where(
                or_(
                    ManualInvoice.invoice_number.ilike(f"%{query}%"),
                    ManualInvoice.billing_name.ilike(f"%{query}%"),
                    Customer.email.ilike(f"%{query}%"),
                    Organization.slug.ilike(f"%{query}%"),
                )
            )

    if status is not None:
        statement = statement.where(ManualInvoice.status == status)

    statement = repository.apply_sorting(statement, sorting)

    items, count = await repository.paginate(
        statement, limit=pagination.limit, page=pagination.page
    )

    with layout(
        request,
        [("Manual Invoices", str(request.url_for("manual_invoices:list")))],
        "manual_invoices:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    text("Manual Invoices")
                with button(
                    hx_get=str(request.url_for("manual_invoices:create")),
                    hx_target="#modal",
                    variant="primary",
                ):
                    text("Create Draft")

            with tag.form(method="GET", classes="w-full flex flex-row gap-2"):
                with input.search(
                    "query",
                    query,
                    placeholder="Search by invoice #, customer, organization...",
                ):
                    pass
                with input.select(
                    [
                        ("All Statuses", ""),
                        ("Draft", ManualInvoiceStatus.draft.value),
                        ("Issued", ManualInvoiceStatus.issued.value),
                        ("Paid", ManualInvoiceStatus.paid.value),
                        ("Voided", ManualInvoiceStatus.voided.value),
                    ],
                    status.value if status else "",
                    name="status",
                ):
                    pass
                with button(type="submit"):
                    text("Filter")

            with manual_invoices_datatable(request, items, sorting=sorting):
                pass
            with datatable.pagination(request, pagination, count):
                pass


# --- Detail ---


@router.get("/{id}", name="manual_invoices:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_read_session),
) -> None:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(
        id,
        options=(
            joinedload(ManualInvoice.customer),
            joinedload(ManualInvoice.organization),
            joinedload(ManualInvoice.order),
        ),
    )

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    with layout(
        request,
        [
            (f"{manual_invoice.id}", str(request.url)),
            ("Manual Invoices", str(request.url_for("manual_invoices:list"))),
        ],
        "manual_invoices:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            # Header with title and action buttons
            with tag.div(classes="flex justify-between items-center"):
                with tag.h1(classes="text-4xl"):
                    if manual_invoice.invoice_number:
                        text(f"Invoice {manual_invoice.invoice_number}")
                    else:
                        text("Draft Invoice")

                with tag.div(classes="flex gap-2"):
                    if manual_invoice.status == ManualInvoiceStatus.draft:
                        with button(
                            hx_get=str(
                                request.url_for(
                                    "manual_invoices:edit", id=manual_invoice.id
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Edit")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "manual_invoices:issue_action",
                                    id=manual_invoice.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="primary"):
                                text("Issue")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "manual_invoices:void_action",
                                    id=manual_invoice.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="error", outline=True):
                                text("Void")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "manual_invoices:delete_action",
                                    id=manual_invoice.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="error"):
                                text("Delete")

                    elif manual_invoice.status == ManualInvoiceStatus.issued:
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "manual_invoices:generate_payment_link_action",
                                    id=manual_invoice.id,
                                )
                            ),
                        ):
                            with button(type="submit"):
                                if manual_invoice.checkout_url:
                                    text("Regenerate Payment Link")
                                else:
                                    text("Generate Payment Link")
                        if manual_invoice.customer_id is not None:
                            with tag.form(
                                method="POST",
                                action=str(
                                    request.url_for(
                                        "manual_invoices:send_email_action",
                                        id=manual_invoice.id,
                                    )
                                ),
                            ):
                                with button(type="submit"):
                                    text("Send Email")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "manual_invoices:mark_paid_action",
                                    id=manual_invoice.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="primary"):
                                text("Mark Paid")
                        with tag.form(
                            method="POST",
                            action=str(
                                request.url_for(
                                    "manual_invoices:void_action",
                                    id=manual_invoice.id,
                                )
                            ),
                        ):
                            with button(type="submit", variant="error", outline=True):
                                text("Void")

            # Main detail grid
            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                # Invoice details card
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Invoice Details")
                        with description_list.DescriptionList[ManualInvoice](
                            description_list.DescriptionListAttrItem(
                                "id", "ID", clipboard=True
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "created_at", "Created"
                            ),
                            StatusDescriptionListItem("Status"),
                            description_list.DescriptionListAttrItem(
                                "invoice_number", "Invoice Number"
                            ),
                            description_list.DescriptionListAttrItem(
                                "currency", "Currency"
                            ),
                            TotalAmountItem(),
                            description_list.DescriptionListAttrItem(
                                "notes", "Notes"
                            ),
                        ).render(request, manual_invoice):
                            pass

                # Customer card
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Customer")
                        if manual_invoice.customer is not None:
                            with description_list.DescriptionList[ManualInvoice](
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
                            ).render(request, manual_invoice):
                                pass
                        else:
                            with tag.p(classes="text-gray-500"):
                                text("No customer assigned")

                # Organization card
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Organization")
                        with description_list.DescriptionList[ManualInvoice](
                            description_list.DescriptionListLinkItem[ManualInvoice](
                                "organization.name",
                                "Organization",
                                href_getter=lambda r, i: str(
                                    r.url_for(
                                        "organizations:get",
                                        id=i.organization_id,
                                    )
                                ),
                            ),
                        ).render(request, manual_invoice):
                            pass

                # Linked Order card
                if manual_invoice.order_id is not None:
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Linked Order")
                            with description_list.DescriptionList[ManualInvoice](
                                description_list.DescriptionListLinkItem[
                                    ManualInvoice
                                ](
                                    "order_id",
                                    "Order",
                                    href_getter=lambda r, i: str(
                                        r.url_for("orders:get", id=i.order_id)
                                    ),
                                ),
                            ).render(request, manual_invoice):
                                pass

                # Recurring Schedule card
                if manual_invoice.schedule_id is not None:
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Recurring Schedule")
                            with description_list.DescriptionList[ManualInvoice](
                                description_list.DescriptionListLinkItem[
                                    ManualInvoice
                                ](
                                    "schedule_id",
                                    "Schedule",
                                    href_getter=lambda r, i: str(
                                        r.url_for(
                                            "invoice_schedules:get",
                                            id=i.schedule_id,
                                        )
                                    ),
                                ),
                            ).render(request, manual_invoice):
                                pass

                # Payment Link card
                if manual_invoice.checkout_url:
                    with tag.div(classes="card card-border w-full shadow-sm"):
                        with tag.div(classes="card-body"):
                            with tag.h2(classes="card-title"):
                                text("Payment Link")
                            with tag.div(classes="flex flex-col gap-2"):
                                with tag.div(
                                    classes="flex items-center gap-2 bg-base-200 rounded-lg p-3"
                                ):
                                    with tag.code(
                                        classes="text-sm break-all flex-1"
                                    ):
                                        text(manual_invoice.checkout_url)
                                with tag.a(
                                    href=manual_invoice.checkout_url,
                                    target="_blank",
                                    rel="noopener noreferrer",
                                    classes="link link-primary text-sm",
                                ):
                                    text("Open payment page")
                                if manual_invoice.email_sent_at:
                                    with tag.p(classes="text-sm text-gray-500"):
                                        text(
                                            f"Last email sent: {formatters.datetime(manual_invoice.email_sent_at)}"
                                        )

            # Timestamps card
            with tag.div(classes="mt-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.h2(classes="card-title"):
                            text("Timestamps")
                        with description_list.DescriptionList[ManualInvoice](
                            description_list.DescriptionListDateTimeItem(
                                "issued_at", "Issued At"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "paid_at", "Paid At"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "voided_at", "Voided At"
                            ),
                            description_list.DescriptionListDateTimeItem(
                                "due_date", "Due Date"
                            ),
                        ).render(request, manual_invoice):
                            pass

            # Line Items table
            with tag.div(classes="mt-4"):
                with tag.div(classes="card card-border w-full shadow-sm"):
                    with tag.div(classes="card-body"):
                        with tag.div(classes="flex justify-between items-center"):
                            with tag.h2(classes="card-title"):
                                text("Line Items")
                            if manual_invoice.status == ManualInvoiceStatus.draft:
                                with button(
                                    hx_get=str(
                                        request.url_for(
                                            "manual_invoices:add_item",
                                            id=manual_invoice.id,
                                        )
                                    ),
                                    hx_target="#modal",
                                    size="sm",
                                ):
                                    text("Add Item")

                        if manual_invoice.items:
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
                                            if (
                                                manual_invoice.status
                                                == ManualInvoiceStatus.draft
                                            ):
                                                with tag.th(classes="text-right"):
                                                    text("Actions")
                                    with tag.tbody():
                                        for item in manual_invoice.items:
                                            with tag.tr():
                                                with tag.td():
                                                    text(item.description)
                                                with tag.td(classes="text-right"):
                                                    text(str(item.quantity))
                                                with tag.td(classes="text-right"):
                                                    text(
                                                        formatters.currency(
                                                            item.unit_amount,
                                                            manual_invoice.currency,
                                                        )
                                                    )
                                                with tag.td(classes="text-right"):
                                                    text(
                                                        formatters.currency(
                                                            item.amount,
                                                            manual_invoice.currency,
                                                        )
                                                    )
                                                if (
                                                    manual_invoice.status
                                                    == ManualInvoiceStatus.draft
                                                ):
                                                    with tag.td(classes="text-right"):
                                                        with tag.form(
                                                            method="POST",
                                                            action=str(
                                                                request.url_for(
                                                                    "manual_invoices:remove_item",
                                                                    id=manual_invoice.id,
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

                                    # Total row
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
                                                        manual_invoice.total_amount,
                                                        manual_invoice.currency,
                                                    )
                                                )
                                            if (
                                                manual_invoice.status
                                                == ManualInvoiceStatus.draft
                                            ):
                                                with tag.td():
                                                    pass
                        else:
                            with tag.p(classes="text-gray-500 mt-4"):
                                text("No line items yet.")


# --- Create ---


@router.api_route("/create", name="manual_invoices:create", methods=["GET", "POST"])
async def create(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = ManualInvoiceCreateForm.model_validate_form(data)

            # Look up the organization
            from polar.organization.service import organization as organization_service

            organization = await organization_service.get(
                session, form.organization_id
            )
            if organization is None:
                await add_toast(request, "Organization not found.", "error")
            else:
                manual_invoice = await manual_invoice_service.create_draft(
                    session,
                    organization=organization,
                    currency=form.currency,
                    customer_id=form.customer_id,
                    billing_name=form.billing_name,
                    notes=form.notes,
                )
                await add_toast(request, "Draft invoice created.", "success")
                return HXRedirectResponse(
                    request,
                    str(
                        request.url_for(
                            "manual_invoices:get", id=manual_invoice.id
                        )
                    ),
                    303,
                )
        except ValidationError as e:
            validation_error = e

    with modal("Create Draft Invoice", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with ManualInvoiceCreateForm.render(
                hx_post=str(request.url_for("manual_invoices:create")),
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
    "/{id}/edit", name="manual_invoices:edit", methods=["GET", "POST"]
)
async def edit(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    if manual_invoice.status != ManualInvoiceStatus.draft:
        await add_toast(request, "Only draft invoices can be edited.", "error")
        return HXRedirectResponse(
            request, str(request.url_for("manual_invoices:get", id=id)), 303
        )

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = ManualInvoiceEditForm.model_validate_form(data)
            manual_invoice = await manual_invoice_service.update_draft(
                session,
                manual_invoice,
                customer_id=form.customer_id,
                billing_name=form.billing_name,
                notes=form.notes,
                currency=form.currency,
                set_customer_id=True,
            )
            await add_toast(request, "Invoice updated.", "success")
            return HXRedirectResponse(
                request, str(request.url_for("manual_invoices:get", id=id)), 303
            )
        except ValidationError as e:
            validation_error = e
        except ManualInvoiceError as e:
            await add_toast(request, str(e), "error")

    with modal("Edit Draft Invoice", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with ManualInvoiceEditForm.render(
                data=manual_invoice,
                hx_post=str(request.url_for("manual_invoices:edit", id=id)),
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
    "/{id}/add-item", name="manual_invoices:add_item", methods=["GET", "POST"]
)
async def add_item(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    if manual_invoice.status != ManualInvoiceStatus.draft:
        await add_toast(request, "Only draft invoices can have items added.", "error")
        return HXRedirectResponse(
            request, str(request.url_for("manual_invoices:get", id=id)), 303
        )

    validation_error: ValidationError | None = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = AddItemForm.model_validate_form(data)
            unit_amount_cents = int(form.unit_amount * 100)
            manual_invoice.items.append(
                ManualInvoiceItem(
                    description=form.description,
                    quantity=form.quantity,
                    unit_amount=unit_amount_cents,
                )
            )
            await session.flush()
            await add_toast(request, "Item added.", "success")
            return HXRedirectResponse(
                request, str(request.url_for("manual_invoices:get", id=id)), 303
            )
        except ValidationError as e:
            validation_error = e

    with modal("Add Line Item", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with AddItemForm.render(
                hx_post=str(request.url_for("manual_invoices:add_item", id=id)),
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


@router.post("/{id}/remove-item/{item_id}", name="manual_invoices:remove_item")
async def remove_item(
    request: Request,
    id: UUID4,
    item_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    if manual_invoice.status != ManualInvoiceStatus.draft:
        await add_toast(request, "Only draft invoices can have items removed.", "error")
        return HXRedirectResponse(
            request, str(request.url_for("manual_invoices:get", id=id)), 303
        )

    # Find and remove the item
    for item in manual_invoice.items:
        if item.id == item_id:
            manual_invoice.items.remove(item)
            await session.flush()
            await add_toast(request, "Item removed.", "success")
            break
    else:
        await add_toast(request, "Item not found.", "error")

    return HXRedirectResponse(
        request, str(request.url_for("manual_invoices:get", id=id)), 303
    )


# --- Generate Payment Link ---


@router.post(
    "/{id}/generate-payment-link",
    name="manual_invoices:generate_payment_link_action",
)
async def generate_payment_link_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    try:
        manual_invoice = await manual_invoice_service.generate_payment_link(
            session, manual_invoice
        )
        await add_toast(request, "Payment link generated.", "success")
    except ManualInvoiceError as e:
        await add_toast(request, str(e), "error")

    return HXRedirectResponse(
        request, str(request.url_for("manual_invoices:get", id=id)), 303
    )


# --- Send Email ---


@router.post("/{id}/send-email", name="manual_invoices:send_email_action")
async def send_email_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    try:
        manual_invoice = await manual_invoice_service.send_invoice_email(
            session, manual_invoice
        )
        await add_toast(request, "Invoice email sent.", "success")
    except ManualInvoiceError as e:
        await add_toast(request, str(e), "error")

    return HXRedirectResponse(
        request, str(request.url_for("manual_invoices:get", id=id)), 303
    )


# --- Issue ---


@router.post("/{id}/issue", name="manual_invoices:issue_action")
async def issue_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    try:
        manual_invoice = await manual_invoice_service.issue(session, manual_invoice)
        await add_toast(request, "Invoice issued successfully.", "success")
    except ManualInvoiceError as e:
        await add_toast(request, str(e), "error")

    return HXRedirectResponse(
        request, str(request.url_for("manual_invoices:get", id=id)), 303
    )


# --- Mark Paid ---


@router.post("/{id}/mark-paid", name="manual_invoices:mark_paid_action")
async def mark_paid_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    try:
        manual_invoice = await manual_invoice_service.mark_paid(
            session, manual_invoice
        )
        await add_toast(request, "Invoice marked as paid.", "success")
    except ManualInvoiceError as e:
        await add_toast(request, str(e), "error")

    return HXRedirectResponse(
        request, str(request.url_for("manual_invoices:get", id=id)), 303
    )


# --- Void ---


@router.post("/{id}/void", name="manual_invoices:void_action")
async def void_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    try:
        manual_invoice = await manual_invoice_service.void(session, manual_invoice)
        await add_toast(request, "Invoice voided.", "success")
    except ManualInvoiceError as e:
        await add_toast(request, str(e), "error")

    return HXRedirectResponse(
        request, str(request.url_for("manual_invoices:get", id=id)), 303
    )


# --- Delete ---


@router.post("/{id}/delete", name="manual_invoices:delete_action")
async def delete_action(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> Any:
    repository = ManualInvoiceRepository.from_session(session)
    manual_invoice = await repository.get_by_id(id)

    if manual_invoice is None:
        raise HTTPException(status_code=404)

    try:
        await manual_invoice_service.delete_draft(session, manual_invoice)
        await add_toast(request, "Draft invoice deleted.", "success")
    except ManualInvoiceError as e:
        await add_toast(request, str(e), "error")
        return HXRedirectResponse(
            request, str(request.url_for("manual_invoices:get", id=id)), 303
        )

    return HXRedirectResponse(
        request, str(request.url_for("manual_invoices:list")), 303
    )
