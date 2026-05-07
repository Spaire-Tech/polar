"""Stub migration to reconcile orphan revision c0a17de9b4f3

See stub_3b4ad59bf547.py for the full context. This is the second of two
stubs covering migrations from the parallel coaching branch
(claude/plan-coaching-feature-gPaBe) that production already applied.

This stub is the join point for our coaching chain: the next migration
(2026-05-09_add_coaching.py) lists `c0a17de9b4f3` as its down_revision.

Revision ID: c0a17de9b4f3
Revises: 3b4ad59bf547
Create Date: 2026-05-08 14:00:00.000000

"""

from alembic import op  # noqa: F401

# revision identifiers, used by Alembic.
revision = "c0a17de9b4f3"
down_revision = "3b4ad59bf547"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
