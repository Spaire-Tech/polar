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
