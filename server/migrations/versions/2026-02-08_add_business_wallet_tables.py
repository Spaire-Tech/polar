"""add business wallet tables

Revision ID: d7f3a8b1c2e4
Revises: c5e9f3b2d4a6
Create Date: 2026-02-08 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d7f3a8b1c2e4"
down_revision = "c5e9f3b2d4a6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # financial_accounts
    op.create_table(
        "financial_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("stripe_financial_account_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="usd"),
        sa.Column("balance_cash", sa.BigInteger(), nullable=False, server_default="0"),
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
        sa.Column("aba_routing_number", sa.String(), nullable=True),
        sa.Column("aba_account_number", sa.String(), nullable=True),
        sa.Column(
            "features_card_issuing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "features_deposit_insurance",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "features_inbound_transfers_ach",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "features_outbound_payments_ach",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "features_outbound_transfers_ach",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("stripe_connected_account_id", sa.String(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("onboarding_completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("stripe_financial_account_id"),
        sa.UniqueConstraint("organization_id"),
    )
    op.create_index(
        "ix_financial_accounts_stripe_financial_account_id",
        "financial_accounts",
        ["stripe_financial_account_id"],
    )
    op.create_index(
        "ix_financial_accounts_status",
        "financial_accounts",
        ["status"],
    )
    op.create_index(
        "ix_financial_accounts_stripe_connected_account_id",
        "financial_accounts",
        ["stripe_connected_account_id"],
    )
    op.create_index(
        "ix_financial_accounts_organization_id",
        "financial_accounts",
        ["organization_id"],
    )

    # issuing_cards
    op.create_table(
        "issuing_cards",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("stripe_card_id", sa.String(), nullable=False),
        sa.Column("stripe_cardholder_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="inactive"),
        sa.Column("card_type", sa.String(), nullable=False, server_default="virtual"),
        sa.Column("last4", sa.String(4), nullable=False),
        sa.Column("exp_month", sa.Integer(), nullable=False),
        sa.Column("exp_year", sa.Integer(), nullable=False),
        sa.Column("brand", sa.String(), nullable=False, server_default="Visa"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="usd"),
        sa.Column("cardholder_name", sa.String(), nullable=False),
        sa.Column("card_color", sa.String(7), nullable=False, server_default="#0062FF"),
        sa.Column("spending_limit_amount", sa.BigInteger(), nullable=True),
        sa.Column("spending_limit_interval", sa.String(), nullable=True),
        sa.Column(
            "total_spent", sa.BigInteger(), nullable=False, server_default="0"
        ),
        sa.Column("canceled_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("financial_account_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["financial_account_id"],
            ["financial_accounts.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("stripe_card_id"),
    )
    op.create_index(
        "ix_issuing_cards_stripe_card_id",
        "issuing_cards",
        ["stripe_card_id"],
    )
    op.create_index(
        "ix_issuing_cards_stripe_cardholder_id",
        "issuing_cards",
        ["stripe_cardholder_id"],
    )
    op.create_index(
        "ix_issuing_cards_status",
        "issuing_cards",
        ["status"],
    )
    op.create_index(
        "ix_issuing_cards_financial_account_id",
        "issuing_cards",
        ["financial_account_id"],
    )
    op.create_index(
        "ix_issuing_cards_organization_id",
        "issuing_cards",
        ["organization_id"],
    )

    # treasury_transactions
    op.create_table(
        "treasury_transactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("stripe_transaction_id", sa.String(), nullable=False),
        sa.Column("transaction_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="open"),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="usd"),
        sa.Column("description", sa.String(), nullable=False, server_default=""),
        sa.Column("flow_type", sa.String(), nullable=True),
        sa.Column("flow_id", sa.String(), nullable=True),
        sa.Column("counterparty_name", sa.String(), nullable=True),
        sa.Column("financial_account_id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["financial_account_id"],
            ["financial_accounts.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("stripe_transaction_id"),
    )
    op.create_index(
        "ix_treasury_transactions_stripe_transaction_id",
        "treasury_transactions",
        ["stripe_transaction_id"],
    )
    op.create_index(
        "ix_treasury_transactions_transaction_type",
        "treasury_transactions",
        ["transaction_type"],
    )
    op.create_index(
        "ix_treasury_transactions_status",
        "treasury_transactions",
        ["status"],
    )
    op.create_index(
        "ix_treasury_transactions_flow_id",
        "treasury_transactions",
        ["flow_id"],
    )
    op.create_index(
        "ix_treasury_transactions_financial_account_id",
        "treasury_transactions",
        ["financial_account_id"],
    )


def downgrade() -> None:
    op.drop_table("treasury_transactions")
    op.drop_table("issuing_cards")
    op.drop_table("financial_accounts")
