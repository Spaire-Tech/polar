"""Pydantic schemas for community events + RSVPs.

Kept in a separate file (events_schemas.py) rather than appended to
schemas.py so the event/RSVP surface is easy to find and review."""

from datetime import datetime
from typing import Literal

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema

EventType = Literal["workshop", "office", "cohort", "guest"]


class CommunityEventHost(Schema):
    """Lightweight host identity. The host is always the course owner
    (an org-side User) — we surface the display name from the course's
    `instructor_name` (set in course settings) and fall back to the
    user's name/email if it's unset."""

    user_id: UUID4
    name: str
    avatar_url: str | None = None


class CommunityEventRead(TimestampedSchema):
    id: UUID4
    course_id: UUID4
    title: str
    type: EventType
    description: str | None = None
    start_at: datetime
    duration_minutes: int
    meeting_url: str | None = None
    location: str | None = None
    replay_url: str | None = None
    cover_url: str | None = None
    recurring_weekly: bool
    notify_on_publish: bool
    rsvp_count: int
    host: CommunityEventHost

    # Per-viewer + derived fields. `going` is from the RSVP join for the
    # current customer (always False when viewed by the host). `live`
    # and `past` are computed from start_at + duration_minutes vs now().
    going: bool = False
    live: bool = False
    past: bool = False


class CommunityEventCreate(Schema):
    title: str = Field(min_length=1, max_length=200)
    type: EventType
    description: str | None = Field(default=None, max_length=4000)
    start_at: datetime
    duration_minutes: int = Field(ge=5, le=600, default=60)
    meeting_url: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=500)
    cover_url: str | None = Field(default=None, max_length=2000)
    recurring_weekly: bool = False
    notify_on_publish: bool = True


class CommunityEventUpdate(Schema):
    """PATCH — every field optional. The host pastes `replay_url` here
    after the event ends to clear the replay-nag schedule."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    type: EventType | None = None
    description: str | None = Field(default=None, max_length=4000)
    start_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=600)
    meeting_url: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=500)
    replay_url: str | None = Field(default=None, max_length=2000)
    cover_url: str | None = Field(default=None, max_length=2000)
    recurring_weekly: bool | None = None


class CommunityEventRsvpResult(Schema):
    """Returned from POST/DELETE /events/{id}/rsvp — the new state plus
    the updated counter so the UI doesn't need a second fetch."""

    going: bool
    rsvp_count: int
