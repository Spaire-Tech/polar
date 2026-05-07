"""Add coaching: program_format on courses + coaching_events table

Revision ID: y4z5a6b7c8d9
Revises: x3y4z5a6b7c8
Create Date: 2026-05-09 10:00:00.000000

Coaching programs are a flavour of course (program_format='coaching') that
also publish a list of pre-scheduled live events on a timeline. Events are
content the customer buys access to, not bookings the coach personally
performs — kept that way so Polar's MoR posture and digital-product tax
classification stay clean.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "y4z5a6b7c8d9"
down_revision = "x3y4z5a6b7c8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column(
            "program_format",
            sa.String(length=32),
            nullable=False,
            server_default="standard",
        ),
    )

    op.create_table(
        "coaching_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("agenda", postgresql.JSONB(), nullable=True),
        sa.Column("starts_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "duration_minutes", sa.Integer(), nullable=False, server_default="60"
        ),
        sa.Column("timezone", sa.String(length=64), nullable=True),
        sa.Column("meeting_url", sa.String(length=2048), nullable=True),
        sa.Column("meeting_provider", sa.String(length=32), nullable=True),
        sa.Column("recording_mux_upload_id", sa.String(length=255), nullable=True),
        sa.Column("recording_mux_asset_id", sa.String(length=255), nullable=True),
        sa.Column("recording_mux_playback_id", sa.String(length=255), nullable=True),
        sa.Column("recording_mux_status", sa.String(length=20), nullable=True),
        sa.Column(
            "recording_released_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="scheduled",
        ),
        sa.Column(
            "reminder_24h_sent_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column("reminder_1h_sent_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name="coaching_events_course_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="coaching_events_pkey"),
    )
    op.create_index(
        "ix_coaching_events_course_id", "coaching_events", ["course_id"]
    )
    op.create_index("ix_coaching_events_starts_at", "coaching_events", ["starts_at"])
    op.create_index(
        "ix_coaching_events_created_at", "coaching_events", ["created_at"]
    )
    op.create_index(
        "ix_coaching_events_deleted_at", "coaching_events", ["deleted_at"]
    )
    op.create_index(
        "ix_coaching_events_recording_mux_upload_id",
        "coaching_events",
        ["recording_mux_upload_id"],
    )


def downgrade() -> None:
    op.drop_table("coaching_events")
    op.drop_column("courses", "program_format")
