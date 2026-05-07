from datetime import date
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


class CoachingProgramCreate(CoachingProgramBase):
    product_id: UUID4
    organization_id: UUID4


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


class CoachingProgramRead(TimestampedSchema, CoachingProgramBase):
    id: UUID4
    product_id: UUID4
    organization_id: UUID4


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
