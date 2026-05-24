from datetime import datetime
from typing import Literal

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema

from .sorting import CommunityPostSortProperty

# =====================================================================
# Settings
# =====================================================================


class CommunitySettingsRead(TimestampedSchema):
    id: UUID4
    course_id: UUID4
    enabled: bool
    show_in_portal_tabs: bool
    comments_mode: Literal["visible", "hidden", "locked"]
    hero_thumbnail_url: str | None = None
    hero_thumbnail_object_position: str | None = None
    feed_title_override: str | None = None
    feed_eyebrow_override: str | None = None
    module_label_overrides: dict | None = None
    module_order: list | None = None
    reactions_enabled: bool
    milestones_enabled: bool
    watching_rail_enabled: bool
    watching_rail_threshold: int
    presence_blurb: str | None = None
    prompt_of_week_post_id: UUID4 | None = None


class CommunitySettingsUpdate(Schema):
    """Creator-side PATCH. Any field omitted is left unchanged."""

    enabled: bool | None = None
    show_in_portal_tabs: bool | None = None
    comments_mode: Literal["visible", "hidden", "locked"] | None = None
    hero_thumbnail_url: str | None = Field(default=None, max_length=500)
    hero_thumbnail_object_position: str | None = Field(default=None, max_length=32)
    feed_title_override: str | None = Field(default=None, max_length=120)
    feed_eyebrow_override: str | None = Field(default=None, max_length=120)
    module_label_overrides: dict | None = None
    module_order: list[UUID4] | None = None
    reactions_enabled: bool | None = None
    milestones_enabled: bool | None = None
    watching_rail_enabled: bool | None = None
    watching_rail_threshold: int | None = Field(default=None, ge=1)
    presence_blurb: str | None = None
    prompt_of_week_post_id: UUID4 | None = None


# =====================================================================
# Tags
# =====================================================================


class CommunityTagRead(TimestampedSchema):
    id: UUID4
    course_id: UUID4
    slug: str
    label: str
    position: int


class CommunityTagCreate(Schema):
    slug: str = Field(min_length=1, max_length=50)
    label: str = Field(min_length=1, max_length=50)
    position: int = 0


class CommunityTagUpdate(Schema):
    label: str | None = Field(default=None, min_length=1, max_length=50)
    position: int | None = None


# =====================================================================
# Author resolution — discriminated by `kind`
# =====================================================================


class CommunityAuthorInstructor(Schema):
    """Creator/admin-side author. `user_id` is included so the client can
    pair posts authored under the same instructor identity, e.g. to badge
    them as "Instructor"."""

    kind: Literal["instructor"] = "instructor"
    user_id: UUID4
    name: str | None = None
    avatar_url: str | None = None


class CommunityAuthorStudent(Schema):
    """Enrolled-student author. `enrollment_id` is the stable identity in
    the community context; we don't surface customer_id here so the API
    stays customer-PII-light."""

    kind: Literal["student"] = "student"
    enrollment_id: UUID4
    name: str | None = None
    avatar_url: str | None = None


CommunityAuthor = CommunityAuthorInstructor | CommunityAuthorStudent


# =====================================================================
# Reactions
# =====================================================================


# Mirrors the CHECK constraint in the migration and the
# COMMUNITY_REACTION_EMOJIS tuple on the model. Kept here so OpenAPI
# documents the allowed values without importing the model.
CommunityReactionEmoji = Literal["clap", "heart", "fire", "idea", "pray"]


class CommunityReactionSummaryEntry(Schema):
    """One emoji's row on a post or comment. `mine` is true when the
    current viewer has reacted with this emoji."""

    emoji: CommunityReactionEmoji
    count: int
    mine: bool = False


class CommunityReactionToggle(Schema):
    """POST body for `/react`. The server toggles — if the row exists
    it's deleted, otherwise inserted."""

    emoji: CommunityReactionEmoji


class CommunityReactionToggleResult(Schema):
    """Returned by the toggle endpoint so optimistic clients have a
    server-confirmed count to settle on."""

    emoji: CommunityReactionEmoji
    active: bool
    count: int


# =====================================================================
# Posts
# =====================================================================


class CommunityPostMediaRead(Schema):
    id: UUID4
    media_type: Literal["image", "video"]
    position: int
    # Image branch.
    file_id: UUID4 | None = None
    # Video branch — Phase 1 ships text only but the schema is forward-
    # compatible so the client doesn't need a migration in Phase 3.
    mux_playback_id: str | None = None
    mux_status: str | None = None
    duration_seconds: int | None = None
    thumbnail_url: str | None = None


