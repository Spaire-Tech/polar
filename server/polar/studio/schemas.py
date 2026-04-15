from typing import Any

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.organization.schemas import OrganizationID


class StudioConversationMessageInput(Schema):
    """Single message payload sent from the client."""

    role: str = Field(
        description=(
            "AI-SDK message role — one of `user`, `assistant`, `system`, `tool`."
        ),
        max_length=32,
    )
    parts: list[dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "The AI-SDK `UIMessage.parts` array for this message. Stored verbatim so "
            "streamed reasoning, tool calls, and text blocks rehydrate unchanged."
        ),
    )


class StudioConversationMessage(TimestampedSchema, IDSchema):
    """A single persisted message in a Studio conversation."""

    conversation_id: UUID4
    role: str
    parts: list[dict[str, Any]]


class StudioConversationBase(TimestampedSchema, IDSchema):
    organization_id: OrganizationID
    user_id: UUID4
    title: str = Field(description="Short, human-readable label for the session.")
    product_id: UUID4 | None = Field(
        description=(
            "Set once the conversation publishes a product (via `markAsDone`). "
            "Null for in-progress drafts."
        )
    )


class StudioConversation(StudioConversationBase):
    """A Studio conversation summary (no messages)."""


class StudioConversationWithMessages(StudioConversationBase):
    """A Studio conversation with its full message history."""

    messages: list[StudioConversationMessage]


class StudioConversationSyncRequest(Schema):
    """
    Full-state sync from the client. If `id` is omitted the server creates a new
    conversation; otherwise it replaces the stored messages and metadata for that id.
    """

    id: UUID4 | None = Field(
        default=None,
        description=("Existing conversation id. Omit to create a new conversation."),
    )
    organization_id: UUID4 = Field(
        description="The organization this conversation belongs to."
    )
    title: str = Field(
        min_length=1,
        max_length=200,
        description="Human-readable label; usually derived from the first user message.",
    )
    product_id: UUID4 | None = Field(
        default=None,
        description="Set to the created product id once the workbook publishes.",
    )
    messages: list[StudioConversationMessageInput] = Field(
        default_factory=list,
        description=(
            "The complete current message list. The server replaces any previously "
            "stored messages with this payload."
        ),
    )


class StudioConversationUpdate(Schema):
    """Schema for PATCHing a conversation (rename, link product)."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    product_id: UUID4 | None = None
