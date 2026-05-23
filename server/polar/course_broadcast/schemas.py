from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema


class BroadcastBase(Schema):
    title: str = Field(min_length=1, max_length=500)
    body: str = Field(default="", max_length=20000)
    image_url: str | None = Field(default=None, max_length=2048)
    week_number: int | None = Field(default=None, ge=1, le=520)
    notify_on_publish: bool = True
    # When set, the broadcast publishes automatically at this time via
    # the periodic worker. Only meaningful while published_at is NULL.
    scheduled_at: datetime | None = None


class BroadcastCreate(BroadcastBase):
    """Creator drafts a broadcast under a course.

    Drafts are created with `publish=False` (default) — the creator hits
    Publish separately to fan out notifications.
    """

    course_id: UUID4
    publish: bool = False


class BroadcastUpdate(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    body: str | None = Field(default=None, max_length=20000)
    image_url: str | None = Field(default=None, max_length=2048)
    week_number: int | None = Field(default=None, ge=1, le=520)
    notify_on_publish: bool | None = None
    scheduled_at: datetime | None = None


class BroadcastRead(TimestampedSchema, BroadcastBase):
    """Creator-side read shape. Includes draft state via `published_at`."""

    id: UUID4
    course_id: UUID4
    created_by_user_id: UUID4 | None = None
    published_at: datetime | None = None
    # Resolved at serialization. None when the author user has been
    # deleted or the broadcast was authored by an organization token.
    author_display_name: str | None = None


class BroadcastStudentRead(Schema):
    """Student-side read shape. Drafts are never serialized — the feed
    endpoint filters them out so this schema can assume `published_at`
    is set. Strips creator-only metadata (notify_on_publish, audit fields).
    """

    id: UUID4
    title: str
    body: str
    image_url: str | None = None
    week_number: int | None = None
    published_at: datetime
    # Resolved server-side from created_by_user_id; falls back to None
    # for org-token-authored broadcasts so the student-side UI can
    # default to the course instructor's name.
    author_display_name: str | None = None
