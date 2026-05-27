"""Community events service.

Business logic for creating, listing, updating, deleting events, and
toggling RSVPs. Notification fan-out is enqueued here; the actual
dramatiq actors live in `community.events_tasks`."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from polar.kit.utils import utc_now
from polar.models.community_event import CommunityEvent
from polar.models.community_event_rsvp import CommunityEventRsvp
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .events_repository import (
    CommunityEventRepository,
    CommunityEventRsvpRepository,
)
from .events_schemas import (
    CommunityEventCreate,
    CommunityEventUpdate,
)
from .exceptions import CommunityNotEnrolled


class EventNotFound(Exception):
    pass


class EventHostMismatch(Exception):
    """Raised when a non-host tries to mutate an event."""

    pass


def is_live(event: CommunityEvent, *, now: datetime | None = None) -> bool:
    now = now or utc_now()
    end_at = event.start_at + timedelta(minutes=event.duration_minutes)
    return event.start_at <= now < end_at


def is_past(event: CommunityEvent, *, now: datetime | None = None) -> bool:
    now = now or utc_now()
    end_at = event.start_at + timedelta(minutes=event.duration_minutes)
    return now >= end_at


class CommunityEventService:
    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    async def list_for_course(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        viewer_customer_id: UUID | None,
    ) -> tuple[list[CommunityEvent], dict[UUID, bool]]:
        """Returns (events, going_by_event_id). Sorted by start_at asc.
        `going_by_event_id` is empty when viewer_customer_id is None
        (e.g. instructor-side preview)."""
        repo = CommunityEventRepository.from_session(session)
        events = list(await repo.list_for_course(course_id))

        going_map: dict[UUID, bool] = {}
        if viewer_customer_id is not None and events:
            rsvp_repo = CommunityEventRsvpRepository.from_session(session)
            ids = [e.id for e in events]
            going_ids = await rsvp_repo.list_event_ids_for_customer(
                ids, viewer_customer_id
            )
            going_map = {eid: (eid in going_ids) for eid in ids}

        return events, going_map

    async def get(
        self,
        session: AsyncSession,
        *,
        event_id: UUID,
        course_id: UUID,
    ) -> CommunityEvent:
        repo = CommunityEventRepository.from_session(session)
        event = await repo.get_by_id_for_course(event_id, course_id)
        if event is None:
            raise EventNotFound()
        return event

    # ------------------------------------------------------------------
    # Writes — host side
    # ------------------------------------------------------------------

    async def create(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        host_user_id: UUID,
        payload: CommunityEventCreate,
    ) -> CommunityEvent:
        # Normalize naive datetimes to UTC. Clients sometimes send
        # `YYYY-MM-DDTHH:MM` without an offset — interpret as UTC.
        start_at = payload.start_at
        if start_at.tzinfo is None:
            start_at = start_at.replace(tzinfo=UTC)

        event = CommunityEvent(
            course_id=course_id,
            host_user_id=host_user_id,
            title=payload.title.strip(),
            type=payload.type,
            description=(payload.description or None),
            start_at=start_at,
            timezone=payload.timezone or "UTC",
            duration_minutes=payload.duration_minutes,
            meeting_url=payload.meeting_url,
            location=payload.location,
            cover_url=payload.cover_url,
            cover_object_position=payload.cover_object_position,
            notify_on_publish=payload.notify_on_publish,
            rsvp_count=0,
            replay_nag_state="pending",
        )

        repo = CommunityEventRepository.from_session(session)
        await repo.create(event, flush=True)

        # Fan out the "event published" notification + schedule reminders.
        # The actor reads the event back from the DB.
        if payload.notify_on_publish:
            enqueue_job("community.event.published", event_id=event.id)
        enqueue_job("community.event.schedule_reminders", event_id=event.id)

        return event

    async def update(
        self,
        session: AsyncSession,
        *,
        event_id: UUID,
        course_id: UUID,
        host_user_id: UUID,
        payload: CommunityEventUpdate,
    ) -> CommunityEvent:
        event = await self.get(session, event_id=event_id, course_id=course_id)
        if event.host_user_id != host_user_id:
            raise EventHostMismatch()

        data = payload.model_dump(exclude_unset=True)

        # Pasting a replay_url closes the replay-nag schedule.
        if "replay_url" in data and data["replay_url"]:
            event.replay_nag_state = "done"

        # Cover replacement: enqueue cleanup of the old image so we
        # don't accumulate orphans in S3 when the host swaps covers.
        prev_cover = event.cover_url
        for k, v in data.items():
            if k == "start_at" and v is not None and v.tzinfo is None:
                v = v.replace(tzinfo=UTC)
            setattr(event, k, v)

        await session.flush()

        if (
            "cover_url" in data
            and prev_cover
            and prev_cover != event.cover_url
        ):
            enqueue_job("community.cover.cleanup", cover_url=prev_cover)

        # If start_at changed, re-schedule reminders.
        if "start_at" in data or "duration_minutes" in data:
            enqueue_job("community.event.schedule_reminders", event_id=event.id)

        return event

    async def delete(
        self,
        session: AsyncSession,
        *,
        event_id: UUID,
        course_id: UUID,
        host_user_id: UUID,
    ) -> None:
        event = await self.get(session, event_id=event_id, course_id=course_id)
        if event.host_user_id != host_user_id:
            raise EventHostMismatch()
        repo = CommunityEventRepository.from_session(session)
        await repo.soft_delete(event)
        if event.cover_url:
            enqueue_job("community.cover.cleanup", cover_url=event.cover_url)

    async def announce(
        self,
        session: AsyncSession,
        *,
        event_id: UUID,
        course_id: UUID,
        host_user_id: UUID,
    ) -> None:
        """Re-fan the published notification to every enrolled customer.

        Authorization mirrors `update`/`delete` — only the original
        host can re-announce. The actual fan-out is enqueued; the host
        sees an immediate ACK and the worker delivers in the background.
        """
        event = await self.get(session, event_id=event_id, course_id=course_id)
        if event.host_user_id != host_user_id:
            raise EventHostMismatch()
        enqueue_job("community.event.announce", event_id=event.id)

    # ------------------------------------------------------------------
    # Writes — RSVP (customer side)
    # ------------------------------------------------------------------

    async def rsvp(
        self,
        session: AsyncSession,
        *,
        event_id: UUID,
        course_id: UUID,
        customer_id: UUID,
        going: bool,
    ) -> tuple[bool, int]:
        """Toggle RSVP. Idempotent — re-RSVP'ing or re-unrsvp'ing is a
        no-op against the live row state but always re-syncs rsvp_count.
        Returns (going_after, rsvp_count_after)."""
        event = await self.get(session, event_id=event_id, course_id=course_id)
        rsvp_repo = CommunityEventRsvpRepository.from_session(session)
        existing = await rsvp_repo.get_for_event_customer(event_id, customer_id)

        # Was the customer already live-RSVP'd before this call? Used
        # below to decide whether to fire a confirmation notification —
        # a repeat RSVP from a customer who's already going shouldn't
        # re-email a calendar invite.
        was_going = existing is not None and existing.deleted_at is None

        if going:
            if existing is None:
                row = CommunityEventRsvp(
                    event_id=event_id, customer_id=customer_id
                )
                await rsvp_repo.create(row)
            elif existing.deleted_at is not None:
                # Reviving a soft-deleted RSVP — clear the tombstone.
                existing.deleted_at = None
                session.add(existing)
        else:
            if existing is not None and existing.deleted_at is None:
                await rsvp_repo.soft_delete(existing)

        await session.flush()

        count = await rsvp_repo.count_for_event(event_id)
        event.rsvp_count = count
        session.add(event)
        await session.flush()

        # Fire the confirmation only on a real transition into "going"
        # (first-time or revived). The actor itself drops past events,
        # so we don't double-check the time here.
        if going and not was_going:
            enqueue_job(
                "community.event.rsvp_confirmed",
                event_id=event_id,
                customer_id=customer_id,
            )

        return going, count


events_service = CommunityEventService()
_ = CommunityNotEnrolled  # re-exported for symmetry with community/service.py
