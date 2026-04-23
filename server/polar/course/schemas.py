from typing import Literal

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema


class CourseLessonCreate(Schema):
    title: str = Field(max_length=500)
    content_type: Literal["video", "text", "download", "quiz"] = "text"
    content: dict | None = None
    video_asset_id: str | None = None
    duration_seconds: int | None = None
    position: int = 0
    is_free_preview: bool = False


class CourseLessonUpdate(Schema):
    title: str | None = Field(None, max_length=500)
    content_type: Literal["video", "text", "download", "quiz"] | None = None
    content: dict | None = None
    video_asset_id: str | None = None
    duration_seconds: int | None = None
    position: int | None = None
    is_free_preview: bool | None = None


class CourseLessonRead(TimestampedSchema):
    id: UUID4
    module_id: UUID4
    title: str
    content_type: str
    content: dict | None
    video_asset_id: str | None
    duration_seconds: int | None
    position: int
    is_free_preview: bool


class CourseModuleCreate(Schema):
    title: str = Field(max_length=500)
    description: str | None = None
    position: int = 0
    lessons: list[CourseLessonCreate] = Field(default_factory=list)


class CourseModuleUpdate(Schema):
    title: str | None = Field(None, max_length=500)
    description: str | None = None
    position: int | None = None


class CourseModuleRead(TimestampedSchema):
    id: UUID4
    course_id: UUID4
    title: str
    description: str | None
    position: int
    lessons: list[CourseLessonRead]


class CourseCreate(Schema):
    product_id: UUID4
    organization_id: UUID4
    course_type: Literal["evergreen", "cohort"] = "evergreen"
    paywall_enabled: bool = False
    paywall_lesson_id: UUID4 | None = None
    ai_generated: bool = False
    modules: list[CourseModuleCreate] = Field(default_factory=list)


class CourseUpdate(Schema):
    course_type: Literal["evergreen", "cohort"] | None = None
    paywall_enabled: bool | None = None
    paywall_lesson_id: UUID4 | None = None


class CourseRead(TimestampedSchema):
    id: UUID4
    product_id: UUID4
    organization_id: UUID4
    course_type: str
    paywall_enabled: bool
    paywall_lesson_id: UUID4 | None
    ai_generated: bool
    modules: list[CourseModuleRead]
