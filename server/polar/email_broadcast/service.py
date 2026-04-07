from collections.abc import Sequence
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.postgres import AsyncReadSession, AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models.email_broadcast import EmailBroadcast, EmailBroadcastStatus
from polar.models.email_broadcast_send import EmailBroadcastSend, EmailBroadcastSendStatus
from polar.models.email_subscriber import EmailSubscriber
from polar.worker import enqueue_job

from .repository import EmailBroadcastRepository


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
        return await repository.create(broadcast, flush=True)

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

        # Get subscribers — filter by segment if one is set
        if broadcast.segment_id is not None:
            from polar.email_segment.service import email_segment as segment_service
            from polar.models.email_segment import EmailSegment

            segment = await session.get(EmailSegment, broadcast.segment_id)
            if segment is not None:
                subscriber_ids = await segment_service.get_subscriber_ids(
                    session, segment
                )
                subscribers = []
                for sid in subscriber_ids:
                    sub = await session.get(EmailSubscriber, sid)
                    if sub is not None:
                        subscribers.append(sub)
            else:
                subscribers = await repository.get_active_subscribers_for_org(
                    broadcast.organization_id
                )
        else:
            subscribers = await repository.get_active_subscribers_for_org(
                broadcast.organization_id
            )

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
        repository = EmailBroadcastRepository.from_session(session)
        counts = await repository.get_analytics_counts(broadcast_id)

        total = sum(counts.values())
        delivered = (
            counts.get(EmailBroadcastSendStatus.delivered, 0)
            + counts.get(EmailBroadcastSendStatus.opened, 0)
            + counts.get(EmailBroadcastSendStatus.clicked, 0)
        )
        opened = (
            counts.get(EmailBroadcastSendStatus.opened, 0)
            + counts.get(EmailBroadcastSendStatus.clicked, 0)
        )
        clicked = counts.get(EmailBroadcastSendStatus.clicked, 0)
        bounced = counts.get(EmailBroadcastSendStatus.bounced, 0)
        unsubscribed = await repository.count_unsubscribed_for_broadcast(broadcast_id)

        return {
            "total_recipients": total,
            "sent": total - counts.get(EmailBroadcastSendStatus.pending, 0) - counts.get(EmailBroadcastSendStatus.failed, 0),
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "bounced": bounced,
            "unsubscribed": unsubscribed,
            "open_rate": (opened / delivered * 100) if delivered > 0 else 0.0,
            "click_rate": (clicked / delivered * 100) if delivered > 0 else 0.0,
        }


email_broadcast = EmailBroadcastService()
