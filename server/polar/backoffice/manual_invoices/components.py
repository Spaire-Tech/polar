import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import classes, tag, text

from polar.kit.sorting import Sorting
from polar.models import ManualInvoice
from polar.models.manual_invoice import ManualInvoiceStatus
from polar.manual_invoice.sorting import ManualInvoiceSortProperty

from ..components import datatable


@contextlib.contextmanager
def manual_invoice_status_badge(status: ManualInvoiceStatus) -> Generator[None]:
    with tag.div(classes="badge"):
        if status == ManualInvoiceStatus.draft:
            classes("badge-warning")
        elif status == ManualInvoiceStatus.issued:
            classes("badge-info")
        elif status == ManualInvoiceStatus.paid:
            classes("badge-success")
        elif status == ManualInvoiceStatus.voided:
            classes("badge-error")
        text(status.value.title())
    yield


class StatusColumn(
    datatable.DatatableSortingColumn[ManualInvoice, ManualInvoiceSortProperty]
):
    def __init__(self, label: str) -> None:
        super().__init__(label, sorting=ManualInvoiceSortProperty.status)

    def render(self, request: Request, item: ManualInvoice) -> Generator[None] | None:
        with manual_invoice_status_badge(item.status):
            pass
        return None


class AmountColumn(
    datatable.DatatableColumn[ManualInvoice, ManualInvoiceSortProperty]
):
    def __init__(self, label: str) -> None:
        super().__init__(label)

    def render(self, request: Request, item: ManualInvoice) -> Generator[None] | None:
        from polar.backoffice import formatters

        text(formatters.currency(item.total_amount, item.currency))
        return None


@contextlib.contextmanager
def manual_invoices_datatable(
    request: Request,
    items: Sequence[ManualInvoice],
    sorting: list[Sorting[ManualInvoiceSortProperty]] | None = None,
) -> Generator[None]:
    d = datatable.Datatable[ManualInvoice, ManualInvoiceSortProperty](
        datatable.DatatableAttrColumn(
            "id",
            "ID",
            clipboard=True,
            href_route_name="manual_invoices:get",
        ),
        datatable.DatatableDateTimeColumn(
            "created_at",
            "Created",
            sorting=ManualInvoiceSortProperty.created_at,
        ),
        StatusColumn("Status"),
        datatable.DatatableAttrColumn("invoice_number", "Invoice #"),
        datatable.DatatableAttrColumn("currency", "Currency"),
        AmountColumn("Amount"),
    )

    with d.render(request, items, sorting=sorting):
        pass
    yield
