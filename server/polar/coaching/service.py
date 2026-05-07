from datetime import UTC, datetime
from typing import Sequence
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.course import mux as mux_client
from polar.course.repository import CourseRepository
from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.models.coaching_event import CoachingEvent
from polar.models.course import Course
from polar.postgres import AsyncReadSession, AsyncSession
from .repository import CoachingEventRepository
from .schemas import CoachingEventCreate, CoachingEventUpdate


class CoachingProgramRequired(PolarRequestValidationError):
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
