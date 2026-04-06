from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import asc, desc

from polar.auth.models import AuthSubject, Organization, User
from polar.postgres import AsyncReadSession, AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models.email_subscriber import (
    EmailSubscriber,
    EmailSubscriberSource,
    EmailSubscriberStatus,
)

from .repository import EmailSubscriberRepository
from .sorting import EmailSubscriberSortProperty


class EmailSubscriberService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: UUID | None = None,
        status: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[EmailSubscriberSortProperty]],
    ) -> tuple[Sequence[EmailSubscriber], int]:
        repository = EmailSubscriberRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(
                EmailSubscriber.organization_id == organization_id
            )

        if status is not None:
            statement = statement.where(EmailSubscriber.status == status)

        # Apply sorting
        order_clauses = []
        for s in sorting:
            column = getattr(EmailSubscriber, s.property.value, None)
            if column is not None:
                order_clauses.append(
                    desc(column) if s.direction == "desc" else asc(column)
                )
        if order_clauses:
            statement = statement.order_by(*order_clauses)

        return await repository.paginate(statement, pagination.limit, pagination.page)

    async def get_by_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        subscriber_id: UUID,
    ) -> EmailSubscriber | None:
        repository = EmailSubscriberRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            EmailSubscriber.id == subscriber_id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        email: str,
        name: str | None = None,
        source: str = EmailSubscriberSource.manual,
        import_source: str | None = None,
        customer_id: UUID | None = None,
    ) -> EmailSubscriber:
        repository = EmailSubscriberRepository.from_session(session)

        # Check for existing subscriber
        existing = await repository.get_by_email_and_organization(
            email, organization_id
        )
        if existing is not None:
            # Reactivate if previously unsubscribed/archived
            if existing.status in (
                EmailSubscriberStatus.unsubscribed,
                EmailSubscriberStatus.archived,
            ):
                existing.status = EmailSubscriberStatus.active
                existing.unsubscribed_at = None
                if name and not existing.name:
                    existing.name = name
                if customer_id and not existing.customer_id:
                    existing.customer_id = customer_id
                await repository.update(existing)
            return existing

        subscriber = EmailSubscriber(
            organization_id=organization_id,
            email=email.lower().strip(),
            name=name,
            status=EmailSubscriberStatus.active,
            source=source,
            import_source=import_source,
            customer_id=customer_id,
        )
        return await repository.create(subscriber)

    async def update(
        self,
        session: AsyncSession,
        subscriber: EmailSubscriber,
        *,
        name: str | None = None,
        status: str | None = None,
    ) -> EmailSubscriber:
        repository = EmailSubscriberRepository.from_session(session)

        if name is not None:
            subscriber.name = name
        if status is not None:
            subscriber.status = status
            if status == EmailSubscriberStatus.unsubscribed:
                from polar.kit.utils import utc_now

                subscriber.unsubscribed_at = utc_now()

        return await repository.update(subscriber)

    async def subscribe_from_storefront(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        email: str,
        name: str | None = None,
    ) -> EmailSubscriber:
        return await self.create(
            session,
            organization_id=organization_id,
            email=email,
            name=name,
            source=EmailSubscriberSource.space_signup,
        )

    async def subscribe_from_purchase(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        email: str,
        name: str | None = None,
        customer_id: UUID | None = None,
    ) -> EmailSubscriber:
        return await self.create(
            session,
            organization_id=organization_id,
            email=email,
            name=name,
            source=EmailSubscriberSource.purchase,
            customer_id=customer_id,
        )

    async def get_stats(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
    ) -> dict[str, int]:
        repository = EmailSubscriberRepository.from_session(session)
        counts = await repository.count_by_status(organization_id)
        return {
            "total": sum(counts.values()),
            "active": counts.get("active", 0),
            "unsubscribed": counts.get("unsubscribed", 0),
            "archived": counts.get("archived", 0),
            "invalid": counts.get("invalid", 0),
        }


email_subscriber = EmailSubscriberService()
