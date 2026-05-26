"""Database queries for community activities + submissions."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models.community_activity import CommunityActivity
from polar.models.community_activity_submission import CommunityActivitySubmission


class CommunityActivityRepository(
    RepositorySoftDeletionIDMixin[CommunityActivity, UUID],
    RepositorySoftDeletionMixin[CommunityActivity],
    RepositoryBase[CommunityActivity],
):
    model = CommunityActivity

    async def list_for_course(self, course_id: UUID) -> Sequence[CommunityActivity]:
        statement = (
            self.get_base_statement()
            .where(CommunityActivity.course_id == course_id)
            .order_by(CommunityActivity.created_at.desc())
        )
        return await self.get_all(statement)

    async def get_by_id_for_course(
        self, activity_id: UUID, course_id: UUID
    ) -> CommunityActivity | None:
        statement = self.get_base_statement().where(
            CommunityActivity.id == activity_id,
            CommunityActivity.course_id == course_id,
        )
        return await self.get_one_or_none(statement)


class CommunityActivitySubmissionRepository(
    RepositorySoftDeletionIDMixin[CommunityActivitySubmission, UUID],
    RepositorySoftDeletionMixin[CommunityActivitySubmission],
    RepositoryBase[CommunityActivitySubmission],
):
    model = CommunityActivitySubmission

    async def list_for_activity(
        self, activity_id: UUID
    ) -> Sequence[CommunityActivitySubmission]:
        statement = (
            self.get_base_statement()
            .where(CommunityActivitySubmission.activity_id == activity_id)
            .order_by(CommunityActivitySubmission.created_at.desc())
        )
        return await self.get_all(statement)

    async def list_own_for_activity(
        self, activity_id: UUID, customer_id: UUID
    ) -> Sequence[CommunityActivitySubmission]:
        statement = (
            self.get_base_statement()
            .where(
                CommunityActivitySubmission.activity_id == activity_id,
                CommunityActivitySubmission.customer_id == customer_id,
            )
            .order_by(CommunityActivitySubmission.created_at.desc())
        )
        return await self.get_all(statement)

    async def count_for_activity(self, activity_id: UUID) -> int:
        statement = (
            select(func.count())
            .select_from(CommunityActivitySubmission)
            .where(
                CommunityActivitySubmission.activity_id == activity_id,
                CommunityActivitySubmission.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return int(result.scalar_one())

    async def distinct_submitter_count(self, activity_id: UUID) -> int:
        statement = (
            select(func.count(func.distinct(CommunityActivitySubmission.customer_id)))
            .select_from(CommunityActivitySubmission)
            .where(
                CommunityActivitySubmission.activity_id == activity_id,
                CommunityActivitySubmission.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return int(result.scalar_one())

    async def distinct_submitter_counts(
        self, activity_ids: Sequence[UUID]
    ) -> dict[UUID, int]:
        if not activity_ids:
            return {}
        statement = (
            select(
                CommunityActivitySubmission.activity_id,
                func.count(func.distinct(CommunityActivitySubmission.customer_id)),
            )
            .where(
                CommunityActivitySubmission.activity_id.in_(activity_ids),
                CommunityActivitySubmission.deleted_at.is_(None),
            )
            .group_by(CommunityActivitySubmission.activity_id)
        )
        result = await self.session.execute(statement)
        return {row[0]: int(row[1]) for row in result.all()}

    async def activity_ids_with_own_submission(
        self, activity_ids: Sequence[UUID], customer_id: UUID
    ) -> set[UUID]:
        if not activity_ids:
            return set()
        statement = select(CommunityActivitySubmission.activity_id).where(
            CommunityActivitySubmission.activity_id.in_(activity_ids),
            CommunityActivitySubmission.customer_id == customer_id,
            CommunityActivitySubmission.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return {row[0] for row in result.all()}
