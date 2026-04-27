"""Add description to course_lessons

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-04-27 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f6g7h8i9j0k1"
down_revision = "e5f6g7h8i9j0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("course_lessons", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("course_lessons", "description")
