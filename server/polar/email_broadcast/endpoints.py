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
    EmailBroadcastDailyEngagementPoint,
    EmailBroadcastDeviceShare,
    EmailBroadcastRowAnalytics,
    EmailBroadcastSchedule,
    EmailBroadcastSendRow,
    EmailBroadcastTestSend,
    EmailBroadcastTopLink,
    EmailBroadcastUpdate,
    EmailBroadcastWithAnalytics,
)
from .service import email_broadcast as email_broadcast_service

router = APIRouter(prefix="/email-broadcasts", tags=["email-broadcasts"])


@router.get("/", response_model=ListResource[EmailBroadcastWithAnalytics])
async def list_email_broadcasts(
    auth_subject: EmailSubscribersRead,
    pagination: PaginationParamsQuery,
    organization_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    include_analytics: bool = Query(default=True),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[EmailBroadcastWithAnalytics]:
    results, count = await email_broadcast_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        status=status,
        q=q,
        pagination=pagination,
    )

    analytics_by_id: dict = {}
    if include_analytics and results:
        analytics_by_id = await email_broadcast_service.list_analytics(
            session, [r.id for r in results]
        )

    items: list[EmailBroadcastWithAnalytics] = []
    for r in results:
        base = EmailBroadcastSchema.model_validate(r, from_attributes=True)
        a = analytics_by_id.get(r.id)
        items.append(
            EmailBroadcastWithAnalytics(
                **base.model_dump(),
                analytics=EmailBroadcastRowAnalytics(**a) if a else None,
            )
        )
    return ListResource.from_paginated_results(items, count, pagination)


@router.get("/aggregate-analytics")
async def get_broadcast_aggregate_analytics(
    auth_subject: EmailSubscribersRead,
    organization_id: UUID = Query(),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> dict:
    return await email_broadcast_service.get_aggregate_analytics(
        session, organization_id
    )


@router.get("/top-links", response_model=list[EmailBroadcastTopLink])
async def get_broadcast_top_links(
    auth_subject: EmailSubscribersRead,
    organization_id: UUID = Query(),
    days: int = Query(default=14),
    limit: int = Query(default=10),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[dict]:
    return await email_broadcast_service.get_top_links(
        session, organization_id, days=days, limit=limit
    )


@router.get("/devices", response_model=list[EmailBroadcastDeviceShare])
async def get_broadcast_devices(
    auth_subject: EmailSubscribersRead,
    organization_id: UUID = Query(),
    days: int = Query(default=90),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[dict]:
    return await email_broadcast_service.get_device_share(
        session, organization_id, days=days
    )


@router.get(
    "/daily-engagement", response_model=list[EmailBroadcastDailyEngagementPoint]
)
async def get_broadcast_daily_engagement(
    auth_subject: EmailSubscribersRead,
    organization_id: UUID = Query(),
    days: int = Query(default=14),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[dict]:
    return await email_broadcast_service.get_daily_engagement(
        session, organization_id, days=days
    )


@router.get("/daily-sends")
async def get_broadcast_daily_sends(
    auth_subject: EmailSubscribersRead,
    organization_id: UUID = Query(),
    days: int = Query(default=30),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[dict]:
    return await email_broadcast_service.get_daily_sends(
        session, organization_id, days
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
        preview_text=broadcast_create.preview_text,
        sender_name=broadcast_create.sender_name,
        reply_to_email=broadcast_create.reply_to_email,
        content_json=broadcast_create.content_json,
        content_html=broadcast_create.content_html,
        segment_id=broadcast_create.segment_id,
        filter_rules=broadcast_create.filter_rules,
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
    # Only forward fields the client actually sent so we don't blank out values.
    update_dict = broadcast_update.model_dump(exclude_unset=True)
    updated = await email_broadcast_service.update(
        session, broadcast, update=update_dict
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


@router.post("/{broadcast_id}/schedule", response_model=EmailBroadcastSchema)
async def schedule_email_broadcast(
    auth_subject: EmailSubscribersWrite,
    broadcast_id: UUID4,
    schedule: EmailBroadcastSchedule,
    session: AsyncSession = Depends(get_db_session),
) -> EmailBroadcastSchema:
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    from .service import BroadcastAlreadySent
    try:
        scheduled = await email_broadcast_service.schedule(
            session, broadcast, scheduled_at=schedule.scheduled_at
        )
    except BroadcastAlreadySent as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail=str(e))
    return EmailBroadcastSchema.model_validate(scheduled, from_attributes=True)


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


@router.get(
    "/{broadcast_id}/sends", response_model=ListResource[EmailBroadcastSendRow]
)
async def list_email_broadcast_sends(
    auth_subject: EmailSubscribersRead,
    broadcast_id: UUID4,
    pagination: PaginationParamsQuery,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[EmailBroadcastSendRow]:
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    sends, count = await email_broadcast_service.list_sends(
        session, broadcast_id, pagination=pagination
    )
    items = [
        EmailBroadcastSendRow(
            id=s.id,
            subscriber_id=s.subscriber_id,
            subscriber_email=s.subscriber.email if s.subscriber else "",
            subscriber_name=s.subscriber.name if s.subscriber else None,
            status=s.status,
            sent_at=s.sent_at,
            opened_at=s.opened_at,
            open_count=s.open_count,
            clicked_at=s.clicked_at,
            click_count=s.click_count,
            bounced_at=s.bounced_at,
            unsubscribed_at=s.unsubscribed_at,
        )
        for s in sends
    ]
    return ListResource.from_paginated_results(items, count, pagination)


@router.post("/{broadcast_id}/duplicate", response_model=EmailBroadcastSchema, status_code=201)
async def duplicate_email_broadcast(
    auth_subject: EmailSubscribersWrite,
    broadcast_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> EmailBroadcastSchema:
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    copy = await email_broadcast_service.duplicate(session, broadcast)
    return EmailBroadcastSchema.model_validate(copy, from_attributes=True)


@router.post("/{broadcast_id}/cancel-schedule", response_model=EmailBroadcastSchema)
async def cancel_email_broadcast_schedule(
    auth_subject: EmailSubscribersWrite,
    broadcast_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> EmailBroadcastSchema:
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    updated = await email_broadcast_service.cancel_schedule(session, broadcast)
    return EmailBroadcastSchema.model_validate(updated, from_attributes=True)


@router.post("/{broadcast_id}/test", status_code=204)
async def send_test_email_broadcast(
    auth_subject: EmailSubscribersWrite,
    broadcast_id: UUID4,
    body: EmailBroadcastTestSend,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Send a one-off test rendering of this broadcast to a single inbox."""
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    await email_broadcast_service.send_test(
        session, broadcast, to_email=body.email
    )


@router.delete("/{broadcast_id}", status_code=204)
async def archive_email_broadcast(
    auth_subject: EmailSubscribersWrite,
    broadcast_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    broadcast = await email_broadcast_service.get_by_id(
        session, auth_subject, broadcast_id
    )
    if broadcast is None:
        raise ResourceNotFound()
    await email_broadcast_service.archive(session, broadcast)