class CommunityLessonChip(Schema):
    """Resolved `re: Module — Lesson` chip shown above the post body."""

    lesson_id: UUID4
    lesson_title: str
    module_id: UUID4 | None = None
    module_title: str | None = None


class CommunityPostCreate(Schema):
    # Phase 1 ships text only. Video lands in Phase 3 alongside Mux.
    type: Literal["text"] = "text"
    title: str | None = Field(default=None, max_length=280)
    body: str = Field(min_length=1, max_length=20_000)
    body_format: Literal["markdown", "plain"] = "markdown"
    lesson_id: UUID4 | None = None
    tag_id: UUID4 | None = None
    # If the creator wants to schedule into the future; omitted means
    # publish-now. Drafts go through a separate flag once added.
    publish_at: datetime | None = None


class CommunityPostUpdate(Schema):
    """Owner-side update. Body edits flag the post as `modified_at`; the
    client can choose to surface that as "edited"."""

    title: str | None = Field(default=None, max_length=280)
    body: str | None = Field(default=None, min_length=1, max_length=20_000)
    tag_id: UUID4 | None = None


class CommunityPinPayload(Schema):
    pin_type: Literal["announcement", "prompt_of_week"]
    # When null, the pin sticks until manually unpinned. Default cap of
    # 7 days is applied in the service when omitted.
    expires_at: datetime | None = None


class CommunityPostRead(TimestampedSchema):
    id: UUID4
    course_id: UUID4
    type: Literal["text", "video"]
    title: str | None
    body: str
    body_format: Literal["markdown", "plain"]
    author: CommunityAuthor = Field(discriminator="kind")
    lesson: CommunityLessonChip | None = None
    tag: CommunityTagRead | None = None
    media: list[CommunityPostMediaRead] = Field(default_factory=list)
    published_at: datetime | None
    pinned_at: datetime | None = None
    pin_type: Literal["announcement", "prompt_of_week"] | None = None
    pin_expires_at: datetime | None = None
    comments_mode: Literal["visible", "hidden", "locked"] | None = None
    reaction_count: int = 0
    comment_count: int = 0
    reactions: list[CommunityReactionSummaryEntry] = Field(default_factory=list)


# =====================================================================
# Comments
# =====================================================================


class CommunityCommentCreate(Schema):
    content: str = Field(min_length=1, max_length=5_000)
    parent_id: UUID4 | None = None
    # Only set on video-post replies — the scrubber UI clusters by this.
    timestamp_seconds: int | None = Field(default=None, ge=0)


class CommunityCommentRead(TimestampedSchema):
    id: UUID4
    post_id: UUID4
    parent_id: UUID4 | None
    author: CommunityAuthor = Field(discriminator="kind")
    # Soft-deleted comments come back with content='' and deleted=True so
    # the reply chain stays renderable as a tombstone — same pattern as
    # lesson_comments.
    content: str
    timestamp_seconds: int | None = None
    deleted: bool = False
    is_own: bool = False
    reactions: list[CommunityReactionSummaryEntry] = Field(default_factory=list)


# =====================================================================
# Picker — customer-portal "which communities can I access?"
# =====================================================================


class CommunityCourseSummary(Schema):
    """One row in the customer-portal picker. `community_enabled` is
    false when the creator hasn't enabled the feed for this course yet
    (or the settings row doesn't exist at all)."""

    course_id: UUID4
    course_title: str | None
    course_thumbnail_url: str | None
    course_thumbnail_object_position: str | None
    community_enabled: bool


# =====================================================================
# Feed
# =====================================================================


class CommunityFeedFilters(Schema):
    """Read-only query-param container. Each field becomes a `?key=val`
    on the feed endpoint."""

    sort: CommunityPostSortProperty = CommunityPostSortProperty.recent
    module_id: UUID4 | None = None
    lesson_id: UUID4 | None = None
    tag_id: UUID4 | None = None


# Cursor format: base64(`<iso-timestamp>_<uuid>`). The repository decodes
# this to a (sort_key, id) tuple and seeds the next page's WHERE clause.
class CommunityFeedCursor(Schema):
    cursor: str | None = None
    limit: int = Field(default=20, ge=1, le=50)
