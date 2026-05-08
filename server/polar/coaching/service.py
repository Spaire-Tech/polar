from datetime import UTC, datetime
from typing import Sequence
from uuid import UUID

from sqlalchemy import func, select

from polar.auth.models import AuthSubject, Organization, User
from polar.course import mux as mux_client
from polar.course.repository import CourseRepository
from polar.exceptions import ResourceNotFound, SpaireRequestValidationError
from polar.kit.utils import utc_now
from polar.models.coaching_cohort import CoachingCohort
from polar.models.coaching_cohort_enrollment import CoachingCohortEnrollment
from polar.models.coaching_event import CoachingEvent
from polar.models.coaching_intake_form import CoachingIntakeForm
from polar.models.coaching_intake_response import CoachingIntakeResponse
from polar.models.coaching_post import CoachingPost
from polar.models.course import Course
from polar.models.course_enrollment import CourseEnrollment
from polar.models.course_lesson import CourseLesson
from polar.models.course_lesson_progress import CourseLessonProgress
from polar.models.course_module import CourseModule
from polar.models.customer import Customer
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import (
    CoachingCohortEnrollmentRepository,
    CoachingCohortRepository,
    CoachingEventRepository,
    CoachingIntakeFormRepository,
    CoachingIntakeResponseRepository,
    CoachingPostRepository,
)
from .schemas import (
    CoachingCohortCreate,
    CoachingCohortUpdate,
    CoachingEventCreate,
    CoachingEventUpdate,
    CoachingIntakeFormCreate,
    CoachingIntakeFormUpdate,
)


class CoachingProgramRequired(SpaireRequestValidationError):
    """Raised when an action targets a course that isn't a coaching program."""

    def __init__(self) -> None:
        super().__init__(
            errors=[
                {
                    "type": "value_error",
                    "loc": ("course_id",),
                    "msg": (
                        "Course is not a coaching program "
                        "(program_format != 'coaching')."
                    ),
                    "input": None,
                }
            ]
        )


class CoachingService:
    async def list_events(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        course_id: UUID,
    ) -> Sequence[CoachingEvent]:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(course_id, auth_subject)
        if course is None:
            raise ResourceNotFound()

        repo = CoachingEventRepository.from_session(session)
        statement = repo.get_by_course_statement(course_id)
        return await repo.get_all(statement)

    async def get_event(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        event_id: UUID,
    ) -> CoachingEvent:
        repo = CoachingEventRepository.from_session(session)
        event = await repo.get_readable_by_id(event_id, auth_subject)
        if event is None:
            raise ResourceNotFound()
        return event

    async def create_event(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: CoachingEventCreate,
    ) -> CoachingEvent:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(
            create_schema.course_id, auth_subject
        )
        if course is None:
            raise ResourceNotFound()
        if course.program_format != "coaching":
            raise CoachingProgramRequired()

        repo = CoachingEventRepository.from_session(session)
        event = CoachingEvent(
            course_id=course.id,
            title=create_schema.title,
            description=create_schema.description,
            agenda=create_schema.agenda,
            starts_at=_ensure_utc(create_schema.starts_at),
            duration_minutes=create_schema.duration_minutes,
            timezone=create_schema.timezone,
            meeting_url=create_schema.meeting_url,
            meeting_provider=create_schema.meeting_provider,
        )
        return await repo.create(event, flush=True)

    async def update_event(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        event_id: UUID,
        update_schema: CoachingEventUpdate,
    ) -> CoachingEvent:
        repo = CoachingEventRepository.from_session(session)
        event = await repo.get_readable_by_id(event_id, auth_subject)
        if event is None:
            raise ResourceNotFound()

        update_dict = update_schema.model_dump(exclude_unset=True)
        # If the start time changes, re-arm reminders for the new window so
        # customers don't get stale notifications.
        if "starts_at" in update_dict:
            update_dict["starts_at"] = _ensure_utc(update_dict["starts_at"])
            update_dict["reminder_24h_sent_at"] = None
            update_dict["reminder_1h_sent_at"] = None

        return await repo.update(event, update_dict=update_dict)

    async def delete_event(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        event_id: UUID,
    ) -> None:
        repo = CoachingEventRepository.from_session(session)
        event = await repo.get_readable_by_id(event_id, auth_subject)
        if event is None:
            raise ResourceNotFound()
        await repo.soft_delete(event)

    async def create_recording_upload(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        event_id: UUID,
    ) -> dict:
        repo = CoachingEventRepository.from_session(session)
        event = await repo.get_readable_by_id(event_id, auth_subject)
        if event is None:
            raise ResourceNotFound()

        upload = await mux_client.create_direct_upload()
        await repo.update(
            event,
            update_dict={
                "recording_mux_upload_id": upload["upload_id"],
                "recording_mux_status": "uploading",
            },
        )
        return upload

    async def list_events_for_course_public(
        self,
        session: AsyncReadSession,
        *,
        course_id: UUID,
    ) -> Sequence[CoachingEvent]:
        """Customer-portal read path. Caller is responsible for verifying the
        customer has an active enrollment on the course before invoking."""
        repo = CoachingEventRepository.from_session(session)
        statement = repo.get_by_course_statement(course_id)
        return await repo.get_all(statement)

    async def is_coaching_course(
        self, session: AsyncReadSession, course_id: UUID
    ) -> bool:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_one_or_none(
            course_repo.get_base_statement().where(Course.id == course_id)
        )
        return bool(course and course.program_format == "coaching")


