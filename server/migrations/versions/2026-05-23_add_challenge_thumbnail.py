"""Add thumbnail_url + thumbnail_object_position to course_challenges

Revision ID: b81d4e5f2c19
Revises: a92c7d4f1b03
Create Date: 2026-05-23 22:00:00.000000

Phase 1 day 8: lets creators attach a per-challenge thumbnail visible
on the Challenges section of the landing. Until now the landing pulled
the per-card image from a `landing_overrides.media[learn.item${i+1}.image]`
slot — that worked but had two problems:
  1. The Experience tab couldn't manage thumbnails without sending the
     creator over to the Customize tab.
  2. Thumbnails got tied to position 1-4 rather than the challenge id,
     so reordering challenges silently mis-mapped them.

Storing the URL on the challenge row itself fixes both. Same column
shape as course_lesson and course (thumbnail_url + an optional
thumbnail_object_position string for CSS object-position).

"""

import sqlalchemy as sa
from alembic import op

revision = "b81d4e5f2c19"
down_revision = "a92c7d4f1b03"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "course_challenges",
        sa.Column("thumbnail_url", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "course_challenges",
        sa.Column(
            "thumbnail_object_position", sa.String(length=32), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("course_challenges", "thumbnail_object_position")
    op.drop_column("course_challenges", "thumbnail_url")
