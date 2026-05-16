"""Track email broadcast test sends so opens/clicks are visible

Revision ID: 7c4a91e2d5f3
Revises: e76d1c4a82b9
Create Date: 2026-05-16 12:00:00.000000

Previously the "Send Test" feature delivered an email via Resend but
created no `EmailBroadcastSend` row, so:
  - The webhook handler couldn't match the test email's resend_email_id
    against any record, silently dropping `email.opened` events.
  - Users who clicked "Send Test" to verify their template saw "0 sent /
    0 opened" in analytics and concluded tracking was broken.

This migration adds:
  - `is_test` boolean on `email_broadcast_sends` (default false) — test
    rows can be excluded from real campaign metrics by callers that
    care.
  - `subscriber_id` becomes nullable — test sends often target the
    broadcast author's own inbox, who isn't a subscriber.

"""

import sqlalchemy as sa
from alembic import op

revision = "7c4a91e2d5f3"
down_revision = "e76d1c4a82b9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "email_broadcast_sends",
        sa.Column(
            "is_test",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.alter_column(
        "email_broadcast_sends",
        "subscriber_id",
        existing_type=sa.dialects.postgresql.UUID(),
        nullable=True,
    )
    op.create_index(
        "ix_email_broadcast_sends_is_test",
        "email_broadcast_sends",
        ["is_test"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_email_broadcast_sends_is_test", table_name="email_broadcast_sends"
    )
    op.alter_column(
        "email_broadcast_sends",
        "subscriber_id",
        existing_type=sa.dialects.postgresql.UUID(),
        nullable=False,
    )
    op.drop_column("email_broadcast_sends", "is_test")
