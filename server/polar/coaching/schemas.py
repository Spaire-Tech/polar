from datetime import date, datetime
from typing import Any, Literal

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema


CoachingFormat = Literal["self", "cohort", "hybrid"]
CoachingPricingModel = Literal["onetime", "subscription", "plan"]
CoachingAccessDuration = Literal["lifetime", "3m", "6m", "12m", "cohort"]


class CoachingProgramBase(Schema):
    title: str | None = Field(None, max_length=500)
    slug: str | None = Field(None, max_length=200)
    format: CoachingFormat = "self"
    cohort_start: date | None = None
    cohort_end: date | None = None
    weeks: int | None = None
    description: str | None = None
    promise: str | None = None
    coach_name: str | None = Field(None, max_length=200)
    coach_bio: str | None = None
    coach_credentials: str | None = Field(None, max_length=500)
    coach_photo_url: str | None = Field(None, max_length=500)
    thumbnail_url: str | None = Field(None, max_length=500)
    trailer_url: str | None = Field(None, max_length=2048)
    pricing_model: CoachingPricingModel | None = None
    access_duration: CoachingAccessDuration | None = None
    free_preview: bool = False
    landing_data: dict[str, Any] | None = None
    intake_questions: list[str] | None = None
    session_ideas: list[str] | None = None
    ai_generated: bool = False
    course_id: UUID4 | None = None
    published_at: datetime | None = None


class CoachingProgramCreate(CoachingProgramBase):
    product_id: UUID4
    organization_id: UUID4


class CoachingDraftCreate(Schema):
    """Empty/draft program creation. The wizard creates a Product first, then
    immediately calls this to seed the coaching program with whatever it
    knows so far (typically just the title)."""

    product_id: UUID4
    organization_id: UUID4
    title: str | None = Field(None, max_length=500)


class CoachingProgramUpdate(Schema):
    title: str | None = None
    slug: str | None = None
    format: CoachingFormat | None = None
    cohort_start: date | None = None
    cohort_end: date | None = None
    weeks: int | None = None
    description: str | None = None
    promise: str | None = None
    coach_name: str | None = Field(None, max_length=200)
    coach_bio: str | None = None
    coach_credentials: str | None = Field(None, max_length=500)
    coach_photo_url: str | None = Field(None, max_length=500)
    thumbnail_url: str | None = Field(None, max_length=500)
    trailer_url: str | None = Field(None, max_length=2048)
    pricing_model: CoachingPricingModel | None = None
    access_duration: CoachingAccessDuration | None = None
    free_preview: bool | None = None
    landing_data: dict[str, Any] | None = None
    intake_questions: list[str] | None = None
    session_ideas: list[str] | None = None
    ai_generated: bool | None = None
    course_id: UUID4 | None = None
    published_at: datetime | None = None


class CoachingProgramRead(TimestampedSchema, CoachingProgramBase):
    id: UUID4
    product_id: UUID4
    organization_id: UUID4


class CoachingProgramPublicRead(Schema):
    """Slim public-facing schema for the coaching landing page."""

    id: UUID4
    product_id: UUID4
    organization_id: UUID4
    organization_slug: str
    slug: str | None
    title: str | None
    promise: str | None
    coach_name: str | None
    coach_bio: str | None
    coach_credentials: str | None
    coach_photo_url: str | None
    thumbnail_url: str | None
    trailer_url: str | None
    format: CoachingFormat
    cohort_start: date | None
    cohort_end: date | None
    weeks: int | None
    free_preview: bool
    landing_data: dict[str, Any] | None
    published_at: datetime | None


# --- Wizard ---


class CoachingWizardLesson(Schema):
    type: str
    title: str = Field(max_length=500)


class CoachingWizardModule(Schema):
    title: str = Field(max_length=500)
    lessons: list[CoachingWizardLesson] = Field(default_factory=list)


class CoachingWizardSubmit(Schema):
    product_id: UUID4
    format: CoachingFormat
    cohort_start: date | None = None
    cohort_end: date | None = None
    weeks: int | None = None
    promise: str
    coach_name: str = Field(max_length=200)
    coach_bio: str | None = None
    coach_credentials: str | None = Field(None, max_length=500)
    pricing_model: CoachingPricingModel
    access_duration: CoachingAccessDuration
    free_preview: bool = False
    landing_data: dict[str, Any] | None = None
    intake_questions: list[str] | None = None
    session_ideas: list[str] | None = None
    ai_generated: bool = False
    # Modules are echoed but not yet persisted in this scaffolding.
    # TODO: persist modules/lessons (decide whether to reuse course_module
    # / course_lesson tables or create coaching-specific ones).
    modules: list[CoachingWizardModule] | None = None


# --- AI finalize ---


class AIFinalizeLesson(Schema):
    type: Literal["doc", "video"]
    title: str = Field(max_length=500)


class AIFinalizeModule(Schema):
    title: str = Field(max_length=500)
    lessons: list[AIFinalizeLesson] = Field(default_factory=list)


class AIFinalizePayload(Schema):
    modules: list[AIFinalizeModule] = Field(default_factory=list)
    landing_data: dict[str, Any] | None = None
    intake_questions: list[str] | None = None
    session_ideas: list[str] | None = None
