from uuid import UUID

from fastapi import Depends, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.postgres import AsyncReadSession, AsyncSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import (
    EmailSubscriber as EmailSubscriberSchema,
    EmailSubscriberCreate,
    EmailSubscriberStats,
    EmailSubscriberUpdate,
)
from .service import email_subscriber as email_subscriber_service

router = APIRouter(prefix="/email-subscribers", tags=["email-subscribers"])


@router.get("/", response_model=ListResource[EmailSubscriberSchema])
async def list_email_subscribers(
    auth_subject: auth.EmailSubscribersRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    organization_id: UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[EmailSubscriberSchema]:
    results, count = await email_subscriber_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        status=status,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource(
        items=[EmailSubscriberSchema.model_validate(r, from_attributes=True) for r in results],
        pagination=Pagination(page=pagination.page, total_count=count),
    )


@router.get("/stats", response_model=EmailSubscriberStats)
async def get_email_subscriber_stats(
    auth_subject: auth.EmailSubscribersRead,
    organization_id: UUID = Query(),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> EmailSubscriberStats:
    stats = await email_subscriber_service.get_stats(session, organization_id)
    return EmailSubscriberStats(**stats)


@router.post("/", response_model=EmailSubscriberSchema, status_code=201)
async def create_email_subscriber(
    auth_subject: auth.EmailSubscribersWrite,
    subscriber_create: EmailSubscriberCreate,
    organization_id: UUID = Query(),
    session: AsyncSession = Depends(get_db_session),
) -> EmailSubscriberSchema:
    subscriber = await email_subscriber_service.create(
        session,
        organization_id=organization_id,
        email=subscriber_create.email,
        name=subscriber_create.name,
    )
    return EmailSubscriberSchema.model_validate(subscriber, from_attributes=True)


@router.get("/{subscriber_id}", response_model=EmailSubscriberSchema)
async def get_email_subscriber(
    auth_subject: auth.EmailSubscribersRead,
    subscriber_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> EmailSubscriberSchema:
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    return EmailSubscriberSchema.model_validate(subscriber, from_attributes=True)


@router.patch("/{subscriber_id}", response_model=EmailSubscriberSchema)
async def update_email_subscriber(
    auth_subject: auth.EmailSubscribersWrite,
    subscriber_id: UUID4,
    subscriber_update: EmailSubscriberUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> EmailSubscriberSchema:
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    updated = await email_subscriber_service.update(
        session,
        subscriber,
        name=subscriber_update.name,
        status=subscriber_update.status,
    )
    return EmailSubscriberSchema.model_validate(updated, from_attributes=True)


@router.delete("/{subscriber_id}", status_code=204)
async def delete_email_subscriber(
    auth_subject: auth.EmailSubscribersWrite,
    subscriber_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    await email_subscriber_service.update(
        session, subscriber, status="archived"
    )