def _ensure_utc(dt: datetime) -> datetime:
    """Normalise to a tz-aware UTC datetime. Naive datetimes are interpreted
    as UTC — we never silently shift wall-clock times to a server zone."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


coaching_service = CoachingService()


# ── Cohorts ─────────────────────────────────────────────────────────────────

class CohortService:
    async def list_for_course(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        course_id: UUID,
    ) -> list[tuple[CoachingCohort, int]]:
        """List cohorts for a course with member counts."""
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(course_id, auth_subject)
        if course is None:
            raise ResourceNotFound()

        repo = CoachingCohortRepository.from_session(session)
        statement = repo.get_by_course_statement(course_id)
        cohorts = await repo.get_all(statement)

        if not cohorts:
            return []

        count_stmt = (
            select(
                CoachingCohortEnrollment.cohort_id,
                func.count(CoachingCohortEnrollment.id),
            )
            .where(
                CoachingCohortEnrollment.cohort_id.in_([c.id for c in cohorts]),
                CoachingCohortEnrollment.deleted_at.is_(None),
            )
            .group_by(CoachingCohortEnrollment.cohort_id)
        )
        result = await session.execute(count_stmt)
        counts = {row[0]: row[1] for row in result.all()}
        return [(c, counts.get(c.id, 0)) for c in cohorts]

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: CoachingCohortCreate,
    ) -> CoachingCohort:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(
            create_schema.course_id, auth_subject
        )
        if course is None:
            raise ResourceNotFound()
        if course.program_format != "coaching":
            raise CoachingProgramRequired()

        repo = CoachingCohortRepository.from_session(session)
        cohort = CoachingCohort(
            course_id=course.id,
            name=create_schema.name,
            starts_at=_optional_utc(create_schema.starts_at),
            ends_at=_optional_utc(create_schema.ends_at),
            capacity=create_schema.capacity,
            enrollment_open=create_schema.enrollment_open,
            is_default=False,
        )
        return await repo.create(cohort, flush=True)

    async def update(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        cohort_id: UUID,
        update_schema: CoachingCohortUpdate,
    ) -> CoachingCohort:
        repo = CoachingCohortRepository.from_session(session)
        cohort = await repo.get_readable_by_id(cohort_id, auth_subject)
        if cohort is None:
            raise ResourceNotFound()

        update_dict = update_schema.model_dump(exclude_unset=True)
        if "starts_at" in update_dict:
            update_dict["starts_at"] = _optional_utc(update_dict["starts_at"])
        if "ends_at" in update_dict:
            update_dict["ends_at"] = _optional_utc(update_dict["ends_at"])

        return await repo.update(cohort, update_dict=update_dict)

    async def delete(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        cohort_id: UUID,
    ) -> None:
        repo = CoachingCohortRepository.from_session(session)
        cohort = await repo.get_readable_by_id(cohort_id, auth_subject)
        if cohort is None:
            raise ResourceNotFound()
        if cohort.is_default:
            raise SpaireRequestValidationError(
                errors=[
                    {
                        "type": "value_error",
                        "loc": ("cohort_id",),
                        "msg": "The default cohort cannot be deleted.",
                        "input": str(cohort_id),
                    }
                ]
            )
        await repo.soft_delete(cohort)

    async def ensure_default_for_course(
        self, session: AsyncSession, course: Course
    ) -> CoachingCohort:
        """Idempotent: returns the default cohort, creating one if missing.
        Used both at program create time and as a safety net the first time
        someone enrolls (in case the program predates this code)."""
        repo = CoachingCohortRepository.from_session(session)
        existing = await repo.get_one_or_none(
            repo.get_default_for_course_statement(course.id)
        )
        if existing is not None:
            return existing

        cohort = CoachingCohort(
            course_id=course.id,
            name="Main cohort",
            enrollment_open=True,
            is_default=True,
        )
        return await repo.create(cohort, flush=True)

    async def attach_enrollment(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        enrollment: CourseEnrollment,
    ) -> CoachingCohortEnrollment | None:
        """Attach a freshly-created CourseEnrollment to the program's open
        default cohort. Idempotent — if the enrollment already has a row,
        we no-op. Returns None for non-coaching courses.

        Capacity is *not* enforced here. Blocking the grant after a
        successful charge is a chargeback risk; capacity is enforced at
        checkout (via the storefront) and exposed on the cohort read for
        merchants to monitor.
        """
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_one_or_none(
            course_repo.get_base_statement().where(Course.id == course_id)
        )
        if course is None or course.program_format != "coaching":
            return None

        link_repo = CoachingCohortEnrollmentRepository.from_session(session)
        existing = await link_repo.get_one_or_none(
            link_repo.get_by_enrollment_statement(enrollment.id)
        )
        if existing is not None:
            return existing

        cohort = await self.ensure_default_for_course(session, course)
        link = CoachingCohortEnrollment(
            cohort_id=cohort.id,
            enrollment_id=enrollment.id,
            joined_at=utc_now(),
        )
        return await link_repo.create(link, flush=True)

    async def assign_member(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        enrollment_id: UUID,
        cohort_id: UUID,
    ) -> CoachingCohortEnrollment:
        """Move a member to a different cohort. Used from the dashboard
        Members tab when the merchant runs multiple cohorts."""
        cohort_repo = CoachingCohortRepository.from_session(session)
        cohort = await cohort_repo.get_readable_by_id(cohort_id, auth_subject)
        if cohort is None:
            raise ResourceNotFound()

        link_repo = CoachingCohortEnrollmentRepository.from_session(session)
        existing = await link_repo.get_one_or_none(
            link_repo.get_by_enrollment_statement(enrollment_id)
        )
        if existing is not None:
            return await link_repo.update(
                existing, update_dict={"cohort_id": cohort.id}
            )

        # No existing link — make sure the enrollment belongs to this course.
        enrollment_stmt = (
            select(CourseEnrollment)
            .where(
                CourseEnrollment.id == enrollment_id,
                CourseEnrollment.deleted_at.is_(None),
            )
        )
        result = await session.execute(enrollment_stmt)
        enrollment = result.scalar_one_or_none()
        if enrollment is None or enrollment.course_id != cohort.course_id:
            raise ResourceNotFound()

        link = CoachingCohortEnrollment(
            cohort_id=cohort.id,
            enrollment_id=enrollment_id,
            joined_at=utc_now(),
        )
        return await link_repo.create(link, flush=True)

    async def list_members(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        course_id: UUID,
    ) -> list[dict]:
        """Return one row per enrolled customer with cohort assignment,
        progress, and contact info — the dashboard Members tab payload."""
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(course_id, auth_subject)
        if course is None:
            raise ResourceNotFound()

        # Pull enrollments + customers + cohort link in one go.
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
            .where(
                CourseEnrollment.course_id == course_id,
                CourseEnrollment.deleted_at.is_(None),
            )
            .order_by(CourseEnrollment.enrolled_at.desc())
        )
        result = await session.execute(stmt)
        rows = result.all()

        if not rows:
            return []

        # Total published lessons (denominator for progress).
        total_lessons_stmt = (
            select(func.count(CourseLesson.id))
            .join(CourseModule, CourseLesson.module_id == CourseModule.id)
            .where(
                CourseModule.course_id == course_id,
                CourseLesson.deleted_at.is_(None),
                CourseLesson.published.is_(True),
                CourseModule.deleted_at.is_(None),
            )
        )
        total_lessons = (
            await session.execute(total_lessons_stmt)
        ).scalar_one() or 0

        # Per-enrollment completion count.
        enrollment_ids = [row[0].id for row in rows]
        progress_stmt = (
            select(
                CourseLessonProgress.enrollment_id,
                func.count(CourseLessonProgress.id),
            )
            .where(
                CourseLessonProgress.enrollment_id.in_(enrollment_ids),
                CourseLessonProgress.deleted_at.is_(None),
            )
            .group_by(CourseLessonProgress.enrollment_id)
        )
        completion_by_enrollment = {
            row[0]: row[1]
            for row in (await session.execute(progress_stmt)).all()
        }

        out: list[dict] = []
        for enrollment, customer, cohort_id, cohort_name in rows:
            out.append(
                {
                    "enrollment_id": str(enrollment.id),
                    "enrolled_at": enrollment.enrolled_at,
                    "cohort_id": str(cohort_id) if cohort_id else None,
                    "cohort_name": cohort_name,
                    "customer": {
                        "id": str(customer.id),
                        "email": customer.email,
                        "name": customer.name,
                        "avatar_url": getattr(customer, "avatar_url", None),
                    },
                    "completed_lessons": completion_by_enrollment.get(
                        enrollment.id, 0
                    ),
                    "total_lessons": total_lessons,
                }
            )
        return out


def _optional_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return _ensure_utc(dt)


cohort_service = CohortService()


# ── Intake forms ───────────────────────────────────────────────────────────


class IntakeService:
    async def get_form_for_course(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        course_id: UUID,
    ) -> CoachingIntakeForm | None:
        """Creator-side fetch. Returns None if no form has been authored yet
        for this program."""
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(course_id, auth_subject)
        if course is None:
            raise ResourceNotFound()
        repo = CoachingIntakeFormRepository.from_session(session)
        return await repo.get_by_course(course_id)

    async def upsert_form(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: CoachingIntakeFormCreate,
    ) -> CoachingIntakeForm:
        """Each program has at most one form (course_id is unique on
        coaching_intake_forms). This is upsert semantics: caller doesn't
        need to know whether a form already exists."""
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(
            create_schema.course_id, auth_subject
        )
        if course is None:
            raise ResourceNotFound()
        if course.program_format != "coaching":
            raise CoachingProgramRequired()

        repo = CoachingIntakeFormRepository.from_session(session)
        existing = await repo.get_by_course(course.id)
        schema_dict = create_schema.schema_json.model_dump()
        if existing is not None:
            return await repo.update(
                existing,
                update_dict={
                    "title": create_schema.title,
                    "description": create_schema.description,
                    "schema_json": schema_dict,
                    "required_for_access": create_schema.required_for_access,
                },
            )
        form = CoachingIntakeForm(
            course_id=course.id,
            title=create_schema.title,
            description=create_schema.description,
            schema_json=schema_dict,
            required_for_access=create_schema.required_for_access,
        )
        return await repo.create(form, flush=True)

    async def update_form(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        form_id: UUID,
        update_schema: CoachingIntakeFormUpdate,
    ) -> CoachingIntakeForm:
        repo = CoachingIntakeFormRepository.from_session(session)
        form = await repo.get_one_or_none(
            repo.get_readable_statement(auth_subject).where(
                CoachingIntakeForm.id == form_id
            )
        )
        if form is None:
            raise ResourceNotFound()
        update_dict = update_schema.model_dump(exclude_unset=True)
        if "schema_json" in update_dict and update_dict["schema_json"] is not None:
            # IntakeSchema → dict
            schema = update_dict["schema_json"]
            if hasattr(schema, "model_dump"):
                update_dict["schema_json"] = schema.model_dump()
        return await repo.update(form, update_dict=update_dict)

    async def delete_form(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        form_id: UUID,
    ) -> None:
        repo = CoachingIntakeFormRepository.from_session(session)
        form = await repo.get_one_or_none(
            repo.get_readable_statement(auth_subject).where(
                CoachingIntakeForm.id == form_id
            )
        )
        if form is None:
            raise ResourceNotFound()
        await repo.soft_delete(form)

    async def list_responses(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        course_id: UUID,
    ) -> list[dict]:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(course_id, auth_subject)
        if course is None:
            raise ResourceNotFound()

        form_repo = CoachingIntakeFormRepository.from_session(session)
        form = await form_repo.get_by_course(course_id)
        if form is None:
            return []

        stmt = (
            select(CoachingIntakeResponse, Customer)
            .join(Customer, Customer.id == CoachingIntakeResponse.customer_id)
            .where(
                CoachingIntakeResponse.form_id == form.id,
                CoachingIntakeResponse.deleted_at.is_(None),
            )
            .order_by(CoachingIntakeResponse.submitted_at.desc())
        )
        result = await session.execute(stmt)
        return [
            {
                "id": str(response.id),
                "form_id": str(response.form_id),
                "customer_id": str(response.customer_id),
                "enrollment_id": (
                    str(response.enrollment_id) if response.enrollment_id else None
                ),
                "answers": response.answers_json,
                "submitted_at": response.submitted_at,
                "customer_email": customer.email,
                "customer_name": customer.name,
                "created_at": response.created_at,
                "modified_at": response.modified_at,
            }
            for response, customer in result.all()
        ]

    # ── Customer-portal side ────────────────────────────────────────────────

    async def get_form_public(
        self, session: AsyncReadSession, *, course_id: UUID
    ) -> CoachingIntakeForm | None:
        """Customer-portal fetch. The portal endpoint must verify enrollment
        before calling this — the form itself isn't access-controlled."""
        repo = CoachingIntakeFormRepository.from_session(session)
        return await repo.get_by_course(course_id)

    async def get_response_for_customer(
        self,
        session: AsyncReadSession,
        *,
        form_id: UUID,
        customer_id: UUID,
    ) -> CoachingIntakeResponse | None:
        repo = CoachingIntakeResponseRepository.from_session(session)
        return await repo.get_one_or_none(
            repo.get_by_form_and_customer_statement(form_id, customer_id)
        )

    async def submit_response(
        self,
        session: AsyncSession,
        *,
        form: CoachingIntakeForm,
        customer_id: UUID,
        enrollment_id: UUID | None,
        answers: dict,
    ) -> CoachingIntakeResponse:
        """Idempotent: re-submitting overwrites the previous answers and
        bumps submitted_at. Validation against the schema is done in the
        endpoint (so we can return a 422 with a proper error)."""
        repo = CoachingIntakeResponseRepository.from_session(session)
        existing = await repo.get_one_or_none(
            repo.get_by_form_and_customer_statement(form.id, customer_id)
        )
        if existing is not None:
            return await repo.update(
                existing,
                update_dict={
                    "answers_json": answers,
                    "enrollment_id": enrollment_id,
                    "submitted_at": utc_now(),
                },
            )
        response = CoachingIntakeResponse(
            form_id=form.id,
            customer_id=customer_id,
            enrollment_id=enrollment_id,
            answers_json=answers,
            submitted_at=utc_now(),
        )
        return await repo.create(response, flush=True)


