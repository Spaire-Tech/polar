"""Add coaching_posts + courses.community_enabled

Revision ID: b7c8d9e0f1g2
Revises: a6b7c8d9e0f1
Create Date: 2026-05-09 13:00:00.000000

Program-level discussion board kept as a parallel table to lesson_comments
so non-coaching courses are completely unaffected. One-deep threading via
parent_id; pinned + hidden flags for moderation.
"""

import sqlalchemy as sa
from alembic import op

revision = "b7c8d9e0f1g2"
down_revision = "a6b7c8d9e0f1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column(
            "community_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )

    op.create_table(
        "coaching_posts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("enrollment_id", sa.Uuid(), nullable=True),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "is_creator", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "pinned", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "hidden", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name="coaching_posts_course_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["enrollment_id"],
            ["course_enrollments.id"],
            name="coaching_posts_enrollment_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["coaching_posts.id"],
            name="coaching_posts_parent_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="coaching_posts_pkey"),
    )
    op.create_index(
        "ix_coaching_posts_course_id", "coaching_posts", ["course_id"]
    )
    op.create_index(
        "ix_coaching_posts_enrollment_id",
        "coaching_posts",
        ["enrollment_id"],
    )
    op.create_index(
        "ix_coaching_posts_parent_id", "coaching_posts", ["parent_id"]
    )
    op.create_index(
        "ix_coaching_posts_created_at", "coaching_posts", ["created_at"]
    )
    op.create_index(
        "ix_coaching_posts_deleted_at", "coaching_posts", ["deleted_at"]
    )
    op.create_index(
        "ix_coaching_posts_course_id_created_at",
        "coaching_posts",
        ["course_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("coaching_posts")
    op.drop_column("courses", "community_enabled")
