from uuid import UUID

from sqlalchemy import Select, func

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Customer, ManualInvoice
from polar.models.manual_invoice import ManualInvoiceStatus

from .sorting import ManualInvoiceSortProperty


class ManualInvoiceRepository(
    RepositorySortingMixin[ManualInvoice, ManualInvoiceSortProperty],
    RepositorySoftDeletionIDMixin[ManualInvoice, UUID],
    RepositorySoftDeletionMixin[ManualInvoice],
    RepositoryBase[ManualInvoice],
):
    model = ManualInvoice

    def get_sorting_clause(
        self, property: ManualInvoiceSortProperty
    ) -> SortingClause:
        match property:
            case ManualInvoiceSortProperty.created_at:
                return ManualInvoice.created_at
            case ManualInvoiceSortProperty.status:
                return ManualInvoice.status
            case ManualInvoiceSortProperty.customer:
                return Customer.email
            case ManualInvoiceSortProperty.due_date:
                return ManualInvoice.due_date
            case ManualInvoiceSortProperty.total_amount:
                # Cannot sort by computed property; fall back to created_at
                return ManualInvoice.created_at
