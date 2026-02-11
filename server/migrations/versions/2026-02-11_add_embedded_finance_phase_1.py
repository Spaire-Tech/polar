"""Add embedded finance Phase 1: Treasury Financial Accounts

Creates the financial_accounts table for Stripe Treasury Financial Accounts,
which hold spendable merchant funds as operating cash after clearing the
fund-state lifecycle engine.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-11 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "financial_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column(
            "stripe_financial_account_id",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(10),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "supported_currencies",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[\"usd\"]'::jsonb"),
        ),
        sa.Column("aba_routing_number", sa.String(20), nullable=True),
        sa.Column("aba_account_number_last4", sa.String(4), nullable=True),
        sa.Column(
            "features_status",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "balance_cash",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "balance_inbound_pending",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "balance_outbound_pending",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("financial_accounts_account_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("financial_accounts_pkey")),
        sa.UniqueConstraint(
            "stripe_financial_account_id",
            name=op.f("financial_accounts_stripe_fa_id_key"),
        ),
    )
    op.create_index(
        "ix_financial_accounts_account_id",
        "financial_accounts",
        ["account_id"],
    )
    op.create_index(
        "ix_financial_accounts_created_at",
        "financial_accounts",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_financial_accounts_created_at", table_name="financial_accounts"
    )
    op.drop_index(
        "ix_financial_accounts_account_id", table_name="financial_accounts"
    )
    op.drop_table("financial_accounts")
