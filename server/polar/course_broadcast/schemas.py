from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema


class BroadcastBase(Schema):
    title: str = Field(min_length=1, max_length=500)
    body: str = Field(default="", max_length=20000)
    image_url: str | None = Field(default=None, max_length=2048)
    week_number: int | None = Field(default=None, ge=1, le=520)
    notify_on_publish: bool = True


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


class BroadcastRead(TimestampedSchema, BroadcastBase):
    """Creator-side read shape. Includes draft state via `published_at`."""

    id: UUID4
    course_id: UUID4
    created_by_user_id: UUID4 | None = None
    published_at: datetime | None = None


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
