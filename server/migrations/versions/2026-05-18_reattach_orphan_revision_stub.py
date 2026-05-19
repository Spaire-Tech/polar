"""Reattach orphan revision 7c8d3e2f9a01 to the migration graph (no-op)

Revision ID: 7c8d3e2f9a01
Revises: e76d1c4a82b9
Create Date: 2026-05-18 22:55:00.000000

Production's alembic_version table is pinned to 7c8d3e2f9a01 but the
migration file with that ID never made it into the current repo
history (the introducing commit was force-pushed away). Without a file
matching that revision id, alembic can't compute an upgrade path on
deploy:

    FAILED: Can't locate revision identified by '7c8d3e2f9a01'

This stub re-attaches the orphan to the graph as a no-op so the chain
is contiguous again. Whatever schema change the original migration
introduced is presumed already applied in production (since prod ran
it once) and not present in dev environments that were initialised
after it was lost. If a future migration needs to depend on those
changes, the dev-side delta will need a follow-up migration; this stub
exists only to unblock deploys.

"""

revision = "7c8d3e2f9a01"
down_revision = "e76d1c4a82b9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
