from typing import Annotated

from fastapi import Depends, Path, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.schemas import MultipleQueryFilter
from polar.models import StudioConversation
from polar.openapi import APITag
from polar.organization.schemas import OrganizationID
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import (
    StudioConversation as StudioConversationSchema,
)
from .schemas import (
    StudioConversationSyncRequest,
    StudioConversationUpdate,
    StudioConversationWithMessages,
)
from .service import studio_conversation as studio_conversation_service

router = APIRouter(
    prefix="/studio/conversations",
    tags=["studio-conversations", APITag.private],
)


StudioConversationID = Annotated[UUID4, Path(description="The Studio conversation ID.")]
StudioConversationNotFound = {
    "description": "Studio conversation not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Studio Conversations",
    response_model=ListResource[StudioConversationSchema],
)
async def list(
    auth_subject: auth.StudioRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: MultipleQueryFilter[OrganizationID] | None = Query(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[StudioConversationSchema]:
    """List the authenticated user's Studio conversations."""
    results, count = await studio_conversation_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(
        [StudioConversationSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Studio Conversation",
    response_model=StudioConversationWithMessages,
    responses={404: StudioConversationNotFound},
)
async def get(
    id: StudioConversationID,
    auth_subject: auth.StudioRead,
    session: AsyncSession = Depends(get_db_session),
) -> StudioConversation:
    """Get a conversation and its full message history."""
    conversation = await studio_conversation_service.get_by_id(
        session, auth_subject, id
    )
    if conversation is None:
        raise ResourceNotFound()
    return conversation


@router.post(
    "/sync",
    response_model=StudioConversationWithMessages,
    summary="Sync Studio Conversation",
    responses={
        200: {"description": "Studio conversation synced."},
    },
)
async def sync(
    sync_request: StudioConversationSyncRequest,
    auth_subject: auth.StudioWrite,
    session: AsyncSession = Depends(get_db_session),
) -> StudioConversation:
    """
    Create or update a conversation and replace its entire message list.

    The client owns message order and content — whatever it sends here becomes
    the stored state for the conversation.
    """
    return await studio_conversation_service.sync(session, auth_subject, sync_request)


@router.patch(
    "/{id}",
    response_model=StudioConversationSchema,
    summary="Update Studio Conversation",
    responses={
        200: {"description": "Studio conversation updated."},
        404: StudioConversationNotFound,
    },
)
async def update(
    id: StudioConversationID,
    update_schema: StudioConversationUpdate,
    auth_subject: auth.StudioWrite,
    session: AsyncSession = Depends(get_db_session),
) -> StudioConversation:
    """Rename a conversation or link it to a published product."""
    conversation = await studio_conversation_service.get_by_id(
        session, auth_subject, id
    )
    if conversation is None:
        raise ResourceNotFound()
    return await studio_conversation_service.update(
        session, conversation, update_schema
    )


@router.delete(
    "/{id}",
    status_code=204,
    summary="Delete Studio Conversation",
    responses={
        204: {"description": "Studio conversation deleted."},
        404: StudioConversationNotFound,
    },
)
async def delete(
    id: StudioConversationID,
    auth_subject: auth.StudioWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Delete a Studio conversation."""
    conversation = await studio_conversation_service.get_by_id(
        session, auth_subject, id
    )
    if conversation is None:
        raise ResourceNotFound()
    await studio_conversation_service.delete(session, conversation)
