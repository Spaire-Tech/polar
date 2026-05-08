"""Add flow_step_id to email_sequence_steps

Revision ID: y4z5a6b7c8d9
Revises: x3y4z5a6b7c8
Create Date: 2026-05-08 00:00:00.000000

flow_step_id is the client-authored stable identifier for a node in the
flow_doc. The editor materialises flow_doc email nodes into rows; before
this column, the editor aligned desired<->server steps by array position,
which drifted after the first reorder or delete (Phase 3a / audit issue
#5). Optional for legacy rows authored before flow_doc existed.
"""

import sqlalchemy as sa
from alembic import op

revision = "y4z5a6b7c8d9"
down_revision = "x3y4z5a6b7c8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "email_sequence_steps",
        sa.Column("flow_step_id", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_email_sequence_steps_flow_step_id",
        "email_sequence_steps",
        ["flow_step_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_email_sequence_steps_flow_step_id",
        table_name="email_sequence_steps",
    )
    op.drop_column("email_sequence_steps", "flow_step_id")
