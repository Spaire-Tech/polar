from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select

from polar.postgres import AsyncReadSession, AsyncSession
from polar.models.email_segment import EmailSegment, EmailSegmentType
from polar.models.email_subscriber import EmailSubscriber, EmailSubscriberStatus

from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin


class EmailSegmentRepository(
    RepositorySoftDeletionMixin[EmailSegment],
    RepositoryBase[EmailSegment],
):
    model = EmailSegment

    async def get_by_organization(
        self, organization_id: UUID
    ) -> Sequence[EmailSegment]:
        statement = self.get_base_statement().where(
            EmailSegment.organization_id == organization_id,
            EmailSegment.deleted_at.is_(None),
        )
        return await self.get_all(statement)

    async def get_by_slug_and_organization(
        self, slug: str, organization_id: UUID
    ) -> EmailSegment | None:
        statement = self.get_base_statement().where(
            EmailSegment.slug == slug,
            EmailSegment.organization_id == organization_id,
            EmailSegment.deleted_at.is_(None),
        )
        return await self.get_one_or_none(statement)


class EmailSegmentService:
    async def ensure_system_segments(
        self,
        session: AsyncSession,
        organization_id: UUID,
    ) -> list[EmailSegment]:
        """Create default system segments for an organization if they don't exist."""
        repository = EmailSegmentRepository.from_session(session)
        existing = await repository.get_by_organization(organization_id)
        existing_types = {s.type for s in existing}

        system_segments = [
            (EmailSegmentType.all, "All Subscribers", "all-subscribers"),
            (EmailSegmentType.customers, "Customers", "customers"),
        ]

        created = []
        for seg_type, name, slug in system_segments:
            if seg_type not in existing_types:
                segment = EmailSegment(
                    organization_id=organization_id,
                    name=name,
                    slug=slug,
                    type=seg_type,
                    is_system=True,
                )
                segment = await repository.create(segment)
                created.append(segment)

        return created

    async def list(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
    ) -> list[dict]:
        """List segments with subscriber counts."""
        repository = EmailSegmentRepository.from_session(session)
        segments = await repository.get_by_organization(organization_id)

        results = []
        for segment in segments:
            count = await self._count_subscribers(session, segment)
            results.append({
                **{
                    "id": segment.id,
                    "organization_id": segment.organization_id,
                    "name": segment.name,
                    "slug": segment.slug,
                    "type": segment.type,
                    "product_id": segment.product_id,
                    "is_system": segment.is_system,
                    "created_at": segment.created_at,
                    "modified_at": segment.modified_at,
                },
                "subscriber_count": count,
            })

        return results

    async def _count_subscribers(
        self,
        session: AsyncReadSession,
        segment: EmailSegment,
    ) -> int:
        """Dynamically count subscribers in a segment."""
        if segment.type == EmailSegmentType.all:
            statement = select(func.count(EmailSubscriber.id)).where(
                EmailSubscriber.organization_id == segment.organization_id,
                EmailSubscriber.status == EmailSubscriberStatus.active,
                EmailSubscriber.deleted_at.is_(None),
            )
        elif segment.type == EmailSegmentType.customers:
            statement = select(func.count(EmailSubscriber.id)).where(
                EmailSubscriber.organization_id == segment.organization_id,
                EmailSubscriber.status == EmailSubscriberStatus.active,
                EmailSubscriber.customer_id.isnot(None),
                EmailSubscriber.deleted_at.is_(None),
            )
        elif segment.type == EmailSegmentType.archived:
            statement = select(func.count(EmailSubscriber.id)).where(
                EmailSubscriber.organization_id == segment.organization_id,
                EmailSubscriber.status == EmailSubscriberStatus.archived,
                EmailSubscriber.deleted_at.is_(None),
            )
        else:
            # Manual or other segments — count via M2M (future)
            return 0

        result = await session.execute(statement)
        return result.scalar_one()


email_segment = EmailSegmentService()
