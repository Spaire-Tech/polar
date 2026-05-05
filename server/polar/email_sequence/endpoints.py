from uuid import UUID

from fastapi import Depends, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.postgres import AsyncReadSession, AsyncSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from .auth import EmailSequencesRead, EmailSequencesWrite
from .schemas import (
    EmailSequence as EmailSequenceSchema,
    EmailSequenceAnalytics,
    EmailSequenceCreate,
    EmailSequenceEnrollment as EmailSequenceEnrollmentSchema,
    EmailSequenceEnrollRequest,
    EmailSequenceReorderItem,
    EmailSequenceStep as EmailSequenceStepSchema,
    EmailSequenceStepCreate,
    EmailSequenceStepUpdate,
    EmailSequenceUpdate,
)
from .service import AlreadyEnrolled, email_sequence as sequence_service

router = APIRouter(prefix="/email-sequences", tags=["email-sequences"])


@router.get("/", response_model=ListResource[EmailSequenceSchema])
async def list_email_sequences(
    auth_subject: EmailSequencesRead,
    pagination: PaginationParamsQuery,
    organization_id: UUID | None = Query(default=None),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[EmailSequenceSchema]:
    results, count = await sequence_service.list(
        session, auth_subject, organization_id=organization_id, pagination=pagination
    )
    return ListResource.from_paginated_results(
        [EmailSequenceSchema.model_validate(r, from_attributes=True) for r in results],
        count,
        pagination,
    )


@router.post("/", response_model=EmailSequenceSchema, status_code=201)
async def create_email_sequence(
    auth_subject: EmailSequencesWrite,
    sequence_create: EmailSequenceCreate,
    organization_id: UUID = Query(),
    session: AsyncSession = Depends(get_db_session),
) -> EmailSequenceSchema:
    sequence = await sequence_service.create(
        session,
        organization_id=organization_id,
        name=sequence_create.name,
        description=sequence_create.description,
        trigger_type=sequence_create.trigger_type,
        trigger_config=sequence_create.trigger_config,
    )
    return EmailSequenceSchema.model_validate(sequence, from_attributes=True)


@router.get("/{sequence_id}", response_model=EmailSequenceSchema)
async def get_email_sequence(
    auth_subject: EmailSequencesRead,
    sequence_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> EmailSequenceSchema:
    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()
    return EmailSequenceSchema.model_validate(sequence, from_attributes=True)


@router.patch("/{sequence_id}", response_model=EmailSequenceSchema)
async def update_email_sequence(
    auth_subject: EmailSequencesWrite,
    sequence_id: UUID4,
    sequence_update: EmailSequenceUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> EmailSequenceSchema:
    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()
    updated = await sequence_service.update(
        session,
        sequence,
        name=sequence_update.name,
        description=sequence_update.description,
        trigger_type=sequence_update.trigger_type,
        trigger_config=sequence_update.trigger_config,
        status=sequence_update.status,
    )
    return EmailSequenceSchema.model_validate(updated, from_attributes=True)


@router.delete("/{sequence_id}", status_code=204)
async def delete_email_sequence(
    auth_subject: EmailSequencesWrite,
    sequence_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()
    await sequence_service.delete(session, sequence)


# ── Steps ─────────────────────────────────────────────────────────────────────

@router.get("/{sequence_id}/steps", response_model=list[EmailSequenceStepSchema])
async def list_sequence_steps(
    auth_subject: EmailSequencesRead,
    sequence_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[EmailSequenceStepSchema]:
    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()
    steps = await sequence_service.get_steps(session, sequence_id)
    return [EmailSequenceStepSchema.model_validate(s, from_attributes=True) for s in steps]


@router.post("/{sequence_id}/steps", response_model=EmailSequenceStepSchema, status_code=201)
async def add_sequence_step(
    auth_subject: EmailSequencesWrite,
    sequence_id: UUID4,
    step_create: EmailSequenceStepCreate,
    session: AsyncSession = Depends(get_db_session),
) -> EmailSequenceStepSchema:
    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()
    step = await sequence_service.add_step(
        session,
        sequence,
        position=step_create.position,
        delay_hours=step_create.delay_hours,
        subject=step_create.subject,
        sender_name=step_create.sender_name,
        sender_email=step_create.sender_email,
        reply_to_email=step_create.reply_to_email,
        content_html=step_create.content_html,
        content_json=step_create.content_json,
    )
    return EmailSequenceStepSchema.model_validate(step, from_attributes=True)


@router.post("/{sequence_id}/steps/reorder", status_code=204)
async def reorder_sequence_steps(
    auth_subject: EmailSequencesWrite,
    sequence_id: UUID4,
    items: list[EmailSequenceReorderItem],
    session: AsyncSession = Depends(get_db_session),
) -> None:
    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()
    await sequence_service.reorder_steps(
        session, [{"id": item.id, "position": item.position} for item in items]
    )


@router.patch("/{sequence_id}/steps/{step_id}", response_model=EmailSequenceStepSchema)
async def update_sequence_step(
    auth_subject: EmailSequencesWrite,
    sequence_id: UUID4,
    step_id: UUID4,
    step_update: EmailSequenceStepUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> EmailSequenceStepSchema:
    from .repository import EmailSequenceRepository

    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()

    repository = EmailSequenceRepository.from_session(session)
    step = await repository.get_step(step_id)
    if step is None or step.sequence_id != sequence_id:
        raise ResourceNotFound()

    updated_step = await sequence_service.update_step(
        session,
        step,
        position=step_update.position,
        delay_hours=step_update.delay_hours,
        subject=step_update.subject,
        sender_name=step_update.sender_name,
        sender_email=step_update.sender_email,
        reply_to_email=step_update.reply_to_email,
        content_html=step_update.content_html,
        content_json=step_update.content_json,
    )
    return EmailSequenceStepSchema.model_validate(updated_step, from_attributes=True)


@router.delete("/{sequence_id}/steps/{step_id}", status_code=204)
async def delete_sequence_step(
    auth_subject: EmailSequencesWrite,
    sequence_id: UUID4,
    step_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    from .repository import EmailSequenceRepository

    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()

    repository = EmailSequenceRepository.from_session(session)
    step = await repository.get_step(step_id)
    if step is None or step.sequence_id != sequence_id:
        raise ResourceNotFound()

    await sequence_service.delete_step(session, step)


# ── Enrollments ───────────────────────────────────────────────────────────────

@router.get("/{sequence_id}/enrollments", response_model=list[EmailSequenceEnrollmentSchema])
async def list_sequence_enrollments(
    auth_subject: EmailSequencesRead,
    sequence_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[EmailSequenceEnrollmentSchema]:
    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()
    enrollments = await sequence_service.get_enrollments(session, sequence_id)
    return [EmailSequenceEnrollmentSchema.model_validate(e, from_attributes=True) for e in enrollments]


@router.post("/{sequence_id}/enrollments", response_model=EmailSequenceEnrollmentSchema, status_code=201)
async def enroll_subscriber(
    auth_subject: EmailSequencesWrite,
    sequence_id: UUID4,
    enroll_request: EmailSequenceEnrollRequest,
    session: AsyncSession = Depends(get_db_session),
) -> EmailSequenceEnrollmentSchema:
    from fastapi import HTTPException

    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()

    try:
        enrollment = await sequence_service.enroll(session, sequence, enroll_request.subscriber_id)
    except AlreadyEnrolled as e:
        raise HTTPException(status_code=409, detail=str(e))

    return EmailSequenceEnrollmentSchema.model_validate(enrollment, from_attributes=True)


@router.delete("/{sequence_id}/enrollments/{subscriber_id}", status_code=204)
async def unenroll_subscriber(
    auth_subject: EmailSequencesWrite,
    sequence_id: UUID4,
    subscriber_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()
    await sequence_service.unenroll(session, sequence_id, subscriber_id)


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/{sequence_id}/analytics", response_model=EmailSequenceAnalytics)
async def get_sequence_analytics(
    auth_subject: EmailSequencesRead,
    sequence_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> EmailSequenceAnalytics:
    sequence = await sequence_service.get_by_id(session, auth_subject, sequence_id)
    if sequence is None:
        raise ResourceNotFound()
    analytics = await sequence_service.get_analytics(session, sequence_id)
    return EmailSequenceAnalytics(**analytics)
