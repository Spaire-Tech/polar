"""Add checkout_link to client_invoices

Revision ID: e3011abd6476
Revises: cdaa3d0a2471
Create Date: 2026-03-18 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e3011abd6476"
down_revision = "cdaa3d0a2471"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "client_invoices",
        sa.Column("checkout_link", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("client_invoices", "checkout_link")
