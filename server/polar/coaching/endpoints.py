import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Query

from polar.openapi import APITag
from polar.postgres import AsyncReadSession, AsyncSession, get_db_read_session, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import (
    CoachingCohortCreate,
    CoachingCohortRead,
    CoachingCohortUpdate,
    CoachingEventCreate,
    CoachingEventRead,
    CoachingEventUpdate,
    CoachingIntakeFormCreate,
    CoachingIntakeFormRead,
    CoachingIntakeFormUpdate,
    CoachingIntakeResponseRead,
    CoachingMemberAssignCohort,
    CoachingMemberCustomer,
    CoachingMemberRead,
    CoachingMuxUploadRead,
    IntakeSchema,
)
from .service import coaching_service, cohort_service, intake_service

log = logging.getLogger(__name__)


router = APIRouter(
    prefix="/coaching",
    tags=["coaching", APITag.private],
)


def _read(event) -> CoachingEventRead:
    return CoachingEventRead.model_validate(event, from_attributes=True)


@router.get("/events", response_model=list[CoachingEventRead])
async def list_events(
    auth_subject: auth.CoachingRead,
    course_id: Annotated[UUID, Query(description="Course ID to list events for")],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[CoachingEventRead]:
    events = await coaching_service.list_events(
        session, auth_subject, course_id=course_id
    )
    return [_read(e) for e in events]


@router.get("/events/{event_id}", response_model=CoachingEventRead)
async def get_event(
    event_id: UUID,
    auth_subject: auth.CoachingRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CoachingEventRead:
    event = await coaching_service.get_event(
        session, auth_subject, event_id=event_id
    )
    return _read(event)


@router.post("/events", response_model=CoachingEventRead, status_code=201)
async def create_event(
    body: CoachingEventCreate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingEventRead:
    event = await coaching_service.create_event(session, auth_subject, body)
    return _read(event)


@router.patch("/events/{event_id}", response_model=CoachingEventRead)
async def update_event(
    event_id: UUID,
    body: CoachingEventUpdate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingEventRead:
    event = await coaching_service.update_event(
        session, auth_subject, event_id=event_id, update_schema=body
    )
    return _read(event)


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(
    event_id: UUID,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await coaching_service.delete_event(
        session, auth_subject, event_id=event_id
    )


@router.post(
    "/events/{event_id}/recording-upload",
    response_model=CoachingMuxUploadRead,
)
async def create_recording_upload(
    event_id: UUID,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingMuxUploadRead:
    """Create a Mux direct-upload URL for a post-event recording. The coach
    PUTs the video to `upload_url`; the existing Mux webhook updates the
    asset/playback ids when processing is done."""
    try:
        upload = await coaching_service.create_recording_upload(
            session, auth_subject, event_id=event_id
        )
    except Exception as exc:
        log.exception("coaching.recording_upload failed", extra={"event_id": str(event_id)})
        raise HTTPException(status_code=502, detail="Mux upload creation failed") from exc
    return CoachingMuxUploadRead(
        upload_id=upload["upload_id"], upload_url=upload["upload_url"]
    )


# ── Cohorts ─────────────────────────────────────────────────────────────────


def _cohort_read(cohort, member_count: int) -> CoachingCohortRead:
    return CoachingCohortRead(
        id=cohort.id,
        course_id=cohort.course_id,
        name=cohort.name,
        starts_at=cohort.starts_at,
        ends_at=cohort.ends_at,
        capacity=cohort.capacity,
        enrollment_open=cohort.enrollment_open,
        is_default=cohort.is_default,
        member_count=member_count,
        created_at=cohort.created_at,
        modified_at=cohort.modified_at,
    )


@router.get("/cohorts", response_model=list[CoachingCohortRead])
async def list_cohorts(
    auth_subject: auth.CoachingRead,
    course_id: Annotated[UUID, Query(description="Course ID to list cohorts for")],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[CoachingCohortRead]:
    rows = await cohort_service.list_for_course(
        session, auth_subject, course_id=course_id
    )
    return [_cohort_read(c, n) for c, n in rows]


@router.post("/cohorts", response_model=CoachingCohortRead, status_code=201)
async def create_cohort(
    body: CoachingCohortCreate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingCohortRead:
    cohort = await cohort_service.create(session, auth_subject, body)
    return _cohort_read(cohort, 0)


@router.patch("/cohorts/{cohort_id}", response_model=CoachingCohortRead)
async def update_cohort(
    cohort_id: UUID,
    body: CoachingCohortUpdate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingCohortRead:
    cohort = await cohort_service.update(
        session, auth_subject, cohort_id=cohort_id, update_schema=body
    )
    # member_count not refreshed here; the dashboard re-fetches the list
    # right after a mutation anyway.
    return _cohort_read(cohort, 0)


@router.delete("/cohorts/{cohort_id}", status_code=204)
async def delete_cohort(
    cohort_id: UUID,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await cohort_service.delete(session, auth_subject, cohort_id=cohort_id)


# ── Members ─────────────────────────────────────────────────────────────────


@router.get("/members", response_model=list[CoachingMemberRead])
async def list_members(
    auth_subject: auth.CoachingRead,
    course_id: Annotated[UUID, Query(description="Course ID to list members for")],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[CoachingMemberRead]:
    rows = await cohort_service.list_members(
        session, auth_subject, course_id=course_id
    )
    return [
        CoachingMemberRead(
            enrollment_id=row["enrollment_id"],
            enrolled_at=row["enrolled_at"],
            cohort_id=row["cohort_id"],
            cohort_name=row["cohort_name"],
            customer=CoachingMemberCustomer(**row["customer"]),
            completed_lessons=row["completed_lessons"],
            total_lessons=row["total_lessons"],
        )
        for row in rows
    ]


@router.post(
    "/members/{enrollment_id}/cohort",
    response_model=CoachingMemberRead,
)
async def assign_member_cohort(
    enrollment_id: UUID,
    body: CoachingMemberAssignCohort,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingMemberRead:
    await cohort_service.assign_member(
        session,
        auth_subject,
        enrollment_id=enrollment_id,
        cohort_id=body.cohort_id,
    )
    # Re-resolve the member row so the response matches list_members.
    # Cheaper than re-running the full list query: load the enrollment +
    # customer + cohort directly.
    from sqlalchemy import select

    from polar.models.coaching_cohort import CoachingCohort
    from polar.models.coaching_cohort_enrollment import CoachingCohortEnrollment
    from polar.models.course_enrollment import CourseEnrollment
    from polar.models.customer import Customer

    stmt = (
        select(
            CourseEnrollment,
            Customer,
            CoachingCohortEnrollment.cohort_id,
            CoachingCohort.name,
        )
        .join(Customer, Customer.id == CourseEnrollment.customer_id)
        .outerjoin(
            CoachingCohortEnrollment,
            (CoachingCohortEnrollment.enrollment_id == CourseEnrollment.id)
            & (CoachingCohortEnrollment.deleted_at.is_(None)),
        )
        .outerjoin(
            CoachingCohort,
            (CoachingCohort.id == CoachingCohortEnrollment.cohort_id)
            & (CoachingCohort.deleted_at.is_(None)),
        )
        .where(CourseEnrollment.id == enrollment_id)
    )
    result = await session.execute(stmt)
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Member not found")
    enrollment, customer, cohort_id, cohort_name = row
    return CoachingMemberRead(
        enrollment_id=enrollment.id,
        enrolled_at=enrollment.enrolled_at,
        cohort_id=cohort_id,
        cohort_name=cohort_name,
        customer=CoachingMemberCustomer(
            id=customer.id,
            email=customer.email,
            name=customer.name,
            avatar_url=getattr(customer, "avatar_url", None),
        ),
        completed_lessons=0,
        total_lessons=0,
    )


# ── Intake forms ────────────────────────────────────────────────────────────


def _intake_read(form) -> CoachingIntakeFormRead:
    schema = form.schema_json or {}
    return CoachingIntakeFormRead(
        id=form.id,
        course_id=form.course_id,
        title=form.title,
        description=form.description,
        schema_json=IntakeSchema.model_validate(schema),
        required_for_access=form.required_for_access,
        created_at=form.created_at,
        modified_at=form.modified_at,
    )


@router.get(
    "/intake-forms",
    response_model=CoachingIntakeFormRead | None,
    description="Returns the intake form for the program, or null if none exists.",
)
async def get_intake_form(
    auth_subject: auth.CoachingRead,
    course_id: Annotated[UUID, Query(description="Course ID")],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> CoachingIntakeFormRead | None:
    form = await intake_service.get_form_for_course(
        session, auth_subject, course_id=course_id
    )
    return _intake_read(form) if form else None


@router.put(
    "/intake-forms",
    response_model=CoachingIntakeFormRead,
    description=(
        "Upsert the intake form for a coaching program. Each program has at "
        "most one form, so PUT is the right verb."
    ),
)
async def upsert_intake_form(
    body: CoachingIntakeFormCreate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingIntakeFormRead:
    form = await intake_service.upsert_form(session, auth_subject, body)
    return _intake_read(form)


@router.patch(
    "/intake-forms/{form_id}",
    response_model=CoachingIntakeFormRead,
)
async def update_intake_form(
    form_id: UUID,
    body: CoachingIntakeFormUpdate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingIntakeFormRead:
    form = await intake_service.update_form(
        session, auth_subject, form_id=form_id, update_schema=body
    )
    return _intake_read(form)


@router.delete("/intake-forms/{form_id}", status_code=204)
async def delete_intake_form(
    form_id: UUID,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await intake_service.delete_form(session, auth_subject, form_id=form_id)


@router.get(
    "/intake-responses",
    response_model=list[CoachingIntakeResponseRead],
)
async def list_intake_responses(
    auth_subject: auth.CoachingRead,
    course_id: Annotated[UUID, Query(description="Course ID")],
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[CoachingIntakeResponseRead]:
    rows = await intake_service.list_responses(
        session, auth_subject, course_id=course_id
    )
    return [
        CoachingIntakeResponseRead(
            id=row["id"],
            form_id=row["form_id"],
            customer_id=row["customer_id"],
            enrollment_id=row["enrollment_id"],
            answers=row["answers"],
            submitted_at=row["submitted_at"],
            customer_email=row["customer_email"],
            customer_name=row["customer_name"],
            created_at=row["created_at"],
            modified_at=row["modified_at"],
        )
        for row in rows
    ]
