from datetime import datetime
from uuid import UUID

from sqlalchemy import Select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.manual_invoice_schedule import (
    ManualInvoiceSchedule,
    ManualInvoiceScheduleStatus,
)


class ManualInvoiceScheduleRepository(
    RepositorySoftDeletionIDMixin[ManualInvoiceSchedule, UUID],
    RepositorySoftDeletionMixin[ManualInvoiceSchedule],
    RepositoryBase[ManualInvoiceSchedule],
):
    model = ManualInvoiceSchedule

    def get_due_schedules_statement(
        self, now: datetime
    ) -> Select[tuple[ManualInvoiceSchedule]]:
        return self.get_base_statement().where(
            ManualInvoiceSchedule.status == ManualInvoiceScheduleStatus.active,
            ManualInvoiceSchedule.next_issue_date <= now,
        )
