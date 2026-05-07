"""Stub migration to reconcile orphan revision 3b4ad59bf547

This revision was applied to production by a parallel coaching branch
(claude/plan-coaching-feature-gPaBe) whose migration files are not on
this branch. Re-registering it here as a no-op keeps the revision chain
intact for both production (already past it) and fresh databases (which
will execute the no-op and continue to our coaching migrations).

Note: production has a `coaching_programs` table from this migration that
nothing on our branch references. Cleanup migration is queued for after
the new wizard ships and the orphan table is confirmed unused.

Revision ID: 3b4ad59bf547
Revises: x3y4z5a6b7c8
Create Date: 2026-05-08 12:00:00.000000

"""

from alembic import op  # noqa: F401

# revision identifiers, used by Alembic.
revision = "3b4ad59bf547"
down_revision = "x3y4z5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
