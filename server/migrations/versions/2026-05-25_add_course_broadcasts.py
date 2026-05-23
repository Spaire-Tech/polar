"""Add course_broadcasts table

Revision ID: e4b1a7f02d83
Revises: c92e5f6a3b71
Create Date: 2026-05-25 00:00:00.000000

Phase 3 day 1 of "Spaire Experiences" — cohort-wide creator broadcasts.
Drafts are rows with `published_at IS NULL`; the student feed filters
those out via a partial index. Notification/email fanout on the
publish transition is wired in day 2 alongside the creator composer UI.

"""

import sqlalchemy as sa
from alembic import op

revision = "e4b1a7f02d83"
down_revision = "c92e5f6a3b71"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "course_broadcasts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("week_number", sa.Integer(), nullable=True),
        sa.Column(
            "published_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column(
            "notify_on_publish",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.ForeignKeyConstraint(
            ["course_id"], ["courses.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_course_broadcasts_course_id",
        "course_broadcasts",
        ["course_id"],
    )
    # Drives the student-side feed: published rows per course, newest
    # first. Partial keeps drafts + soft-deleted rows out of the
    # planner's range scan.
    op.create_index(
        "ix_course_broadcasts_course_published_at",
        "course_broadcasts",
        ["course_id", "published_at"],
        postgresql_where=sa.text(
            "deleted_at IS NULL AND published_at IS NOT NULL"
        ),
        postgresql_ops={"published_at": "DESC"},
    )


def downgrade() -> None:
    op.drop_index(
        "ix_course_broadcasts_course_published_at",
        table_name="course_broadcasts",
    )
    op.drop_index(
        "ix_course_broadcasts_course_id",
        table_name="course_broadcasts",
    )
    op.drop_table("course_broadcasts")
