"""Add pacing_mode to courses

Revision ID: c92e5f6a3b71
Revises: b81d4e5f2c19
Create Date: 2026-05-24 00:00:00.000000

Phase 2 day 1: course-level pacing mode. Drives the student-portal
unlock UI (Week 1 / Week 2 labels vs flat lesson list) and the
creator-side "Apply weekly schedule" affordance.

Values:
  - self_paced    (default for existing courses + new courses)
  - paced_weekly  (renders Week N labels + unlock pills)
  - all_unlocked  (explicit binge-release mode for series)

Per-module drip_days still does the actual lock computation —
pacing_mode is a UI hint + the entry point to the "auto-fill
drip_days weekly" creator button. No behavioural changes for
existing courses; they keep self_paced semantics they had before
this column existed.

"""

import sqlalchemy as sa
from alembic import op

revision = "c92e5f6a3b71"
down_revision = "b81d4e5f2c19"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column(
            "pacing_mode",
            sa.String(length=20),
            nullable=False,
            server_default="self_paced",
        ),
    )


def downgrade() -> None:
    op.drop_column("courses", "pacing_mode")
