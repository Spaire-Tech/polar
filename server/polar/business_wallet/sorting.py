from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class TreasuryTransactionSortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"


ListSorting = Annotated[
    list[Sorting[TreasuryTransactionSortProperty]],
    Depends(SortingGetter(TreasuryTransactionSortProperty, ["-created_at"])),
]
