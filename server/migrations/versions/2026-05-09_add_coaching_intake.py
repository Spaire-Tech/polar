"""Add coaching_intake_forms + coaching_intake_responses

Revision ID: a6b7c8d9e0f1
Revises: z5a6b7c8d9e0
Create Date: 2026-05-09 12:00:00.000000

Optional intake form attached to a coaching program. The schema is stored
as JSON so adding new field types doesn't require migrations. Responses
are scoped per (form, customer) — re-submission overwrites rather than
appending — so the merchant always sees the latest answers.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a6b7c8d9e0f1"
down_revision = "z5a6b7c8d9e0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "coaching_intake_forms",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column(
            "schema_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "required_for_access",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name="coaching_intake_forms_course_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="coaching_intake_forms_pkey"),
        sa.UniqueConstraint(
            "course_id", name="coaching_intake_forms_course_id_key"
        ),
    )
    op.create_index(
        "ix_coaching_intake_forms_course_id",
        "coaching_intake_forms",
        ["course_id"],
    )
    op.create_index(
        "ix_coaching_intake_forms_created_at",
        "coaching_intake_forms",
        ["created_at"],
    )
    op.create_index(
        "ix_coaching_intake_forms_deleted_at",
        "coaching_intake_forms",
        ["deleted_at"],
    )

    op.create_table(
        "coaching_intake_responses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("form_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("enrollment_id", sa.Uuid(), nullable=True),
        sa.Column(
            "answers_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("submitted_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["form_id"],
            ["coaching_intake_forms.id"],
            name="coaching_intake_responses_form_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name="coaching_intake_responses_customer_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["enrollment_id"],
            ["course_enrollments.id"],
            name="coaching_intake_responses_enrollment_id_fkey",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="coaching_intake_responses_pkey"),
        sa.UniqueConstraint(
            "form_id",
            "customer_id",
            name="coaching_intake_responses_form_customer_key",
        ),
    )
    op.create_index(
        "ix_coaching_intake_responses_form_id",
        "coaching_intake_responses",
        ["form_id"],
    )
    op.create_index(
        "ix_coaching_intake_responses_customer_id",
        "coaching_intake_responses",
        ["customer_id"],
    )
    op.create_index(
        "ix_coaching_intake_responses_created_at",
        "coaching_intake_responses",
        ["created_at"],
    )
    op.create_index(
        "ix_coaching_intake_responses_deleted_at",
        "coaching_intake_responses",
        ["deleted_at"],
    )


def downgrade() -> None:
    op.drop_table("coaching_intake_responses")
    op.drop_table("coaching_intake_forms")
