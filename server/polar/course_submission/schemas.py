from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema


# ── Challenge ────────────────────────────────────────────────────────────


class ChallengeBase(Schema):
    title: str = Field(min_length=1, max_length=500)
    prompt: str = Field(default="", max_length=4000)
    accepts_media: bool = True
    accepts_video: bool = False
    accepts_text: bool = True
    due_after_days: int | None = Field(default=None, ge=0, le=365)
    published: bool = True


class ChallengeCreate(ChallengeBase):
    """Creator creates a challenge anchored to a module.

    `position` is auto-assigned by the service (last+1) — creators reorder
    via a separate PATCH that flows through ChallengeUpdate.
    """

    module_id: UUID4
    ai_generated: bool = False


class ChallengeUpdate(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    prompt: str | None = Field(default=None, max_length=4000)
    accepts_media: bool | None = None
    accepts_video: bool | None = None
    accepts_text: bool | None = None
    due_after_days: int | None = Field(default=None, ge=0, le=365)
    published: bool | None = None
    position: int | None = Field(default=None, ge=0)


class ChallengeRead(TimestampedSchema, ChallengeBase):
    """Public read shape — emitted to both creator + students."""

    id: UUID4
    course_id: UUID4
    module_id: UUID4
    position: int
    ai_generated: bool
    # Aggregate stats only — not embedding the submission rows here.
    submission_count: int = 0
    # The current authenticated student's own submission for this
    # challenge, if any. NULL on the creator side (always — creator's
    # own submission concept doesn't apply).
    my_submission_id: UUID4 | None = None


# ── Submission media + reactions ─────────────────────────────────────────


class SubmissionMediaRead(Schema):
    id: UUID4
    kind: str  # "image" | "video"
    url: str | None
    # v0.1 ships image only; the Mux fields are emitted as null and will
    # carry real values once video submissions land.
    mux_playback_id: str | None = None
    mux_status: str | None = None
    position: int


class SubmissionMediaInput(Schema):
    """Inline media payload on submission create/update.

    The student uploads the image to S3 via the existing file-presign
    flow, then submits the URL here. v0.1 is image-only; videos add a
    Mux flow that hangs off the same endpoint with kind="video".
    """

    kind: str = Field(pattern=r"^(image|video)$")
    url: str | None = Field(default=None, max_length=2048)
    position: int = Field(default=0, ge=0)


class ReactionRead(Schema):
    id: UUID4
    actor_type: str  # "creator" | "student"
    actor_user_id: UUID4
    emoji: str


class ReactionInput(Schema):
    emoji: str = Field(min_length=1, max_length=16)


# ── Submission ───────────────────────────────────────────────────────────


class SubmissionAuthor(Schema):
    """Minimal author shape rendered next to a submission card."""

    enrollment_id: UUID4
    display_name: str
    avatar_url: str | None = None


class SubmissionRead(TimestampedSchema):
    id: UUID4
    challenge_id: UUID4
    course_id: UUID4
    enrollment_id: UUID4
    status: str  # "draft" | "submitted" | "hidden"
    submitted_at: str | None  # ISO timestamp — Pydantic will coerce datetime
    caption: str
    media: list[SubmissionMediaRead]
    reactions: list[ReactionRead]
    author: SubmissionAuthor
    # The challenge title is attached so the creator inbox can render
    # cards without a separate join in the client.
    challenge_title: str | None = None


class SubmissionCreate(Schema):
    """Student-side create/upsert payload.

    Atomic on (challenge, enrollment): if the student has an existing
    non-deleted submission for this challenge, the service updates that
    row instead of creating a duplicate. Hitting `submit` then transitions
    it to status="submitted" and stamps submitted_at.
    """

    caption: str = Field(default="", max_length=2000)
    media: list[SubmissionMediaInput] = Field(default_factory=list)


class SubmissionUpdateVisibility(Schema):
    """Creator-side visibility toggle. Hidden submissions are still
    readable by the original student and the creator, but drop out of
    the public gallery for the rest of the class."""

    hidden: bool
