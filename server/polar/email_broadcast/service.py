from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.postgres import AsyncReadSession, AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.kit.utils import utc_now
from polar.models import UserOrganization
from polar.models.email_broadcast import EmailBroadcast, EmailBroadcastStatus
from polar.models.email_broadcast_send import EmailBroadcastSend, EmailBroadcastSendStatus
from polar.models.email_subscriber import EmailSubscriber, EmailSubscriberStatus
from polar.worker import enqueue_job


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


class EmailBroadcastService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: UUID | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[EmailBroadcast], int]:
        repository = EmailBroadcastRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(
                EmailBroadcast.organization_id == organization_id
            )

        statement = statement.order_by(EmailBroadcast.created_at.desc())
        return await repository.paginate(statement, pagination.limit, pagination.page)

    async def get_by_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        broadcast_id: UUID,
    ) -> EmailBroadcast | None:
        repository = EmailBroadcastRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            EmailBroadcast.id == broadcast_id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        subject: str,
        sender_name: str,
        reply_to_email: str | None = None,
        content_json: dict | None = None,
        content_html: str | None = None,
        segment_id: UUID | None = None,
    ) -> EmailBroadcast:
        repository = EmailBroadcastRepository.from_session(session)
        broadcast = EmailBroadcast(
            organization_id=organization_id,
            subject=subject,
            sender_name=sender_name,
            reply_to_email=reply_to_email,
            content_json=content_json,
            content_html=content_html,
            segment_id=segment_id,
            status=EmailBroadcastStatus.draft,
        )
        return await repository.create(broadcast)

    async def update(
        self,
        session: AsyncSession,
        broadcast: EmailBroadcast,
        *,
        subject: str | None = None,
        sender_name: str | None = None,
        reply_to_email: str | None = None,
        content_json: dict | None = None,
        content_html: str | None = None,
        segment_id: UUID | None = None,
    ) -> EmailBroadcast:
        repository = EmailBroadcastRepository.from_session(session)

        if subject is not None:
            broadcast.subject = subject
        if sender_name is not None:
            broadcast.sender_name = sender_name
        if reply_to_email is not None:
            broadcast.reply_to_email = reply_to_email
        if content_json is not None:
            broadcast.content_json = content_json
        if content_html is not None:
            broadcast.content_html = content_html
        if segment_id is not None:
            broadcast.segment_id = segment_id

        return await repository.update(broadcast)

    async def send(
        self,
        session: AsyncSession,
        broadcast: EmailBroadcast,
    ) -> EmailBroadcast:
        """Initiate sending a broadcast. Creates send records and enqueues jobs."""
        repository = EmailBroadcastRepository.from_session(session)

        # Get all active subscribers for the org
        # TODO: Filter by segment when segments are fully implemented
        subscriber_statement = select(EmailSubscriber).where(
            EmailSubscriber.organization_id == broadcast.organization_id,
            EmailSubscriber.status == EmailSubscriberStatus.active,
            EmailSubscriber.deleted_at.is_(None),
        )
        result = await session.execute(subscriber_statement)
        subscribers = result.scalars().all()

        if not subscribers:
            broadcast.status = EmailBroadcastStatus.sent
            broadcast.sent_at = utc_now()
            broadcast.total_recipients = 0
            return await repository.update(broadcast)

        # Create send records
        for subscriber in subscribers:
            send_record = EmailBroadcastSend(
                broadcast_id=broadcast.id,
                subscriber_id=subscriber.id,
                status=EmailBroadcastSendStatus.pending,
            )
            session.add(send_record)

        broadcast.status = EmailBroadcastStatus.sending
        broadcast.total_recipients = len(subscribers)
        await repository.update(broadcast)

        # Flush to persist send records
        await session.flush()

        # Enqueue the actual sending job
        enqueue_job(
            "email_broadcast.send_emails",
            broadcast_id=broadcast.id,
        )

        return broadcast

    async def get_analytics(
        self,
        session: AsyncReadSession,
        broadcast_id: UUID,
    ) -> dict[str, int | float]:
        """Get analytics for a broadcast."""
        statement = (
            select(EmailBroadcastSend.status, func.count(EmailBroadcastSend.id))
            .where(EmailBroadcastSend.broadcast_id == broadcast_id)
            .group_by(EmailBroadcastSend.status)
        )
        result = await session.execute(statement)
        counts = {row[0]: row[1] for row in result.all()}

        total = sum(counts.values())
        opened = counts.get(EmailBroadcastSendStatus.opened, 0) + counts.get(
            EmailBroadcastSendStatus.clicked, 0
        )
        clicked = counts.get(EmailBroadcastSendStatus.clicked, 0)

        return {
            "total_recipients": total,
            "sent": counts.get(EmailBroadcastSendStatus.sent, 0) + opened + clicked,
            "delivered": counts.get(EmailBroadcastSendStatus.delivered, 0) + opened + clicked,
            "opened": opened,
            "clicked": clicked,
            "bounced": counts.get(EmailBroadcastSendStatus.bounced, 0),
            "unsubscribed": 0,  # Tracked separately
            "open_rate": (opened / total * 100) if total > 0 else 0.0,
            "click_rate": (clicked / total * 100) if total > 0 else 0.0,
        }


email_broadcast = EmailBroadcastService()
