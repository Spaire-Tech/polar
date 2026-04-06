from uuid import UUID

from fastapi import Depends, Query

from polar.email_subscriber.auth import EmailSubscribersRead
from polar.postgres import AsyncReadSession, AsyncSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from .schemas import EmailSegment as EmailSegmentSchema
from .service import email_segment as email_segment_service

router = APIRouter(prefix="/email-segments", tags=["email-segments"])


@router.get("/", response_model=list[EmailSegmentSchema])
async def list_email_segments(
    auth_subject: EmailSubscribersRead,
    organization_id: UUID = Query(),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[EmailSegmentSchema]:
    # Ensure system segments exist
    # Use write session for this
    segments = await email_segment_service.list(session, organization_id)
    return [EmailSegmentSchema(**s) for s in segments]


@router.post("/ensure-system", response_model=list[EmailSegmentSchema], status_code=201)
async def ensure_system_segments(
    auth_subject: EmailSubscribersRead,
    organization_id: UUID = Query(),
    session: AsyncSession = Depends(get_db_session),
) -> list[EmailSegmentSchema]:
    """Ensure system segments exist for an organization."""
    created = await email_segment_service.ensure_system_segments(
        session, organization_id
    )
    return [
        EmailSegmentSchema(
            id=s.id,
            organization_id=s.organization_id,
            name=s.name,
            slug=s.slug,
            type=s.type,
            product_id=s.product_id,
            is_system=s.is_system,
            subscriber_count=0,
            created_at=s.created_at,
            modified_at=s.modified_at,
        )
        for s in created
    ]
