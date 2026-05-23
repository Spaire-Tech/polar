"""Tests for the audit-fix #B14 / Pass-1 behavior of
`course_service.apply_weekly_pacing`.

Two things matter for correctness:
  1. drip_days is set to position*7 on every (non-deleted) module
     in SQL order — not the in-memory order of the lazy collection,
     which the audit B13 fix moved to a SQL ORDER BY.
  2. pacing_mode flips to 'paced_weekly' as a side-effect — without
     this, the student portal renders the course as self-paced even
     though the drip schedule is set, leaving the UI half-applied.
"""

import pytest

from polar.course.service import course_service
from polar.models import Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


async def _course_with_modules(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    module_count: int,
    pacing_mode: str = "self_paced",
) -> "Course":  # noqa: F821
    from polar.models.course import Course
    from polar.models.course_module import CourseModule

    course = Course(
        organization_id=organization.id,
        title="C",
        course_type="evergreen",
        format="course",
        pacing_mode=pacing_mode,
    )
    await save_fixture(course)
    for i in range(module_count):
        module = CourseModule(
            course_id=course.id,
            title=f"Module {i + 1}",
            position=i,
        )
        await save_fixture(module)
    await save_fixture(course)
    return course


@pytest.mark.asyncio
class TestApplyWeeklyPacing:
    async def test_sets_drip_days_per_position(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        course = await _course_with_modules(
            save_fixture, organization, module_count=4
        )
        await session.refresh(course)

        modules = await course_service.apply_weekly_pacing(session, course)

        # Expect 0, 7, 14, 21 — drip_days = position * 7 on each module
        # in SQL position order. Asserting the raw values catches an
        # off-by-one or re-ordering regression.
        assert [m.drip_days for m in modules] == [0, 7, 14, 21]

    async def test_flips_pacing_mode_to_weekly(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Audit B14 — applying weekly pacing on a self_paced course
        # must also flip the mode so the student portal renders Week N
        # labels. Without this the schedule was set but the portal
        # showed the old self-paced UI.
        course = await _course_with_modules(
            save_fixture, organization, module_count=2, pacing_mode="self_paced"
        )
        await session.refresh(course)

        await course_service.apply_weekly_pacing(session, course)
        await session.refresh(course)

        assert course.pacing_mode == "paced_weekly"

    async def test_idempotent_on_already_weekly(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Re-applying on a course that's already weekly should still
        # set drip_days correctly — the mode-flip is conditional but
        # the drip computation isn't.
        course = await _course_with_modules(
            save_fixture, organization, module_count=3, pacing_mode="paced_weekly"
        )
        await session.refresh(course)

        modules = await course_service.apply_weekly_pacing(session, course)
        assert [m.drip_days for m in modules] == [0, 7, 14]
        await session.refresh(course)
        assert course.pacing_mode == "paced_weekly"
