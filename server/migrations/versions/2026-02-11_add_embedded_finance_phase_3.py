"""Add embedded finance Phase 3: Money Movement (recipients, outbound payments/transfers)

Creates tables for payment recipients, outbound payment records (ACH/wire to
third parties), and outbound transfer records (to merchant's own bank).

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-11 18:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # -- payment_recipients table --
    op.create_table(
        "payment_recipients",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("stripe_payment_method_id", sa.String(100), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column(
            "type",
            sa.String(20),
            nullable=False,
            server_default="individual",
        ),
        sa.Column("bank_name", sa.String(255), nullable=True),
        sa.Column("last4", sa.String(4), nullable=True),
        sa.Column("routing_number_last4", sa.String(4), nullable=True),
        sa.Column(
            "billing_address",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("payment_recipients_account_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("payment_recipients_pkey")),
    )
    op.create_index(
        "ix_payment_recipients_account_id",
        "payment_recipients",
        ["account_id"],
    )
    op.create_index(
        "ix_payment_recipients_created_at",
        "payment_recipients",
        ["created_at"],
    )

    # -- outbound_payments table --
    op.create_table(
        "outbound_payments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("financial_account_id", sa.Uuid(), nullable=False),
        sa.Column("recipient_id", sa.Uuid(), nullable=True),
        sa.Column(
            "stripe_outbound_payment_id",
            sa.String(100),
            nullable=True,
        ),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default="usd",
        ),
        sa.Column(
            "method",
            sa.String(30),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default="processing",
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("statement_descriptor", sa.String(100), nullable=True),
        sa.Column("expected_arrival_date", sa.Date(), nullable=True),
        sa.Column("failure_reason", sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("outbound_payments_account_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["financial_account_id"],
            ["financial_accounts.id"],
            name=op.f("outbound_payments_financial_account_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["recipient_id"],
            ["payment_recipients.id"],
            name=op.f("outbound_payments_recipient_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("outbound_payments_pkey")),
        sa.UniqueConstraint(
            "stripe_outbound_payment_id",
            name=op.f("outbound_payments_stripe_id_key"),
        ),
    )
    op.create_index(
        "ix_outbound_payments_account_id",
        "outbound_payments",
        ["account_id"],
    )
    op.create_index(
        "ix_outbound_payments_created_at",
        "outbound_payments",
        ["created_at"],
    )

    # -- outbound_transfers table --
    op.create_table(
        "outbound_transfers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("financial_account_id", sa.Uuid(), nullable=False),
        sa.Column(
            "stripe_outbound_transfer_id",
            sa.String(100),
            nullable=True,
        ),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default="usd",
        ),
        sa.Column(
            "method",
            sa.String(30),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default="processing",
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("expected_arrival_date", sa.Date(), nullable=True),
        sa.Column("failure_reason", sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("outbound_transfers_account_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["financial_account_id"],
            ["financial_accounts.id"],
            name=op.f("outbound_transfers_financial_account_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("outbound_transfers_pkey")),
        sa.UniqueConstraint(
            "stripe_outbound_transfer_id",
            name=op.f("outbound_transfers_stripe_id_key"),
        ),
    )
    op.create_index(
        "ix_outbound_transfers_account_id",
        "outbound_transfers",
        ["account_id"],
    )
    op.create_index(
        "ix_outbound_transfers_created_at",
        "outbound_transfers",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_outbound_transfers_created_at", table_name="outbound_transfers"
    )
    op.drop_index(
        "ix_outbound_transfers_account_id", table_name="outbound_transfers"
    )
    op.drop_table("outbound_transfers")

    op.drop_index(
        "ix_outbound_payments_created_at", table_name="outbound_payments"
    )
    op.drop_index(
        "ix_outbound_payments_account_id", table_name="outbound_payments"
    )
    op.drop_table("outbound_payments")

    op.drop_index(
        "ix_payment_recipients_created_at", table_name="payment_recipients"
    )
    op.drop_index(
        "ix_payment_recipients_account_id", table_name="payment_recipients"
    )
    op.drop_table("payment_recipients")
