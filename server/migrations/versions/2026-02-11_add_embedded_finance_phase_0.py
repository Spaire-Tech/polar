"""Add embedded finance Phase 0: account mode, fund lifecycle tables

Adds support for Custom Stripe Connect accounts (embedded finance) alongside
existing Express accounts. Introduces fund lifecycle state machine with
fund_state_entries, fund_state_snapshots, and fund_policies tables.

Revision ID: a1b2c3d4e5f6
Revises: c5e9f3b2d4a6
Create Date: 2026-02-11 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "c5e9f3b2d4a6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # -- accounts table: add embedded finance columns --
    op.add_column(
        "accounts",
        sa.Column(
            "account_mode",
            sa.String(10),
            nullable=False,
            server_default="express",
        ),
    )
    op.add_column(
        "accounts",
        sa.Column(
            "treasury_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "accounts",
        sa.Column(
            "issuing_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "accounts",
        sa.Column(
            "issuing_status",
            sa.String(30),
            nullable=False,
            server_default="onboarding_required",
        ),
    )
    op.add_column(
        "accounts",
        sa.Column(
            "fund_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    # -- fund_state_entries table --
    op.create_table(
        "fund_state_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("transaction_id", sa.Uuid(), nullable=True),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="usd"),
        sa.Column("pending_until", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("transitioned_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("previous_state", sa.String(20), nullable=True),
        sa.Column("transition_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("fund_state_entries_account_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transactions.id"],
            name=op.f("fund_state_entries_transaction_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("fund_state_entries_pkey")),
    )
    op.create_index(
        "ix_fund_state_entries_created_at",
        "fund_state_entries",
        ["created_at"],
    )
    op.create_index(
        "ix_fund_state_entries_account_state",
        "fund_state_entries",
        ["account_id", "state"],
    )
    op.create_index(
        "ix_fund_state_entries_pending_until",
        "fund_state_entries",
        ["account_id", "pending_until"],
        postgresql_where=sa.text("state = 'pending'"),
    )

    # -- fund_state_snapshots table --
    op.create_table(
        "fund_state_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column(
            "pending_amount", sa.BigInteger(), nullable=False, server_default="0"
        ),
        sa.Column(
            "available_amount", sa.BigInteger(), nullable=False, server_default="0"
        ),
        sa.Column(
            "reserve_amount", sa.BigInteger(), nullable=False, server_default="0"
        ),
        sa.Column(
            "spendable_amount", sa.BigInteger(), nullable=False, server_default="0"
        ),
        sa.Column(
            "last_recalculated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "policy_config",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("fund_state_snapshots_account_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("fund_state_snapshots_pkey")),
        sa.UniqueConstraint(
            "account_id", name=op.f("fund_state_snapshots_account_id_key")
        ),
    )
    op.create_index(
        "ix_fund_state_snapshots_created_at",
        "fund_state_snapshots",
        ["created_at"],
    )

    # -- fund_policies table --
    op.create_table(
        "fund_policies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column(
            "enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "pending_window_days",
            sa.Integer(),
            nullable=False,
            server_default="7",
        ),
        sa.Column(
            "reserve_floor_basis_points",
            sa.Integer(),
            nullable=False,
            server_default="1000",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("fund_policies_account_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("fund_policies_pkey")),
        sa.UniqueConstraint(
            "account_id", name=op.f("uq_fund_policy_account")
        ),
    )
    op.create_index(
        "ix_fund_policies_created_at",
        "fund_policies",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_table("fund_policies")
    op.drop_table("fund_state_snapshots")
    op.drop_index(
        "ix_fund_state_entries_pending_until", table_name="fund_state_entries"
    )
    op.drop_index(
        "ix_fund_state_entries_account_state", table_name="fund_state_entries"
    )
    op.drop_table("fund_state_entries")

    op.drop_column("accounts", "fund_metadata")
    op.drop_column("accounts", "issuing_status")
    op.drop_column("accounts", "issuing_enabled")
    op.drop_column("accounts", "treasury_enabled")
    op.drop_column("accounts", "account_mode")