def validate_intake_answers(form: CoachingIntakeForm, answers: dict) -> list[str]:
    """Pure validation helper: returns the list of error strings (empty when
    the submission is acceptable). Live in the service module so endpoint
    + tests can both reuse it."""
    schema = form.schema_json or {}
    fields = schema.get("fields", []) if isinstance(schema, dict) else []
    errors: list[str] = []
    for field in fields:
        fid = field.get("id")
        ftype = field.get("type")
        required = bool(field.get("required"))
        if not fid or not ftype:
            continue
        value = answers.get(fid)
        is_empty = (
            value is None
            or (isinstance(value, str) and not value.strip())
            or (isinstance(value, list) and len(value) == 0)
        )
        if required and is_empty:
            errors.append(f"{fid}: required")
            continue
        if is_empty:
            continue
        if ftype in {"short_text", "long_text", "select", "email"}:
            if not isinstance(value, str):
                errors.append(f"{fid}: expected string")
            elif ftype == "email" and "@" not in value:
                errors.append(f"{fid}: invalid email")
            elif ftype == "select":
                options = field.get("options") or []
                if options and value not in options:
                    errors.append(f"{fid}: not a valid option")
        elif ftype == "multiselect":
            if not isinstance(value, list) or not all(
                isinstance(v, str) for v in value
            ):
                errors.append(f"{fid}: expected list of strings")
            else:
                options = field.get("options") or []
                if options and any(v not in options for v in value):
                    errors.append(f"{fid}: contains invalid option")
    return errors


