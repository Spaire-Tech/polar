import contextlib
from collections.abc import Generator, Sequence
from typing import Any

from fastapi import Request
from tagflow import classes, tag, text

from polar.models.manual_invoice_schedule import (
    ManualInvoiceSchedule,
    ManualInvoiceScheduleStatus,
)

from ..components import datatable


@contextlib.contextmanager
def schedule_status_badge(status: ManualInvoiceScheduleStatus) -> Generator[None]:
    with tag.div(classes="badge"):
        if status == ManualInvoiceScheduleStatus.active:
            classes("badge-success")
        elif status == ManualInvoiceScheduleStatus.paused:
            classes("badge-warning")
        elif status == ManualInvoiceScheduleStatus.canceled:
            classes("badge-error")
        text(status.value.title())
    yield


class StatusColumn(datatable.DatatableColumn[ManualInvoiceSchedule]):
    def __init__(self, label: str) -> None:
        super().__init__(label)

    def render(
        self, request: Request, item: ManualInvoiceSchedule
    ) -> Generator[None] | None:
        with schedule_status_badge(item.status):
            pass
        return None


class AmountColumn(datatable.DatatableColumn[ManualInvoiceSchedule]):
    def __init__(self, label: str) -> None:
        super().__init__(label)

    def render(
        self, request: Request, item: ManualInvoiceSchedule
    ) -> Generator[None] | None:
        from polar.backoffice import formatters

        text(formatters.currency(item.total_amount, item.currency))
        return None


class IntervalColumn(datatable.DatatableColumn[ManualInvoiceSchedule]):
    def __init__(self, label: str) -> None:
        super().__init__(label)

    def render(
        self, request: Request, item: ManualInvoiceSchedule
    ) -> Generator[None] | None:
        count = item.recurring_interval_count
        interval = item.recurring_interval
        if count == 1:
            text(f"Every {interval}")
        else:
            text(f"Every {count} {interval}s")
        return None


@contextlib.contextmanager
def schedules_datatable(
    request: Request,
    items: Sequence[ManualInvoiceSchedule],
) -> Generator[None]:
    d = datatable.Datatable[ManualInvoiceSchedule, Any](
        datatable.DatatableAttrColumn(
            "id",
            "ID",
            clipboard=True,
            href_route_name="invoice_schedules:get",
        ),
        datatable.DatatableDateTimeColumn("created_at", "Created"),
        StatusColumn("Status"),
        IntervalColumn("Interval"),
        datatable.DatatableAttrColumn("currency", "Currency"),
        AmountColumn("Amount"),
        datatable.DatatableDateTimeColumn("next_issue_date", "Next Issue"),
    )

    with d.render(request, items):
        pass
    yield
