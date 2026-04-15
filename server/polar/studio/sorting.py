from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class StudioConversationSortProperty(StrEnum):
    created_at = "created_at"
    modified_at = "modified_at"
    conversation_title = "title"


ListSorting = Annotated[
    list[Sorting[StudioConversationSortProperty]],
    Depends(SortingGetter(StudioConversationSortProperty, ["-modified_at"])),
]
