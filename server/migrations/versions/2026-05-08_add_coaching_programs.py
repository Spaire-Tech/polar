"""Add coaching_programs table

Revision ID: 3b4ad59bf547
Revises: x3y4z5a6b7c8
Create Date: 2026-05-08 12:00:00.000000

Coaching program is a 1:1 sibling of `courses`, attached to a product.
Stores wizard-derived metadata (cohort dates, coach bio, landing data,
intake questions, etc.). Modules/lessons are intentionally not modelled
here yet — a future migration will decide whether to reuse course_module
/ course_lesson or introduce coaching-specific tables.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "3b4ad59bf547"
down_revision = "x3y4z5a6b7c8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "coaching_programs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
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
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("slug", sa.String(length=200), nullable=True),
        sa.Column(
            "format",
            sa.String(length=20),
            nullable=False,
            server_default="self",
        ),
        sa.Column("cohort_start", sa.Date(), nullable=True),
        sa.Column("cohort_end", sa.Date(), nullable=True),
        sa.Column("weeks", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("promise", sa.Text(), nullable=True),
        sa.Column("coach_name", sa.String(length=200), nullable=True),
        sa.Column("coach_bio", sa.Text(), nullable=True),
        sa.Column("coach_credentials", sa.String(length=500), nullable=True),
        sa.Column("coach_photo_url", sa.String(length=500), nullable=True),
        sa.Column("thumbnail_url", sa.String(length=500), nullable=True),
        sa.Column("trailer_url", sa.String(length=2048), nullable=True),
        sa.Column("pricing_model", sa.String(length=20), nullable=True),
        sa.Column("access_duration", sa.String(length=20), nullable=True),
        sa.Column(
            "free_preview",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "landing_data",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "intake_questions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "session_ideas",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "ai_generated",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="coaching_programs_organization_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["products.id"],
            name="coaching_programs_product_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="coaching_programs_pkey"),
        sa.UniqueConstraint(
            "product_id", name="coaching_programs_product_id_key"
        ),
    )
    op.create_index(
        "ix_coaching_programs_created_at",
        "coaching_programs",
        ["created_at"],
    )
    op.create_index(
        "ix_coaching_programs_deleted_at",
        "coaching_programs",
        ["deleted_at"],
    )
    op.create_index(
        "ix_coaching_programs_organization_id",
        "coaching_programs",
        ["organization_id"],
    )
    op.create_index(
        "ix_coaching_programs_product_id",
        "coaching_programs",
        ["product_id"],
    )
    op.create_index(
        "ix_coaching_programs_slug",
        "coaching_programs",
        ["slug"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_coaching_programs_slug", table_name="coaching_programs"
    )
    op.drop_index(
        "ix_coaching_programs_product_id", table_name="coaching_programs"
    )
    op.drop_index(
        "ix_coaching_programs_organization_id", table_name="coaching_programs"
    )
    op.drop_index(
        "ix_coaching_programs_deleted_at", table_name="coaching_programs"
    )
    op.drop_index(
        "ix_coaching_programs_created_at", table_name="coaching_programs"
    )
    op.drop_table("coaching_programs")
