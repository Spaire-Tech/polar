import csv
import io
from uuid import UUID

from fastapi import Depends, Query
from pydantic import UUID4
from starlette.responses import StreamingResponse

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from . import auth, sorting
from .schemas import (
    EmailSubscriber as EmailSubscriberSchema,
)
from .schemas import (
    EmailSubscriberBulkCreate,
    EmailSubscriberBulkResult,
    EmailSubscriberCreate,
    EmailSubscriberFilterPreview,
    EmailSubscriberFilterPreviewResult,
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
    q: str | None = Query(
        default=None, description="Search query — matches email and name."
    ),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[EmailSubscriberSchema]:
    results, count = await email_subscriber_service.list(
        session,
        auth_subject,
        organization_id=organization_id,
        status=status,
        q=q,
        pagination=pagination,
        sorting=sorting,
    )
    return ListResource.from_paginated_results(
        [EmailSubscriberSchema.model_validate(r, from_attributes=True) for r in results],
        count,
        pagination,
    )


@router.get("/stats", response_model=EmailSubscriberStats)
async def get_email_subscriber_stats(
    auth_subject: auth.EmailSubscribersRead,
    organization_id: UUID = Query(),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> EmailSubscriberStats:
    stats = await email_subscriber_service.get_stats(session, organization_id)
    return EmailSubscriberStats(**stats)


@router.get("/daily-growth")
async def get_email_subscriber_daily_growth(
    auth_subject: auth.EmailSubscribersRead,
    organization_id: UUID = Query(),
    days: int = Query(default=30),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[dict]:
    return await email_subscriber_service.get_daily_growth(
        session, organization_id, days
    )


@router.get("/daily-unsubscribes")
async def get_email_subscriber_daily_unsubscribes(
    auth_subject: auth.EmailSubscribersRead,
    organization_id: UUID = Query(),
    days: int = Query(default=30),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[dict]:
    return await email_subscriber_service.get_daily_unsubscribes(
        session, organization_id, days
    )


@router.get("/export")
async def export_email_subscribers(
    auth_subject: auth.EmailSubscribersRead,
    organization_id: UUID = Query(),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> StreamingResponse:
    """Export subscribers as a CSV file."""
    subscribers = await email_subscriber_service.get_all_for_export(
        session, organization_id
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["email", "name", "status", "source", "created_at"])
    for sub in subscribers:
        writer.writerow([
            sub.email,
            sub.name or "",
            sub.status,
            sub.source,
            sub.created_at.isoformat() if sub.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=subscribers.csv",
        },
    )


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


@router.get("/{subscriber_id}/tags", response_model=list[str])
async def list_email_subscriber_tags(
    auth_subject: auth.EmailSubscribersRead,
    subscriber_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[str]:
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    from polar.email_sequence.tags import list_tags

    return await list_tags(session, subscriber.id)


@router.post("/{subscriber_id}/tags", response_model=list[str], status_code=201)
async def add_email_subscriber_tag(
    auth_subject: auth.EmailSubscribersWrite,
    subscriber_id: UUID4,
    body: dict,
    session: AsyncSession = Depends(get_db_session),
) -> list[str]:
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    from polar.email_sequence.tags import add_tag, list_tags

    tag = (body.get("tag") or "").strip() if isinstance(body, dict) else ""
    if tag:
        await add_tag(session, subscriber.id, tag)
    return await list_tags(session, subscriber.id)


@router.delete("/{subscriber_id}/tags/{tag}", response_model=list[str])
async def remove_email_subscriber_tag(
    auth_subject: auth.EmailSubscribersWrite,
    subscriber_id: UUID4,
    tag: str,
    session: AsyncSession = Depends(get_db_session),
) -> list[str]:
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    from polar.email_sequence.tags import list_tags, remove_tag

    await remove_tag(session, subscriber.id, tag)
    return await list_tags(session, subscriber.id)


@router.get(
    "/{subscriber_id}/custom-fields", response_model=dict[str, str | None]
)
async def list_email_subscriber_custom_fields(
    auth_subject: auth.EmailSubscribersRead,
    subscriber_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> dict[str, str | None]:
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    from polar.email_sequence.custom_fields import list_fields

    return await list_fields(session, subscriber.id)


@router.put(
    "/{subscriber_id}/custom-fields/{key}",
    response_model=dict[str, str | None],
)
async def set_email_subscriber_custom_field(
    auth_subject: auth.EmailSubscribersWrite,
    subscriber_id: UUID4,
    key: str,
    body: dict,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str | None]:
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    from polar.email_sequence.custom_fields import list_fields, set_field

    value = body.get("value") if isinstance(body, dict) else None
    if value is not None and not isinstance(value, str):
        value = str(value)
    await set_field(session, subscriber.id, key, value)
    return await list_fields(session, subscriber.id)


@router.delete(
    "/{subscriber_id}/custom-fields/{key}",
    response_model=dict[str, str | None],
)
async def delete_email_subscriber_custom_field(
    auth_subject: auth.EmailSubscribersWrite,
    subscriber_id: UUID4,
    key: str,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str | None]:
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    from polar.email_sequence.custom_fields import delete_field, list_fields

    await delete_field(session, subscriber.id, key)
    return await list_fields(session, subscriber.id)


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


@router.delete("/{subscriber_id}/permanent", status_code=204)
async def delete_email_subscriber_permanently(
    auth_subject: auth.EmailSubscribersWrite,
    subscriber_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Permanently remove a subscriber (soft-delete on the row so the email slot is freed)."""
    subscriber = await email_subscriber_service.get_by_id(
        session, auth_subject, subscriber_id
    )
    if subscriber is None:
        raise ResourceNotFound()
    await email_subscriber_service.delete_permanently(session, subscriber)


@router.api_route("/unsubscribe", methods=["GET", "POST"], status_code=200)
async def unsubscribe_email_subscriber(
    token: str | None = Query(
        default=None,
        description="Signed unsubscribe token from the email link.",
    ),
    test: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, bool]:
    """Public, no-auth unsubscribe endpoint.

    Linked from the `List-Unsubscribe` header on every marketing email and
    from the in-body Unsubscribe link. Accepts both GET (so the link in the
    email works on click) and POST (so RFC 8058 one-click unsubscribe via
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click` works).

    The token is HMAC-signed with the server secret and binds the unsubscribe
    URL to a specific subscriber id. Without it, anyone who could guess a
    subscriber UUID could unsubscribe arbitrary users.

    Idempotent — always returns `{ ok: true }` for any well-formed signed
    token (even if the subscriber is already unsubscribed or no longer
    exists), so we don't leak existence to attackers probing tokens.
    """
    from .unsubscribe_token import verify_unsubscribe_token

    if test is not None:
        return {"ok": True}
    if not token:
        return {"ok": True}
    subscriber_id = verify_unsubscribe_token(token)
    if subscriber_id is None:
        # Treat invalid/expired tokens as success to avoid leaking signal
        # about whether a token is valid or which subscribers exist.
        return {"ok": True}
    await email_subscriber_service.unsubscribe_by_id(session, subscriber_id)
    return {"ok": True}


@router.post(
    "/segment-preview", response_model=EmailSubscriberFilterPreviewResult
)
async def preview_segment_filter(
    auth_subject: auth.EmailSubscribersRead,
    body: EmailSubscriberFilterPreview,
    organization_id: UUID = Query(),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> EmailSubscriberFilterPreviewResult:
    """Preview the audience matching a custom segment filter."""
    count, sample = await email_subscriber_service.preview_filter(
        session,
        organization_id=organization_id,
        filter_rules=body.filter_rules,
    )
    return EmailSubscriberFilterPreviewResult(
        count=count,
        sample=[
            EmailSubscriberSchema.model_validate(s, from_attributes=True)
            for s in sample
        ],
    )


@router.post(
    "/bulk", response_model=EmailSubscriberBulkResult, status_code=201
)
async def bulk_create_email_subscribers(
    auth_subject: auth.EmailSubscribersWrite,
    bulk: EmailSubscriberBulkCreate,
    organization_id: UUID = Query(),
    session: AsyncSession = Depends(get_db_session),
) -> EmailSubscriberBulkResult:
    counts = await email_subscriber_service.bulk_create(
        session,
        organization_id=organization_id,
        rows=[(r.email, r.name) for r in bulk.rows],
        import_source=bulk.import_source,
    )
    return EmailSubscriberBulkResult(**counts)
