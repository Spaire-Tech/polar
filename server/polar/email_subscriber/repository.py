from uuid import UUID

from datetime import date, timedelta

from sqlalchemy import Select, cast, Date, func, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionMixin,
)
from polar.models import UserOrganization
from polar.models.email_subscriber import EmailSubscriber


class EmailSubscriberRepository(
    RepositorySoftDeletionMixin[EmailSubscriber],
    RepositoryBase[EmailSubscriber],
):
    model = EmailSubscriber

    async def get_by_email_and_organization(
        self, email: str, organization_id: UUID
    ) -> EmailSubscriber | None:
        statement = self.get_base_statement().where(
            func.lower(EmailSubscriber.email) == email.lower(),
            EmailSubscriber.organization_id == organization_id,
            EmailSubscriber.deleted_at.is_(None),
        )
        return await self.get_one_or_none(statement)

    async def count_by_organization(self, organization_id: UUID) -> int:
        statement = select(func.count(EmailSubscriber.id)).where(
            EmailSubscriber.organization_id == organization_id,
            EmailSubscriber.deleted_at.is_(None),
            EmailSubscriber.status == "active",
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def count_by_status(
        self, organization_id: UUID
    ) -> dict[str, int]:
        statement = (
            select(EmailSubscriber.status, func.count(EmailSubscriber.id))
            .where(
                EmailSubscriber.organization_id == organization_id,
                EmailSubscriber.deleted_at.is_(None),
            )
            .group_by(EmailSubscriber.status)
        )
        result = await self.session.execute(statement)
        counts = {row[0]: row[1] for row in result.all()}
        return counts

    async def get_active_by_organization(
        self, organization_id: UUID
    ) -> list[EmailSubscriber]:
        statement = self.get_base_statement().where(
            EmailSubscriber.organization_id == organization_id,
            EmailSubscriber.status == "active",
            EmailSubscriber.deleted_at.is_(None),
        )
        return await self.get_all(statement)

    async def get_all_for_export(
        self, organization_id: UUID
    ) -> list[EmailSubscriber]:
        """Get all subscribers (including non-active) for CSV export."""
        statement = self.get_base_statement().where(
            EmailSubscriber.organization_id == organization_id,
            EmailSubscriber.deleted_at.is_(None),
        ).order_by(EmailSubscriber.created_at.desc())
        return list(await self.get_all(statement))

    async def get_daily_counts(
        self, organization_id: UUID, days: int = 30
    ) -> list[dict]:
        """Get daily subscriber counts for the last N days."""
        start_date = date.today() - timedelta(days=days)
        statement = (
            select(
                cast(EmailSubscriber.created_at, Date).label("day"),
                func.count(EmailSubscriber.id).label("count"),
            )
            .where(
                EmailSubscriber.organization_id == organization_id,
                EmailSubscriber.deleted_at.is_(None),
                cast(EmailSubscriber.created_at, Date) >= start_date,
            )
            .group_by(cast(EmailSubscriber.created_at, Date))
            .order_by(cast(EmailSubscriber.created_at, Date))
        )
        result = await self.session.execute(statement)
        return [{"day": str(row[0]), "count": row[1]} for row in result.all()]

    async def get_daily_unsubscribes(
        self, organization_id: UUID, days: int = 30
    ) -> list[dict]:
        """Get daily unsubscribe counts for the last N days."""
        start_date = date.today() - timedelta(days=days)
        statement = (
            select(
                cast(EmailSubscriber.unsubscribed_at, Date).label("day"),
                func.count(EmailSubscriber.id).label("count"),
            )
            .where(
                EmailSubscriber.organization_id == organization_id,
                EmailSubscriber.deleted_at.is_(None),
                EmailSubscriber.unsubscribed_at.isnot(None),
                cast(EmailSubscriber.unsubscribed_at, Date) >= start_date,
            )
            .group_by(cast(EmailSubscriber.unsubscribed_at, Date))
            .order_by(cast(EmailSubscriber.unsubscribed_at, Date))
        )
        result = await self.session.execute(statement)
        return [{"day": str(row[0]), "count": row[1]} for row in result.all()]

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[EmailSubscriber]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                EmailSubscriber.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                EmailSubscriber.organization_id == auth_subject.subject.id,
            )

        return statement
