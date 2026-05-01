"""Add landing_config JSONB column to courses

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-05-01 00:00:00.000000

"""

from alembic import op

revision = "l2m3n4o5p6q7"
down_revision = "k1l2m3n4o5p6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE courses ADD COLUMN IF NOT EXISTS landing_config JSONB"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE courses DROP COLUMN IF EXISTS landing_config")
