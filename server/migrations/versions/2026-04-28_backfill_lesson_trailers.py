"""Backfill is_free_preview for first lesson of each course

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-04-28 11:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import and_, func, select

revision = "g7h8i9j0k1l2"
down_revision = "f6g7h8i9j0k1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # For each course, set is_free_preview=true on the first lesson (lowest position)
    # This is a data migration to ensure every course has at least one free preview
    conn = op.get_bind()

    # Get the first lesson of each course (by module position, then lesson position)
    # We need to find the lesson with the lowest position in the lowest-position module
    subquery = (
        select(
            func.min(sa.column("cl.id")).label("lesson_id")
        )
        .select_from(sa.table("course_lessons", sa.column("id"), sa.column("module_id"), sa.column("position")))
        .join(
            sa.table("course_modules", sa.column("id"), sa.column("course_id"), sa.column("position")),
            sa.column("module_id") == sa.table("course_modules").c.id
        )
        .group_by(sa.table("course_modules").c.course_id)
        .subquery()
    )

    # Update those lessons to is_free_preview=true
    conn.execute(
        sa.update(sa.table("course_lessons"))
        .where(sa.column("id").in_(select(subquery.c.lesson_id)))
        .values(is_free_preview=True)
    )


def downgrade() -> None:
    # Don't downgrade the is_free_preview values - they may have been manually set
    pass