intake_service = IntakeService()


# ── Community posts ─────────────────────────────────────────────────────────


class CommunityService:
    """Program-level discussion board.

    Two write paths converge here:
      - Customer side: posts owned by an enrollment_id, content under
        moderation.
      - Creator side: coach posts (is_creator=True, no enrollment), plus
        moderation actions (pin/hide) on any post in their org.
    """

    async def list_threads(
        self,
        session: AsyncReadSession,
        *,
        course_id: UUID,
        include_hidden: bool = False,
    ) -> list[dict]:
        """Returns top-level posts with a small snapshot of replies. The
        author 'name' is resolved via the customer record on the
        enrollment. Coach posts surface organization name in the renderer
        (frontend concern)."""
        repo = CoachingPostRepository.from_session(session)

        top_stmt = repo.get_top_level_for_course_statement(
            course_id, include_hidden=include_hidden
        )
        top_posts = list(await repo.get_all(top_stmt))
        if not top_posts:
            return []

        replies_stmt = repo.get_replies_for_parents_statement(
            [p.id for p in top_posts], include_hidden=include_hidden
        )
        replies = list(await repo.get_all(replies_stmt))

        # Resolve enrollment → customer name in one round-trip.
        enrollment_ids = {
            p.enrollment_id
            for p in top_posts + replies
            if p.enrollment_id is not None
        }
        customer_by_enrollment: dict[UUID, Customer] = {}
        if enrollment_ids:
            stmt = (
                select(CourseEnrollment, Customer)
                .join(Customer, Customer.id == CourseEnrollment.customer_id)
                .where(CourseEnrollment.id.in_(enrollment_ids))
            )
            for enrollment, customer in (await session.execute(stmt)).all():
                customer_by_enrollment[enrollment.id] = customer

        def _author(post: CoachingPost) -> dict:
            customer = (
                customer_by_enrollment.get(post.enrollment_id)
                if post.enrollment_id
                else None
            )
            return {
                "enrollment_id": post.enrollment_id,
                "name": (customer.name or customer.email) if customer else None,
                "is_creator": post.is_creator,
            }

        replies_by_parent: dict[UUID, list[CoachingPost]] = {}
        for reply in replies:
            replies_by_parent.setdefault(reply.parent_id, []).append(reply)

        out: list[dict] = []
        for post in top_posts:
            child_list = replies_by_parent.get(post.id, [])
            out.append(
                {
                    "id": post.id,
                    "course_id": post.course_id,
                    "parent_id": None,
                    "content": post.content,
                    "is_creator": post.is_creator,
                    "pinned": post.pinned,
                    "hidden": post.hidden,
                    "author": _author(post),
                    "reply_count": len(child_list),
                    "created_at": post.created_at,
                    "modified_at": post.modified_at,
                    "replies": [
                        {
                            "id": r.id,
                            "course_id": r.course_id,
                            "parent_id": r.parent_id,
                            "content": r.content,
                            "is_creator": r.is_creator,
                            "pinned": r.pinned,
                            "hidden": r.hidden,
                            "author": _author(r),
                            "reply_count": 0,
                            "created_at": r.created_at,
                            "modified_at": r.modified_at,
                        }
                        for r in child_list
                    ],
                }
            )
        return out

    async def list_threads_for_creator(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        course_id: UUID,
    ) -> list[dict]:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(course_id, auth_subject)
        if course is None:
            raise ResourceNotFound()
        return await self.list_threads(
            session, course_id=course_id, include_hidden=True
        )

    async def post_as_customer(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        enrollment: CourseEnrollment,
        content: str,
        parent_id: UUID | None,
    ) -> CoachingPost:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_one_or_none(
            course_repo.get_base_statement().where(Course.id == course_id)
        )
        if course is None:
            raise ResourceNotFound()
        if not course.community_enabled:
            raise SpaireRequestValidationError(
                errors=[
                    {
                        "type": "value_error",
                        "loc": ("course_id",),
                        "msg": "Community is not enabled for this program.",
                        "input": str(course_id),
                    }
                ]
            )

        repo = CoachingPostRepository.from_session(session)
        if parent_id is not None:
            parent = await repo.get_by_id(parent_id)
            if (
                parent is None
                or parent.course_id != course_id
                or parent.parent_id is not None
            ):
                raise SpaireRequestValidationError(
                    errors=[
                        {
                            "type": "value_error",
                            "loc": ("parent_id",),
                            "msg": "Invalid parent post (one-deep threading).",
                            "input": str(parent_id),
                        }
                    ]
                )

        post = CoachingPost(
            course_id=course_id,
            enrollment_id=enrollment.id,
            parent_id=parent_id,
            content=content,
            is_creator=False,
        )
        return await repo.create(post, flush=True)

    async def post_as_creator(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        course_id: UUID,
        content: str,
        parent_id: UUID | None,
    ) -> CoachingPost:
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_readable_by_id(course_id, auth_subject)
        if course is None:
            raise ResourceNotFound()
        if course.program_format != "coaching":
            raise CoachingProgramRequired()

        repo = CoachingPostRepository.from_session(session)
        if parent_id is not None:
            parent = await repo.get_by_id(parent_id)
            if (
                parent is None
                or parent.course_id != course_id
                or parent.parent_id is not None
            ):
                raise SpaireRequestValidationError(
                    errors=[
                        {
                            "type": "value_error",
                            "loc": ("parent_id",),
                            "msg": "Invalid parent post (one-deep threading).",
                            "input": str(parent_id),
                        }
                    ]
                )

        post = CoachingPost(
            course_id=course_id,
            enrollment_id=None,
            parent_id=parent_id,
            content=content,
            is_creator=True,
        )
        return await repo.create(post, flush=True)

    async def moderate_post(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        post_id: UUID,
        pinned: bool | None,
        hidden: bool | None,
    ) -> CoachingPost:
        """Pin/unpin or hide/unhide. Pinning a reply is a no-op (rejected
        by the schema if you tried to set pinned on a reply, but we also
        guard here)."""
        repo = CoachingPostRepository.from_session(session)
        post = await repo.get_one_or_none(
            repo.get_readable_statement(auth_subject).where(
                CoachingPost.id == post_id
            )
        )
        if post is None:
            raise ResourceNotFound()

        update_dict: dict = {}
        if pinned is not None:
            if post.parent_id is not None and pinned:
                raise SpaireRequestValidationError(
                    errors=[
                        {
                            "type": "value_error",
                            "loc": ("pinned",),
                            "msg": "Replies cannot be pinned.",
                            "input": True,
                        }
                    ]
                )
            update_dict["pinned"] = pinned
        if hidden is not None:
            update_dict["hidden"] = hidden
        if not update_dict:
            return post
        return await repo.update(post, update_dict=update_dict)

    async def delete_post_as_creator(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        post_id: UUID,
    ) -> None:
        repo = CoachingPostRepository.from_session(session)
        post = await repo.get_one_or_none(
            repo.get_readable_statement(auth_subject).where(
                CoachingPost.id == post_id
            )
        )
        if post is None:
            raise ResourceNotFound()
        await repo.soft_delete(post)

    async def delete_post_as_customer(
        self,
        session: AsyncSession,
        *,
        post_id: UUID,
        enrollment_id: UUID,
    ) -> None:
        """Customers can only delete their own posts."""
        repo = CoachingPostRepository.from_session(session)
        post = await repo.get_by_id(post_id)
        if post is None:
            raise ResourceNotFound()
        if post.enrollment_id != enrollment_id:
            raise ResourceNotFound()  # don't disclose existence
        await repo.soft_delete(post)


community_service = CommunityService()
