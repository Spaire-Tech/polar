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
)
from .schemas import (
    CoachingCohortCreate,
    CoachingCohortUpdate,
    CoachingEventCreate,
    CoachingEventUpdate,
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
        return await repo.create(event)

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
