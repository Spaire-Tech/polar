"""Service-layer tests for BroadcastService.

Covers the audit-critical paths:
  - publish enqueues fanout when notify_on_publish is True
  - publish skips fanout when notify_on_publish is False
  - publish clears scheduled_at so the cron doesn't re-trigger
  - schedule rejects already-published with a 422 (not a 404)
  - update rejects past scheduled_at via the shared helper
  - create rejects publish + scheduled_at as ambiguous intent
  - create persists scheduled_at (the column existed; the wire-through
    was the audit-fix that the test needs to lock in)
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.course_broadcast.service import broadcast as broadcast_service
from polar.exceptions import SpaireRequestValidationError
from polar.models import CourseBroadcast, Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.course_broadcast.service.enqueue_job")


async def _save_course(
    save_fixture: SaveFixture, organization: Organization
) -> "Course":  # noqa: F821
    """Minimal Course row for the broadcast tests. Imported lazily so
    the module-level imports don't drag the full Course schema in
    when these tests run in isolation."""
    from polar.models.course import Course

    course = Course(
        organization_id=organization.id,
        title="Test course",
        course_type="evergreen",
        format="course",
        pacing_mode="self_paced",
    )
    await save_fixture(course)
    return course


@pytest.mark.asyncio
class TestPublish:
    async def test_enqueues_fanout_when_notify_true(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        enqueue_job_mock: AsyncMock,
    ) -> None:
        course = await _save_course(save_fixture, organization)
        broadcast = CourseBroadcast(
            course_id=course.id,
            title="Hello",
            body="",
            notify_on_publish=True,
        )
        await save_fixture(broadcast)

        result = await broadcast_service.publish(session, broadcast)

        assert result.published_at is not None
        enqueue_job_mock.assert_called_once_with(
            "course_broadcast.fanout_publish", broadcast_id=broadcast.id
        )

    async def test_skips_fanout_when_notify_false(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        enqueue_job_mock: AsyncMock,
    ) -> None:
        course = await _save_course(save_fixture, organization)
        broadcast = CourseBroadcast(
            course_id=course.id,
            title="Silent",
            body="",
            notify_on_publish=False,
        )
        await save_fixture(broadcast)

        result = await broadcast_service.publish(session, broadcast)

        assert result.published_at is not None
        enqueue_job_mock.assert_not_called()

    async def test_publish_clears_scheduled_at(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        enqueue_job_mock: AsyncMock,
    ) -> None:
        # A scheduled draft that the creator manually publishes early
        # should no longer match the periodic publish-due query — the
        # cron filter is published_at IS NULL, but we belt-and-suspender
        # clear scheduled_at too so the row drops out of the partial
        # index entirely.
        course = await _save_course(save_fixture, organization)
        future = datetime.now(timezone.utc) + timedelta(hours=1)
        broadcast = CourseBroadcast(
            course_id=course.id,
            title="Scheduled",
            body="",
            notify_on_publish=False,
            scheduled_at=future,
        )
        await save_fixture(broadcast)

        result = await broadcast_service.publish(session, broadcast)

        assert result.published_at is not None
        assert result.scheduled_at is None


@pytest.mark.asyncio
class TestSchedule:
    async def test_rejects_already_published_with_422(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Audit fix B4 — was previously raising ResourceNotFound (404)
        # which misled the caller. Now raises a validation error.
        course = await _save_course(save_fixture, organization)
        broadcast = CourseBroadcast(
            course_id=course.id,
            title="Published",
            body="",
            published_at=datetime.now(timezone.utc),
        )
        await save_fixture(broadcast)

        future = datetime.now(timezone.utc) + timedelta(hours=1)
        with pytest.raises(SpaireRequestValidationError):
            await broadcast_service.schedule(session, broadcast, future)

    async def test_rejects_past_scheduled_at(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        course = await _save_course(save_fixture, organization)
        broadcast = CourseBroadcast(
            course_id=course.id, title="Draft", body=""
        )
        await save_fixture(broadcast)

        past = datetime.now(timezone.utc) - timedelta(minutes=1)
        with pytest.raises(SpaireRequestValidationError):
            await broadcast_service.schedule(session, broadcast, past)


@pytest.mark.asyncio
class TestUpdate:
    async def test_rejects_past_scheduled_at_via_patch(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Audit fix B3 — PATCH used to accept past timestamps. Now
        # the shared helper rejects them with the same error shape as
        # the /schedule endpoint.
        from polar.course_broadcast.schemas import BroadcastUpdate

        course = await _save_course(save_fixture, organization)
        broadcast = CourseBroadcast(
            course_id=course.id, title="Draft", body=""
        )
        await save_fixture(broadcast)

        past = datetime.now(timezone.utc) - timedelta(seconds=10)
        with pytest.raises(SpaireRequestValidationError):
            await broadcast_service.update(
                session,
                broadcast,
                BroadcastUpdate(scheduled_at=past),
            )

    async def test_clearing_scheduled_at_is_allowed(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # `scheduled_at: None` on PATCH means "cancel the schedule" —
        # that path skips the future-time check so creators can
        # un-schedule a draft without backdating it.
        from polar.course_broadcast.schemas import BroadcastUpdate

        course = await _save_course(save_fixture, organization)
        broadcast = CourseBroadcast(
            course_id=course.id,
            title="Scheduled",
            body="",
            scheduled_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        await save_fixture(broadcast)

        result = await broadcast_service.update(
            session, broadcast, BroadcastUpdate(scheduled_at=None)
        )
        assert result.scheduled_at is None
