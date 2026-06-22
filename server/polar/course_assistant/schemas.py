from datetime import datetime
from typing import Any

from pydantic import Field

from polar.kit.schemas import Schema


class CourseAssistantAskRequest(Schema):
    question: str = Field(
        min_length=1,
        max_length=4000,
        description="The student's question for the course assistant.",
    )


class CourseAssistantStatusRead(Schema):
    """Drives the student-facing chat empty-state in the course player."""

    available: bool = Field(
        description="Whether a live assistant exists for this course."
    )
    display_name: str | None = Field(
        default=None, description='Name shown to students, e.g. "Carla".'
    )
    instructor_name: str | None = Field(default=None)
    disclaimer: str | None = Field(
        default=None,
        description="AI-version disclaimer to show in the chat.",
    )
    example_question: str | None = Field(
        default=None,
        description="One example question to lower the blank-page barrier.",
    )


# ── Creator-facing (Phase 3 review & approve) ─────────────────────────────── #


class CourseAssistantManageRead(Schema):
    """Creator-facing management view (the Assistant tab)."""

    course_id: str
    # building | ready_for_review | live | failed | disabled
    status: str
    configured: bool = Field(
        description="Whether ANTHROPIC_API_KEY is set; false ⇒ feature off."
    )
    live: bool = Field(description="Currently serving students.")
    is_answerable: bool = Field(
        description="Live AND has an approved serving snapshot."
    )
    has_pending_review: bool = Field(
        description="A newer draft exists than what was last approved."
    )
    display_name: str | None = None
    disclaimer: str | None = None
    model: str | None = None
    error: str | None = None
    # The draft snapshot is what the creator reviews.
    sample_questions: list[dict[str, Any]] | None = None
    draft_lesson_count: int | None = None
    draft_tokens: int | None = None
    draft_built_at: datetime | None = None
    approved_at: datetime | None = None
    approved_lesson_count: int | None = None


class CourseAssistantApproveRequest(Schema):
    """Approve the draft and go live. Optional identity tweaks applied first."""

    display_name: str | None = Field(default=None, max_length=200)
    disclaimer: str | None = Field(default=None, max_length=2000)


class CourseAssistantSettingsUpdate(Schema):
    """Edit identity without (re)approving. None ⇒ leave unchanged."""

    display_name: str | None = Field(default=None, max_length=200)
    disclaimer: str | None = Field(default=None, max_length=2000)


class CourseAssistantLiveUpdate(Schema):
    live: bool = Field(description="Turn the live assistant on or off.")
