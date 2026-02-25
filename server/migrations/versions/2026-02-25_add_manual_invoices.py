"""Add manual_invoices and manual_invoice_items tables

Revision ID: d7a1e3f4b5c6
Revises: c5e9f3b2d4a6
Create Date: 2026-02-25 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from polar.kit.extensions.sqlalchemy.types import StringEnum

# revision identifiers, used by Alembic.
revision = "d7a1e3f4b5c6"
down_revision = "c5e9f3b2d4a6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "manual_invoices",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.String(),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("billing_name", sa.String(), nullable=True),
        sa.Column("billing_address", sa.JSON(), nullable=True),
        sa.Column("tax_id", sa.JSON(), nullable=True),
        sa.Column("due_date", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("invoice_number", sa.String(), nullable=True),
        sa.Column("issued_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("paid_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("voided_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("checkout_url", sa.String(), nullable=True),
        sa.Column("email_sent_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("order_id", sa.Uuid(), nullable=True),
        sa.Column("user_metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
    )
    op.create_index("ix_manual_invoices_status", "manual_invoices", ["status"])
    op.create_index(
        "ix_manual_invoices_organization_id", "manual_invoices", ["organization_id"]
    )
    op.create_index(
        "ix_manual_invoices_customer_id", "manual_invoices", ["customer_id"]
    )
    op.create_index("ix_manual_invoices_order_id", "manual_invoices", ["order_id"])
    op.create_index(
        "ix_manual_invoices_invoice_number",
        "manual_invoices",
        ["invoice_number"],
        unique=True,
    )

    op.create_table(
        "manual_invoice_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_amount", sa.Integer(), nullable=False),
        sa.Column("manual_invoice_id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["manual_invoice_id"],
            ["manual_invoices.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_manual_invoice_items_manual_invoice_id",
        "manual_invoice_items",
        ["manual_invoice_id"],
    )


def downgrade() -> None:
    op.drop_table("manual_invoice_items")
    op.drop_table("manual_invoices")
