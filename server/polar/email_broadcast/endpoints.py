from uuid import UUID

from fastapi import Depends, Query
from pydantic import UUID4

from polar.email_subscriber.auth import EmailSubscribersRead, EmailSubscribersWrite
from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.postgres import AsyncReadSession, AsyncSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from .schemas import (
    EmailBroadcast as EmailBroadcastSchema,
    EmailBroadcastAnalytics,
    EmailBroadcastCreate,
    EmailBroadcastUpdate,
)
from .service import email_broadcast as email_broadcast_service

router = APIRouter(prefix="/email-broadcasts", tags=["email-broadcasts"])


@router.get("/", response_model=ListResource[EmailBroadcastSchema])
async def list_email_broadcasts(
    auth_subject: EmailSubscribersRead,
    pagination: PaginationParamsQuery,
    organization_id: UUID | None = Query(default=None),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[EmailBroadcastSchema]:
    results, count = await email_broadcast_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        pagination=pagination,
    )
    return ListResource.from_paginated_results(
        [EmailBroadcastSchema.model_validate(r, from_attributes=True) for r in results],
        count,
        pagination,
    )


@router.post("/", response_model=EmailBroadcastSchema, status_code=201)
async def create_email_broadcast(
    auth_subject: EmailSubscribersWrite,
    broadcast_create: EmailBroadcastCreate,
    organization_id: UUID = Query(),
    session: AsyncSession = Depends(get_db_session),
) -> EmailBroadcastSchema:
    broadcast = await email_broadcast_service.create(
        session,
        organization_id=organization_id,
        subject=broadcast_create.subject,
        sender_name=broadcast_create.sender_name,
        reply_to_email=broadcast_create.reply_to_email,
        content_json=broadcast_create.content_json,
        content_html=broadcast_create.content_html,
        segment_id=broadcast_create.segment_id,
    )
    return EmailBroadcastSchema.model_validate(broadcast, from_attributes=True)


@router.get("/{broadcast_id}", response_model=EmailBroadcastSchema)
async def get_email_broadcast(
    auth_subject: EmailSubscribersRead,
    broadcast_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> EmailBroadcastSchema:
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    return EmailBroadcastSchema.model_validate(broadcast, from_attributes=True)


@router.patch("/{broadcast_id}", response_model=EmailBroadcastSchema)
async def update_email_broadcast(
    auth_subject: EmailSubscribersWrite,
    broadcast_id: UUID4,
    broadcast_update: EmailBroadcastUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> EmailBroadcastSchema:
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    updated = await email_broadcast_service.update(
        session,
        broadcast,
        subject=broadcast_update.subject,
        sender_name=broadcast_update.sender_name,
        reply_to_email=broadcast_update.reply_to_email,
        content_json=broadcast_update.content_json,
        content_html=broadcast_update.content_html,
        segment_id=broadcast_update.segment_id,
    )
    return EmailBroadcastSchema.model_validate(updated, from_attributes=True)


@router.post("/{broadcast_id}/send", response_model=EmailBroadcastSchema)
async def send_email_broadcast(
    auth_subject: EmailSubscribersWrite,
    broadcast_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> EmailBroadcastSchema:
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    sent = await email_broadcast_service.send(session, broadcast)
    return EmailBroadcastSchema.model_validate(sent, from_attributes=True)


@router.get("/{broadcast_id}/analytics", response_model=EmailBroadcastAnalytics)
async def get_email_broadcast_analytics(
    auth_subject: EmailSubscribersRead,
    broadcast_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> EmailBroadcastAnalytics:
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    analytics = await email_broadcast_service.get_analytics(session, broadcast_id)
    return EmailBroadcastAnalytics(**analytics)
