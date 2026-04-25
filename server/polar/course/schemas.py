from datetime import datetime
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
    published: bool = False


class CourseLessonUpdate(Schema):
    title: str | None = Field(None, max_length=500)
    content_type: Literal["video", "text", "download", "quiz"] | None = None
    content: dict | None = None
    video_asset_id: str | None = None
    duration_seconds: int | None = None
    position: int | None = None
    is_free_preview: bool | None = None
    published: bool | None = None


class MuxUploadRead(Schema):
    upload_id: str
    upload_url: str


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
    published: bool
    mux_upload_id: str | None = None
    mux_asset_id: str | None = None
    mux_playback_id: str | None = None
    mux_status: str | None = None


class CourseModuleCreate(Schema):
    title: str = Field(max_length=500)
    description: str | None = None
    position: int = 0
    status: str = "draft"
    lessons: list[CourseLessonCreate] = Field(default_factory=list)


class CourseModuleUpdate(Schema):
    title: str | None = Field(None, max_length=500)
    description: str | None = None
    position: int | None = None
    status: str | None = None
    release_at: datetime | None = None
    drip_days: int | None = None


class CourseModuleRead(TimestampedSchema):
    id: UUID4
    course_id: UUID4
    title: str
    description: str | None
    position: int
    status: str
    release_at: datetime | None
    drip_days: int | None
    lessons: list[CourseLessonRead]


class CourseCreate(Schema):
    product_id: UUID4
    organization_id: UUID4
    title: str | None = None
    slug: str | None = None
    course_type: Literal["evergreen", "cohort"] = "evergreen"
    paywall_enabled: bool = False
    paywall_lesson_id: UUID4 | None = None
    paywall_position: int | None = None
    ai_generated: bool = False
    modules: list[CourseModuleCreate] = Field(default_factory=list)


class CourseUpdate(Schema):
    title: str | None = None
    slug: str | None = None
    course_type: Literal["evergreen", "cohort"] | None = None
    paywall_enabled: bool | None = None
    paywall_lesson_id: UUID4 | None = None
    paywall_position: int | None = None


class ReorderRequest(Schema):
    ordered_ids: list[UUID4] = Field(min_length=0)


class CourseProgressRead(Schema):
    total_lessons: int
    completed_lessons: int
    completion_percent: float
    completed: dict[str, str]  # lesson_id -> completed_at ISO string


class LessonCommentCreate(Schema):
    content: str = Field(min_length=1, max_length=5000)
    parent_id: UUID4 | None = None


class LessonCommentAuthor(Schema):
    enrollment_id: UUID4
    name: str | None = None


class LessonCommentRead(Schema):
    id: UUID4
    lesson_id: UUID4
    parent_id: UUID4 | None
    content: str
    created_at: datetime
    is_own: bool
    author: LessonCommentAuthor


class CourseRead(TimestampedSchema):
    id: UUID4
    product_id: UUID4
    organization_id: UUID4
    title: str | None
    slug: str | None
    course_type: str
    paywall_enabled: bool
    paywall_lesson_id: UUID4 | None
    paywall_position: int | None
    ai_generated: bool
    modules: list[CourseModuleRead]
