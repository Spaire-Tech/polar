from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class ManualInvoiceSortProperty(StrEnum):
    created_at = "created_at"
    status = "status"
    total_amount = "total_amount"
    customer = "customer"
    due_date = "due_date"


ListSorting = Annotated[
    list[Sorting[ManualInvoiceSortProperty]],
    Depends(SortingGetter(ManualInvoiceSortProperty, ["-created_at"])),
]
