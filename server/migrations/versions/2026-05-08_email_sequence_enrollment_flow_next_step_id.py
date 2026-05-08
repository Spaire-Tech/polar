"""Add flow_next_step_id to email_sequence_enrollments

Revision ID: w2x3y4z5a6b7
Revises: v1w2x3y4z5a6
Create Date: 2026-05-08 00:01:00.000000

flow_next_step_id is the tree-cursor for the new flow walker (Phase 3b).
It points at the next step.id to visit in flow_doc — required to express
"we're inside the No arm of the second branch" when the doc is no longer
a flat array. Legacy enrollments using `flow_index` against the old flat
shape continue to work; new enrollments populate flow_next_step_id.
"""

import sqlalchemy as sa
from alembic import op

revision = "w2x3y4z5a6b7"
down_revision = "v1w2x3y4z5a6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "email_sequence_enrollments",
        sa.Column("flow_next_step_id", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_email_sequence_enrollments_flow_next_step_id",
        "email_sequence_enrollments",
        ["flow_next_step_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_email_sequence_enrollments_flow_next_step_id",
        table_name="email_sequence_enrollments",
    )
    op.drop_column("email_sequence_enrollments", "flow_next_step_id")
