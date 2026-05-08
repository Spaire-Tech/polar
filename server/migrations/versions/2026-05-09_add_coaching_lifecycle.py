"""Add courses.lifecycle column for coaching programs

Revision ID: c8d9e0f1g2h3
Revises: b7c8d9e0f1g2
Create Date: 2026-05-09 14:00:00.000000

Adds a lifecycle enum so a coaching program can be created in 'draft' state
and explicitly published. The column is on `courses` (not coaching-only)
because we re-use Course as the coaching program record. Default is
'live' so existing rows aren't surprise-hidden from the storefront on
deploy; the wizard lands new coaching programs in 'draft' going forward.

States:
- draft     created but not yet published; storefront and customer portal
            both 404. Editable by the merchant.
- live      published and visible to buyers. The default.
- wrapped   merchant marked the cohort done. Still visible in member
            portals but the storefront product page links members back
            instead of showing buy CTAs.
- archived  hidden from everywhere except the merchant dashboard.
"""

import sqlalchemy as sa
from alembic import op

revision = "c8d9e0f1g2h3"
down_revision = "b7c8d9e0f1g2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column(
            "lifecycle",
            sa.String(length=16),
            nullable=False,
            server_default="live",
        ),
    )


def downgrade() -> None:
    op.drop_column("courses", "lifecycle")
