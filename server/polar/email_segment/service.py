from collections.abc import Sequence
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.postgres import AsyncReadSession, AsyncSession
from polar.kit.utils import utc_now
from polar.models.email_segment import EmailSegment, EmailSegmentType
from polar.models.email_segment_subscriber import EmailSegmentSubscriber

from .repository import EmailSegmentRepository


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
            count = await repository.count_subscribers(segment)
            results.append({
                "id": segment.id,
                "organization_id": segment.organization_id,
                "name": segment.name,
                "slug": segment.slug,
                "type": segment.type,
                "product_id": segment.product_id,
                "is_system": segment.is_system,
                "created_at": segment.created_at,
                "modified_at": segment.modified_at,
                "subscriber_count": count,
            })

        return results

    async def get_by_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        segment_id: UUID,
    ) -> EmailSegment | None:
        repository = EmailSegmentRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            EmailSegment.id == segment_id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        name: str,
        slug: str,
        type: str = EmailSegmentType.manual,
        product_id: UUID | None = None,
    ) -> EmailSegment:
        repository = EmailSegmentRepository.from_session(session)
        segment = EmailSegment(
            organization_id=organization_id,
            name=name,
            slug=slug,
            type=type,
            product_id=product_id,
            is_system=False,
        )
        return await repository.create(segment)

    async def update(
        self,
        session: AsyncSession,
        segment: EmailSegment,
        *,
        name: str | None = None,
    ) -> EmailSegment:
        repository = EmailSegmentRepository.from_session(session)
        if name is not None:
            segment.name = name
        return await repository.update(segment)

    async def delete(
        self,
        session: AsyncSession,
        segment: EmailSegment,
    ) -> None:
        """Soft-delete a segment. System segments cannot be deleted."""
        if segment.is_system:
            raise ValueError("System segments cannot be deleted")
        repository = EmailSegmentRepository.from_session(session)
        segment.deleted_at = utc_now()
        await repository.update(segment)

    async def add_subscribers(
        self,
        session: AsyncSession,
        segment: EmailSegment,
        subscriber_ids: list[UUID],
    ) -> int:
        """Add subscribers to a manual segment. Returns count added."""
        if segment.type != EmailSegmentType.manual:
            raise ValueError("Can only add subscribers to manual segments")

        repository = EmailSegmentRepository.from_session(session)
        added = 0
        for subscriber_id in subscriber_ids:
            existing = await repository.get_segment_subscriber_entry(
                segment.id, subscriber_id
            )
            if existing is None:
                entry = EmailSegmentSubscriber(
                    segment_id=segment.id,
                    subscriber_id=subscriber_id,
                )
                session.add(entry)
                added += 1

        return added

    async def remove_subscribers(
        self,
        session: AsyncSession,
        segment: EmailSegment,
        subscriber_ids: list[UUID],
    ) -> int:
        """Remove subscribers from a manual segment. Returns count removed."""
        if segment.type != EmailSegmentType.manual:
            raise ValueError("Can only remove subscribers from manual segments")

        repository = EmailSegmentRepository.from_session(session)
        removed = 0
        for subscriber_id in subscriber_ids:
            entry = await repository.get_segment_subscriber_entry(
                segment.id, subscriber_id
            )
            if entry is not None:
                entry.deleted_at = utc_now()
                removed += 1

        return removed

    async def get_subscriber_ids(
        self,
        session: AsyncReadSession,
        segment: EmailSegment,
    ) -> list[UUID]:
        """Get all active subscriber IDs matching a segment."""
        repository = EmailSegmentRepository.from_session(session)
        return await repository.get_subscriber_ids_for_segment(segment)


email_segment = EmailSegmentService()
