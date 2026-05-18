"""Add partial index on course_enrollments (course_id, enrolled_at DESC)

Revision ID: 1f3a55e2b610
Revises: e76d1c4a82b9
Create Date: 2026-05-18 22:47:00.000000

The course editor's Customers tab lists every active enrollment for a
course, ordered by enrolled_at desc. Without a partial index excluding
soft-deleted rows the query falls back to a sequential scan as soon as
a course has more than a few thousand enrollments.

Built CONCURRENTLY so production tables aren't locked while the index
is created.

"""

from alembic import op

revision = "1f3a55e2b610"
down_revision = "e76d1c4a82b9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_course_enrollments_course_active",
            "course_enrollments",
            ["course_id", "enrolled_at"],
            postgresql_where="deleted_at IS NULL",
            postgresql_ops={"enrolled_at": "DESC"},
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_course_enrollments_course_active",
            table_name="course_enrollments",
            postgresql_concurrently=True,
        )
