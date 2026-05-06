"""Add course_lesson_bookmarks table and last_position_seconds on progress

Revision ID: q6r7s8t9u0v1
Revises: p5q6r7s8t9u0
Create Date: 2026-05-06 00:00:00.000000

"""

from alembic import op

revision = "q6r7s8t9u0v1"
down_revision = "p5q6r7s8t9u0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS course_lesson_bookmarks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ,
            enrollment_id UUID NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
            lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
            UNIQUE (enrollment_id, lesson_id)
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_course_lesson_bookmarks_enrollment_id "
        "ON course_lesson_bookmarks (enrollment_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_course_lesson_bookmarks_lesson_id "
        "ON course_lesson_bookmarks (lesson_id)"
    )

    op.execute(
        "ALTER TABLE course_lesson_progress "
        "ADD COLUMN IF NOT EXISTS last_position_seconds INTEGER"
    )
    op.execute(
        "ALTER TABLE course_lesson_progress "
        "ALTER COLUMN completed_at DROP NOT NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE course_lesson_progress "
        "DROP COLUMN IF EXISTS last_position_seconds"
    )
    op.execute("DROP TABLE IF EXISTS course_lesson_bookmarks")
