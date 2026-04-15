from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization
    from .product import Product
    from .user import User


class StudioConversation(RecordModel):
    """
    A Spaire Studio chat session. Persisted so creators can revisit past
    drafts and jump back into an in-progress workbook.
    """

    __tablename__ = "studio_conversations"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Set once markAsDone fires and a product is published from this session
    product_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="set null"),
        nullable=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")

    @declared_attr
    def product(cls) -> Mapped["Product | None"]:
        return relationship("Product", lazy="raise")

    messages: Mapped[list["StudioConversationMessage"]] = relationship(
        "StudioConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="StudioConversationMessage.created_at",
        lazy="selectin",
    )

    __table_args__ = (
        Index(
            "ix_studio_conversations_user_org",
            "user_id",
            "organization_id",
        ),
    )


class StudioConversationMessage(RecordModel):
    """
    Individual message (user, assistant, or tool) within a Studio conversation.
    `parts` stores the full AI-SDK UIMessage.parts array so we can rehydrate
    streamed reasoning, tool calls, and text blocks exactly as they appeared.
    """

    __tablename__ = "studio_conversation_messages"

    conversation_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("studio_conversations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    parts: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    @declared_attr
    def conversation(cls) -> Mapped["StudioConversation"]:
        return relationship(
            "StudioConversation", back_populates="messages", lazy="raise"
        )
