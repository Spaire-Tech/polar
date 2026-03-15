"""Add locale field to customers and checkouts

Revision ID: a1b2c3d4e5f6
Revises: c5e9f3b2d4a6
Create Date: 2026-03-15 06:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "c5e9f3b2d4a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column("locale", sa.String(), nullable=True),
    )
    op.add_column(
        "checkouts",
        sa.Column("locale", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("checkouts", "locale")
    op.drop_column("customers", "locale")
