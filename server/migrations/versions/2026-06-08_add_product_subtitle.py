"""Add subtitle column to products

A short free-form tagline shown under the product title on its storefront
page (e.g. "A baking book by Jane Doe"). Distinct from `description`, which
is the long-form overview rendered in the Overview section.

Revision ID: prod_subtitle_608
Revises: ce_announce_527
Create Date: 2026-06-08 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "prod_subtitle_608"
down_revision = "ce_announce_527"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("subtitle", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("products", "subtitle")
