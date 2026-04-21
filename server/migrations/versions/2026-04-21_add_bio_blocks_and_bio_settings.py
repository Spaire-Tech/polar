"""Add bio_blocks table and organizations.bio_settings column

Revision ID: d3f2a8c1b7e4
Revises: b4c8d2e3f601
Create Date: 2026-04-21 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d3f2a8c1b7e4"
down_revision = "b4c8d2e3f601"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bio_blocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "settings",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_bio_blocks_organization_id"),
        "bio_blocks",
        ["organization_id"],
    )
    op.create_index(op.f("ix_bio_blocks_order"), "bio_blocks", ["order"])
    op.create_index(
        op.f("ix_bio_blocks_created_at"), "bio_blocks", ["created_at"]
    )
    op.create_index(
        op.f("ix_bio_blocks_deleted_at"), "bio_blocks", ["deleted_at"]
    )

    op.add_column(
        "organizations",
        sa.Column(
            "bio_settings",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text(
                "'{\"enabled\": false, \"display_title\": null, \"short_bio\": null,"
                " \"avatar_shape\": \"circle\", \"show_powered_by\": true,"
                " \"newsletter_enabled\": false, \"newsletter_heading\": null,"
                " \"newsletter_description\": null}'::jsonb"
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "bio_settings")
    op.drop_index(op.f("ix_bio_blocks_deleted_at"), table_name="bio_blocks")
    op.drop_index(op.f("ix_bio_blocks_created_at"), table_name="bio_blocks")
    op.drop_index(op.f("ix_bio_blocks_order"), table_name="bio_blocks")
    op.drop_index(op.f("ix_bio_blocks_organization_id"), table_name="bio_blocks")
    op.drop_table("bio_blocks")
