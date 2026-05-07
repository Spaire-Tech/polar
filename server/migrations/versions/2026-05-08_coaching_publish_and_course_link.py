"""Coaching: add course link and published_at

Revision ID: c0a17de9b4f3
Revises: 3b4ad59bf547
Create Date: 2026-05-08 14:00:00.000000

Adds:
- coaching_programs.course_id (FK -> courses.id ON DELETE SET NULL, indexed)
- coaching_programs.published_at (timestamptz, indexed)

These columns let a coaching program optionally back itself with a hidden
Course (auto-created on AI finalize) and track public publishing state for
the public landing page.
"""

import sqlalchemy as sa
from alembic import op

revision = "c0a17de9b4f3"
down_revision = "3b4ad59bf547"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "coaching_programs",
        sa.Column("course_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "coaching_programs",
        sa.Column(
            "published_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "coaching_programs_course_id_fkey",
        "coaching_programs",
        "courses",
        ["course_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_coaching_programs_course_id",
        "coaching_programs",
        ["course_id"],
    )
    op.create_index(
        "ix_coaching_programs_published_at",
        "coaching_programs",
        ["published_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_coaching_programs_published_at", table_name="coaching_programs"
    )
    op.drop_index(
        "ix_coaching_programs_course_id", table_name="coaching_programs"
    )
    op.drop_constraint(
        "coaching_programs_course_id_fkey",
        "coaching_programs",
        type_="foreignkey",
    )
    op.drop_column("coaching_programs", "published_at")
    op.drop_column("coaching_programs", "course_id")
