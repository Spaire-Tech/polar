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
