"""Database queries for community events + RSVPs.

Two repositories, kept in a separate file from the existing community
repository.py so the events surface is easy to review in isolation."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.community_event import CommunityEvent
from polar.models.community_event_rsvp import CommunityEventRsvp


class CommunityEventRepository(
    RepositorySoftDeletionIDMixin[CommunityEvent, UUID],
    RepositorySoftDeletionMixin[CommunityEvent],
    RepositoryBase[CommunityEvent],
):
    model = CommunityEvent

    def get_base_statement(self) -> Select[tuple[CommunityEvent]]:
        return super().get_base_statement()

    async def list_for_course(self, course_id: UUID) -> Sequence[CommunityEvent]:
        statement = (
            self.get_base_statement()
            .where(CommunityEvent.course_id == course_id)
            .order_by(CommunityEvent.start_at.asc())
        )
        return await self.get_all(statement)

    async def get_by_id_for_course(
        self, event_id: UUID, course_id: UUID
    ) -> CommunityEvent | None:
        statement = self.get_base_statement().where(
            CommunityEvent.id == event_id,
            CommunityEvent.course_id == course_id,
        )
        return await self.get_one_or_none(statement)

    async def list_due_for_replay_nag(
        self,
        *,
        before: datetime,
        states: tuple[str, ...],
    ) -> Sequence[CommunityEvent]:
        """Events whose end time (start_at + duration) is before `before`,
        whose replay_url is unset, and whose nag state is in the given
        set. Used by the replay-nag dramatiq cron."""
        end_at = CommunityEvent.start_at + func.make_interval(
            0, 0, 0, 0, 0, CommunityEvent.duration_minutes
        )
        statement = self.get_base_statement().where(
            end_at <= before,
            CommunityEvent.replay_url.is_(None),
            CommunityEvent.replay_nag_state.in_(states),
        )
        return await self.get_all(statement)


class CommunityEventRsvpRepository(
    RepositorySoftDeletionIDMixin[CommunityEventRsvp, UUID],
    RepositorySoftDeletionMixin[CommunityEventRsvp],
    RepositoryBase[CommunityEventRsvp],
):
    model = CommunityEventRsvp

    async def get_for_event_customer(
        self, event_id: UUID, customer_id: UUID
    ) -> CommunityEventRsvp | None:
        statement = self.get_base_statement().where(
            CommunityEventRsvp.event_id == event_id,
            CommunityEventRsvp.customer_id == customer_id,
        )
        return await self.get_one_or_none(statement)

    async def list_customer_ids_for_event(self, event_id: UUID) -> Sequence[UUID]:
        statement = select(CommunityEventRsvp.customer_id).where(
            CommunityEventRsvp.event_id == event_id,
            CommunityEventRsvp.deleted_at.is_(None),
        )
        rows = await self.session.execute(statement)
        return [r[0] for r in rows.all()]

    async def list_event_ids_for_customer(
        self, event_ids: Sequence[UUID], customer_id: UUID
    ) -> set[UUID]:
        """Which of the given event_ids does this customer have a live
        (non-soft-deleted) RSVP for? Used to populate `going` in bulk."""
        if not event_ids:
            return set()
        statement = select(CommunityEventRsvp.event_id).where(
            CommunityEventRsvp.event_id.in_(event_ids),
            CommunityEventRsvp.customer_id == customer_id,
            CommunityEventRsvp.deleted_at.is_(None),
        )
        rows = await self.session.execute(statement)
        return {r[0] for r in rows.all()}

    async def count_for_event(self, event_id: UUID) -> int:
        statement = (
            select(func.count())
            .select_from(CommunityEventRsvp)
            .where(
                CommunityEventRsvp.event_id == event_id,
                CommunityEventRsvp.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return int(result.scalar_one())
