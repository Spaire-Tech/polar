"""Add course_challenges, course_submissions, submission media + reactions

Revision ID: a92c7d4f1b03
Revises: 1f3a55e2b610
Create Date: 2026-05-23 03:00:00.000000

Phase 1 of "Spaire Experiences" — the submission loop. Per-module
challenges, one submission per (challenge, enrollment), image-first
media (video columns reserved for the next pass), creator emoji
reactions on submissions.

Comments on submissions are intentionally NOT wired here: Phase 1 v0.1
ships emoji-only on the creator side; threaded comments come in Phase
4 once we know what the moderation surface needs to look like.

"""

import sqlalchemy as sa
from alembic import op

revision = "a92c7d4f1b03"
down_revision = "1f3a55e2b610"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ── course_challenges ───────────────────────────────────────────────
    op.create_table(
        "course_challenges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("module_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "accepts_media", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "accepts_video", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "accepts_text", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column("due_after_days", sa.Integer(), nullable=True),
        sa.Column(
            "published", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column(
            "ai_generated",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.ForeignKeyConstraint(
            ["course_id"], ["courses.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["module_id"], ["course_modules.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_course_challenges_course_id",
        "course_challenges",
        ["course_id"],
    )
    op.create_index(
        "ix_course_challenges_module_id",
        "course_challenges",
        ["module_id"],
    )
    # Drives the creator-side challenges list per course. Partial so soft-
    # deleted challenges drop out of the planner's range scan.
    op.create_index(
        "ix_course_challenges_course_published",
        "course_challenges",
        ["course_id", "position"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    # ── course_submissions ──────────────────────────────────────────────
    op.create_table(
        "course_submissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("challenge_id", sa.Uuid(), nullable=False),
        # Denormalized so the creator inbox doesn't join through
        # challenges → modules → courses on every page load. Trade-off:
        # one extra column write at submit time.
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("enrollment_id", sa.Uuid(), nullable=False),
        sa.Column("caption", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default="draft"
        ),
        sa.Column("submitted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["challenge_id"], ["course_challenges.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["course_id"], ["courses.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["enrollment_id"], ["course_enrollments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_course_submissions_challenge_id",
        "course_submissions",
        ["challenge_id"],
    )
    op.create_index(
        "ix_course_submissions_course_id",
        "course_submissions",
        ["course_id"],
    )
    op.create_index(
        "ix_course_submissions_enrollment_id",
        "course_submissions",
        ["enrollment_id"],
    )
    # One active submission per (challenge, enrollment) — soft-delete
    # aware so a student can hard-delete + retry.
    op.create_index(
        "ix_course_submissions_challenge_enrollment_active",
        "course_submissions",
        ["challenge_id", "enrollment_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    # Creator inbox feed — newest submitted_at first, course-scoped.
    # Matches the postgresql_ops syntax used by the existing
    # ix_course_enrollments_course_active index — keeps alembic
    # autogenerate diffs clean against the model declaration.
    op.create_index(
        "ix_course_submissions_course_submitted_at",
        "course_submissions",
        ["course_id", "submitted_at"],
        postgresql_where=sa.text(
            "deleted_at IS NULL AND submitted_at IS NOT NULL"
        ),
        postgresql_ops={"submitted_at": "DESC"},
    )

    # ── course_submission_media ─────────────────────────────────────────
    op.create_table(
        "course_submission_media",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("submission_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind", sa.String(length=10), nullable=False, server_default="image"
        ),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("mux_upload_id", sa.String(length=200), nullable=True),
        sa.Column("mux_asset_id", sa.String(length=200), nullable=True),
        sa.Column("mux_playback_id", sa.String(length=200), nullable=True),
        sa.Column("mux_status", sa.String(length=20), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(
            ["submission_id"], ["course_submissions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_course_submission_media_submission_id",
        "course_submission_media",
        ["submission_id"],
    )

    # ── course_submission_reactions ─────────────────────────────────────
    op.create_table(
        "course_submission_reactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("submission_id", sa.Uuid(), nullable=False),
        sa.Column("actor_type", sa.String(length=10), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("emoji", sa.String(length=16), nullable=False),
        sa.ForeignKeyConstraint(
            ["submission_id"], ["course_submissions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_course_submission_reactions_submission_id",
        "course_submission_reactions",
        ["submission_id"],
    )
    op.create_index(
        "ix_course_submission_reactions_actor_user_id",
        "course_submission_reactions",
        ["actor_user_id"],
    )
    # One reaction per (submission, actor, emoji). A user can leave
    # multiple distinct emoji on the same submission (Apple / Slack
    # semantics), but not the same emoji twice.
    op.create_index(
        "ix_course_submission_reactions_actor_unique",
        "course_submission_reactions",
        ["submission_id", "actor_user_id", "emoji"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_course_submission_reactions_actor_unique",
        table_name="course_submission_reactions",
    )
    op.drop_index(
        "ix_course_submission_reactions_actor_user_id",
        table_name="course_submission_reactions",
    )
    op.drop_index(
        "ix_course_submission_reactions_submission_id",
        table_name="course_submission_reactions",
    )
    op.drop_table("course_submission_reactions")

    op.drop_index(
        "ix_course_submission_media_submission_id",
        table_name="course_submission_media",
    )
    op.drop_table("course_submission_media")

    op.drop_index(
        "ix_course_submissions_course_submitted_at",
        table_name="course_submissions",
    )
    op.drop_index(
        "ix_course_submissions_challenge_enrollment_active",
        table_name="course_submissions",
    )
    op.drop_index(
        "ix_course_submissions_enrollment_id", table_name="course_submissions"
    )
    op.drop_index(
        "ix_course_submissions_course_id", table_name="course_submissions"
    )
    op.drop_index(
        "ix_course_submissions_challenge_id", table_name="course_submissions"
    )
    op.drop_table("course_submissions")

    op.drop_index(
        "ix_course_challenges_course_published", table_name="course_challenges"
    )
    op.drop_index(
        "ix_course_challenges_module_id", table_name="course_challenges"
    )
    op.drop_index(
        "ix_course_challenges_course_id", table_name="course_challenges"
    )
    op.drop_table("course_challenges")
