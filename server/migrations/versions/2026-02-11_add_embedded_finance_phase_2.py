"""Add embedded finance Phase 2: Card Issuing (cardholders + issued_cards)

Creates tables for Stripe Issuing cardholders and issued cards.
Cards are linked to Financial Accounts for funding and to cardholders
for authorization.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-11 16:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # -- cardholders table --
    op.create_table(
        "cardholders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column(
            "stripe_cardholder_id",
            sa.String(100),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column(
            "type",
            sa.String(20),
            nullable=False,
            server_default="individual",
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "billing_address",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("cardholders_account_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("cardholders_pkey")),
        sa.UniqueConstraint(
            "stripe_cardholder_id",
            name=op.f("cardholders_stripe_cardholder_id_key"),
        ),
    )
    op.create_index(
        "ix_cardholders_account_id",
        "cardholders",
        ["account_id"],
    )
    op.create_index(
        "ix_cardholders_created_at",
        "cardholders",
        ["created_at"],
    )

    # -- issued_cards table --
    op.create_table(
        "issued_cards",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("cardholder_id", sa.Uuid(), nullable=False),
        sa.Column("financial_account_id", sa.Uuid(), nullable=False),
        sa.Column(
            "stripe_card_id",
            sa.String(100),
            nullable=False,
        ),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="inactive",
        ),
        sa.Column("last4", sa.String(4), nullable=True),
        sa.Column("exp_month", sa.Integer(), nullable=True),
        sa.Column("exp_year", sa.Integer(), nullable=True),
        sa.Column(
            "spending_controls",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("shipping_status", sa.String(50), nullable=True),
        sa.Column("shipping_tracking_number", sa.String(255), nullable=True),
        sa.Column("canceled_reason", sa.String(100), nullable=True),
        sa.ForeignKeyConstraint(
            ["cardholder_id"],
            ["cardholders.id"],
            name=op.f("issued_cards_cardholder_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["financial_account_id"],
            ["financial_accounts.id"],
            name=op.f("issued_cards_financial_account_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("issued_cards_pkey")),
        sa.UniqueConstraint(
            "stripe_card_id",
            name=op.f("issued_cards_stripe_card_id_key"),
        ),
    )
    op.create_index(
        "ix_issued_cards_cardholder_id",
        "issued_cards",
        ["cardholder_id"],
    )
    op.create_index(
        "ix_issued_cards_financial_account_id",
        "issued_cards",
        ["financial_account_id"],
    )
    op.create_index(
        "ix_issued_cards_created_at",
        "issued_cards",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_issued_cards_created_at", table_name="issued_cards"
    )
    op.drop_index(
        "ix_issued_cards_financial_account_id", table_name="issued_cards"
    )
    op.drop_index(
        "ix_issued_cards_cardholder_id", table_name="issued_cards"
    )
    op.drop_table("issued_cards")

    op.drop_index(
        "ix_cardholders_created_at", table_name="cardholders"
    )
    op.drop_index(
        "ix_cardholders_account_id", table_name="cardholders"
    )
    op.drop_table("cardholders")
