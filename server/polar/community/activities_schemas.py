"""Pydantic schemas for community activities + submissions."""

from datetime import datetime
from typing import Literal

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema

ActivitySubmissionType = Literal["photo", "video", "text", "link"]
ActivityStatus = Literal["open", "closed"]
ActivityChannelKind = Literal["module", "lesson"]


class CommunityActivityHost(Schema):
    user_id: UUID4
    name: str
    avatar_url: str | None = None


class CommunityActivitySubmissionRead(TimestampedSchema):
    id: UUID4
    activity_id: UUID4
    submission_type: ActivitySubmissionType
    body: str | None = None
    file_id: UUID4 | None = None
    file_url: str | None = None
    mux_playback_id: str | None = None
    link_url: str | None = None

    # Submitter identity. We surface the customer's display name +
    # avatar; never the customer_id (PII).
    author_name: str
    author_avatar_url: str | None = None
    is_own: bool = False


class CommunityActivityRead(TimestampedSchema):
    id: UUID4
    course_id: UUID4
    channel_kind: ActivityChannelKind
    module_id: UUID4 | None = None
    lesson_id: UUID4 | None = None
    channel_label: str | None = None  # resolved server-side for the card chip
    title: str
    description: str | None = None
    submission_type: ActivitySubmissionType
    status: ActivityStatus
    pin_to_feed: bool
    notify_on_publish: bool
    submission_count: int
    # Number of distinct customers who have submitted at least once. The
    # progress bar shows distinct, not raw count.
    distinct_submitter_count: int = 0
    host: CommunityActivityHost
    # Per-viewer.
    has_own_submission: bool = False


class CommunityActivityCreate(Schema):
    channel_kind: ActivityChannelKind
    module_id: UUID4 | None = None
    lesson_id: UUID4 | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    submission_type: ActivitySubmissionType
    pin_to_feed: bool = False
    notify_on_publish: bool = True


class CommunityActivityUpdate(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    submission_type: ActivitySubmissionType | None = None
    pin_to_feed: bool | None = None
    status: ActivityStatus | None = None


class CommunityActivitySubmissionCreate(Schema):
    submission_type: ActivitySubmissionType
    body: str | None = Field(default=None, max_length=4000)
    file_id: UUID4 | None = None
    mux_upload_id: str | None = None
    link_url: str | None = Field(default=None, max_length=2000)


_ = datetime  # for explicit reference where needed
