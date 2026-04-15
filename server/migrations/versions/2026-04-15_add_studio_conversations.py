"""Add studio conversations tables

Revision ID: c5e9f4a08812
Revises: b4c8d2e3f601
Create Date: 2026-04-15 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c5e9f4a08812"
down_revision = "b4c8d2e3f601"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "studio_conversations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_studio_conversations_organization_id",
        "studio_conversations",
        ["organization_id"],
    )
    op.create_index(
        "ix_studio_conversations_user_id",
        "studio_conversations",
        ["user_id"],
    )
    op.create_index(
        "ix_studio_conversations_user_org",
        "studio_conversations",
        ["user_id", "organization_id"],
    )

    op.create_table(
        "studio_conversation_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column(
            "parts",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["studio_conversations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_studio_conversation_messages_conversation_id",
        "studio_conversation_messages",
        ["conversation_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_studio_conversation_messages_conversation_id",
        table_name="studio_conversation_messages",
    )
    op.drop_table("studio_conversation_messages")
    op.drop_index(
        "ix_studio_conversations_user_org",
        table_name="studio_conversations",
    )
    op.drop_index(
        "ix_studio_conversations_user_id",
        table_name="studio_conversations",
    )
    op.drop_index(
        "ix_studio_conversations_organization_id",
        table_name="studio_conversations",
    )
    op.drop_table("studio_conversations")
