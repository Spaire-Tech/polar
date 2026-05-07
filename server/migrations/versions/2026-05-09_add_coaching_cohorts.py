"""Add coaching_cohorts + coaching_cohort_enrollments

Revision ID: z5a6b7c8d9e0
Revises: y4z5a6b7c8d9
Create Date: 2026-05-09 11:00:00.000000

Cohorts let a coaching program run multiple parallel waves with their own
start/end dates, capacity, and enrollment window. v1 always auto-creates a
single default cohort per program; the data model accommodates additional
cohorts when the UI catches up.

Enrollment-to-cohort is a separate join table so non-coaching courses keep
their existing CourseEnrollment shape untouched.
"""

import sqlalchemy as sa
from alembic import op

revision = "z5a6b7c8d9e0"
down_revision = "y4z5a6b7c8d9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "coaching_cohorts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("starts_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("ends_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column(
            "enrollment_open",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name="coaching_cohorts_course_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="coaching_cohorts_pkey"),
    )
    op.create_index(
        "ix_coaching_cohorts_course_id", "coaching_cohorts", ["course_id"]
    )
    op.create_index(
        "ix_coaching_cohorts_created_at", "coaching_cohorts", ["created_at"]
    )
    op.create_index(
        "ix_coaching_cohorts_deleted_at", "coaching_cohorts", ["deleted_at"]
    )

    op.create_table(
        "coaching_cohort_enrollments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("cohort_id", sa.Uuid(), nullable=False),
        sa.Column("enrollment_id", sa.Uuid(), nullable=False),
        sa.Column("joined_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["cohort_id"],
            ["coaching_cohorts.id"],
            name="coaching_cohort_enrollments_cohort_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["enrollment_id"],
            ["course_enrollments.id"],
            name="coaching_cohort_enrollments_enrollment_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="coaching_cohort_enrollments_pkey"),
        sa.UniqueConstraint(
            "enrollment_id",
            name="coaching_cohort_enrollments_enrollment_id_key",
        ),
    )
    op.create_index(
        "ix_coaching_cohort_enrollments_cohort_id",
        "coaching_cohort_enrollments",
        ["cohort_id"],
    )
    op.create_index(
        "ix_coaching_cohort_enrollments_created_at",
        "coaching_cohort_enrollments",
        ["created_at"],
    )
    op.create_index(
        "ix_coaching_cohort_enrollments_deleted_at",
        "coaching_cohort_enrollments",
        ["deleted_at"],
    )


def downgrade() -> None:
    op.drop_table("coaching_cohort_enrollments")
    op.drop_table("coaching_cohorts")
