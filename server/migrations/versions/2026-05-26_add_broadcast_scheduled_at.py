"""Add scheduled_at to course_broadcasts

Revision ID: f5c8b9d12a47
Revises: e4b1a7f02d83
Create Date: 2026-05-26 00:00:00.000000

Day-2 audit fix #14 — broadcasts now support "publish at a future time".
A periodic worker scans for rows where scheduled_at <= now AND
published_at IS NULL AND deleted_at IS NULL, flips them to published,
and enqueues fanout.

"""

import sqlalchemy as sa
from alembic import op

revision = "f5c8b9d12a47"
down_revision = "e4b1a7f02d83"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "course_broadcasts",
        sa.Column(
            "scheduled_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
    )
    # Drives the periodic publish-due scan: scheduled drafts only.
    op.create_index(
        "ix_course_broadcasts_scheduled_at",
        "course_broadcasts",
        ["scheduled_at"],
        postgresql_where=sa.text(
            "deleted_at IS NULL AND published_at IS NULL "
            "AND scheduled_at IS NOT NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_course_broadcasts_scheduled_at", table_name="course_broadcasts"
    )
    op.drop_column("course_broadcasts", "scheduled_at")
