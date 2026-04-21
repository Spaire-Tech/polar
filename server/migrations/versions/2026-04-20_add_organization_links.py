"""Add organization_links table

Revision ID: c8f1e4a6d702
Revises: b4c8d2e3f601
Create Date: 2026-04-20 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c8f1e4a6d702"
down_revision = "b4c8d2e3f601"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("icon", sa.String(length=40), nullable=True),
        sa.Column("description", sa.String(length=200), nullable=True),
        sa.Column("button_label", sa.String(length=40), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_organization_links_organization_id",
        "organization_links",
        ["organization_id"],
    )
    op.create_index(
        "ix_organization_links_order",
        "organization_links",
        ["order"],
    )
    op.create_index(
        "ix_organization_links_created_at",
        "organization_links",
        ["created_at"],
    )
    op.create_index(
        "ix_organization_links_deleted_at",
        "organization_links",
        ["deleted_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_organization_links_deleted_at", table_name="organization_links")
    op.drop_index("ix_organization_links_created_at", table_name="organization_links")
    op.drop_index("ix_organization_links_order", table_name="organization_links")
    op.drop_index(
        "ix_organization_links_organization_id", table_name="organization_links"
    )
    op.drop_table("organization_links")
