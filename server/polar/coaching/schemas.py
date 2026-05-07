from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema, TimestampedSchema

EventStatus = Literal["scheduled", "cancelled"]
MeetingProvider = Literal["zoom", "google_meet", "whereby", "riverside", "other"]


class CoachingEventBase(Schema):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    agenda: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Free-form agenda payload. Editor convention: "
            '{"items": [{"text": "..."}, ...]}'
        ),
    )
    starts_at: datetime
    duration_minutes: int = Field(default=60, ge=5, le=480)
    timezone: str | None = Field(
        default=None,
        max_length=64,
        description="IANA timezone the event was authored in (display only).",
    )
    meeting_url: str | None = Field(default=None, max_length=2048)
    meeting_provider: MeetingProvider | None = None


class CoachingEventCreate(CoachingEventBase):
    course_id: UUID


class CoachingEventUpdate(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    agenda: dict[str, Any] | None = None
    starts_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=480)
    timezone: str | None = Field(default=None, max_length=64)
    meeting_url: str | None = Field(default=None, max_length=2048)
    meeting_provider: MeetingProvider | None = None
    status: EventStatus | None = None


class CoachingEventRead(TimestampedSchema, CoachingEventBase):
    id: UUID
    course_id: UUID
    status: EventStatus
    recording_mux_upload_id: str | None = None
    recording_mux_asset_id: str | None = None
    recording_mux_playback_id: str | None = None
    recording_mux_status: str | None = None
    recording_released_at: datetime | None = None


class CoachingMuxUploadRead(Schema):
    """Mirror of the course MuxUploadRead — used when the coach uploads a
    post-event recording."""

    upload_id: str
    upload_url: str


# ── Cohorts ────────────────────────────────────────────────────────────────


class CoachingCohortBase(Schema):
    name: str = Field(min_length=1, max_length=200)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    capacity: int | None = Field(default=None, ge=1)
    enrollment_open: bool = True


class CoachingCohortCreate(CoachingCohortBase):
    course_id: UUID


class CoachingCohortUpdate(Schema):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    capacity: int | None = Field(default=None, ge=1)
    enrollment_open: bool | None = None


class CoachingCohortRead(TimestampedSchema, CoachingCohortBase):
    id: UUID
    course_id: UUID
    is_default: bool
    member_count: int = 0


# ── Members (enrolled customers in a coaching program) ─────────────────────


class CoachingMemberCustomer(Schema):
    id: UUID
    email: str | None = None
    name: str | None = None
    avatar_url: str | None = None


class CoachingMemberRead(Schema):
    enrollment_id: UUID
    enrolled_at: datetime
    cohort_id: UUID | None = None
    cohort_name: str | None = None
    customer: CoachingMemberCustomer
    completed_lessons: int = 0
    total_lessons: int = 0


class CoachingMemberAssignCohort(Schema):
    cohort_id: UUID
