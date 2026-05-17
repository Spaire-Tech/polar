"""Add Course.format discriminator (course | series)

Revision ID: 08c3effbf1a2
Revises: 7abe8ca7e3c9
Create Date: 2026-05-17 13:00:00.000000

Adds a content-format discriminator to the courses table. Existing rows
are backfilled to "course" — every course created before this migration
was a structured Course → Modules → Lessons by definition. The new
"series" value flags a flat, episode-based narrative format that renders
with a different AI prompt, landing layout, and portal viewer.

"""

import sqlalchemy as sa
from alembic import op

revision = "08c3effbf1a2"
down_revision = "7abe8ca7e3c9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column(
            "format",
            sa.String(length=50),
            nullable=False,
            server_default="course",
        ),
    )


def downgrade() -> None:
    op.drop_column("courses", "format")
