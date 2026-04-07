from uuid import UUID

from sqlalchemy import Select, func, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models import UserOrganization
from polar.models.email_broadcast import EmailBroadcast
from polar.models.email_broadcast_send import EmailBroadcastSend, EmailBroadcastSendStatus
from polar.models.email_subscriber import EmailSubscriber, EmailSubscriberStatus


class EmailBroadcastRepository(
    RepositorySoftDeletionMixin[EmailBroadcast],
    RepositoryBase[EmailBroadcast],
):
    model = EmailBroadcast

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[EmailBroadcast]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                EmailBroadcast.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                EmailBroadcast.organization_id == auth_subject.subject.id,
            )
        return statement

    async def get_active_subscribers_for_org(
        self, organization_id: UUID
    ) -> list[EmailSubscriber]:
        statement = select(EmailSubscriber).where(
            EmailSubscriber.organization_id == organization_id,
            EmailSubscriber.status == EmailSubscriberStatus.active,
            EmailSubscriber.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_analytics_counts(
        self, broadcast_id: UUID
    ) -> dict[str, int]:
        """Get status counts for a broadcast's sends."""
        statement = (
            select(EmailBroadcastSend.status, func.count(EmailBroadcastSend.id))
            .where(
                EmailBroadcastSend.broadcast_id == broadcast_id,
                EmailBroadcastSend.deleted_at.is_(None),
            )
            .group_by(EmailBroadcastSend.status)
        )
        result = await self.session.execute(statement)
        return {row[0]: row[1] for row in result.all()}

    async def count_unsubscribed_for_broadcast(
        self, broadcast_id: UUID
    ) -> int:
        """Count sends that resulted in an unsubscribe."""
        statement = (
            select(func.count(EmailBroadcastSend.id))
            .where(
                EmailBroadcastSend.broadcast_id == broadcast_id,
                EmailBroadcastSend.unsubscribed_at.isnot(None),
                EmailBroadcastSend.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one()
