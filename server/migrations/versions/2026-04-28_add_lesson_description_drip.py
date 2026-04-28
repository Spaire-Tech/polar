"""Add description and drip fields to course_lessons

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-04-28 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "f6g7h8i9j0k1"
down_revision = "e5f6g7h8i9j0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "course_lessons",
        sa.Column("description", sa.Text, nullable=True),
    )
    op.add_column(
        "course_lessons",
        sa.Column("release_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "course_lessons",
        sa.Column("drip_days", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("course_lessons", "drip_days")
    op.drop_column("course_lessons", "release_at")
    op.drop_column("course_lessons", "description")
