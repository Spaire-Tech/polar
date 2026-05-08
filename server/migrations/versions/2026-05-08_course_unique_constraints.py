"""Add unique constraints + indexes for course enrollments and lessons

Revision ID: y4z5a6b7c8d9
Revises: x3y4z5a6b7c8
Create Date: 2026-05-08 12:00:00.000000

Adds a partial unique index on course_enrollments(customer_id, course_id)
where deleted_at IS NULL — race-safe single-active-enrollment per course
per customer. Also makes course_lessons.mux_upload_id unique so the
webhook handler's scalar_one_or_none() can never raise
MultipleResultsFound.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "y4z5a6b7c8d9"
down_revision = "x3y4z5a6b7c8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Partial unique index — soft-deleted enrollments are excluded so a
    # customer can re-buy and enroll fresh after a revoke.
    op.create_index(
        "ix_course_enrollments_customer_course_active",
        "course_enrollments",
        ["customer_id", "course_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # Drop the existing non-unique index (it'll be replaced by the unique
    # constraint below) and add a unique constraint on mux_upload_id.
    op.drop_index("ix_course_lessons_mux_upload_id", table_name="course_lessons")
    op.create_index(
        "ix_course_lessons_mux_upload_id",
        "course_lessons",
        ["mux_upload_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_course_lessons_mux_upload_id",
        table_name="course_lessons",
    )
    op.create_index(
        "ix_course_lessons_mux_upload_id",
        "course_lessons",
        ["mux_upload_id"],
        unique=False,
    )
    op.drop_index(
        "ix_course_enrollments_customer_course_active",
        table_name="course_enrollments",
    )
