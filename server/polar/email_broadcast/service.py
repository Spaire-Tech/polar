from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.exceptions import PolarError
from polar.postgres import AsyncReadSession, AsyncSession
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models.email_broadcast import EmailBroadcast, EmailBroadcastStatus
from polar.models.email_broadcast_send import EmailBroadcastSend, EmailBroadcastSendStatus
from polar.models.email_subscriber import EmailSubscriber
from polar.worker import enqueue_job


class BroadcastError(PolarError): ...


class BroadcastAlreadySent(BroadcastError):
    def __init__(self) -> None:
        super().__init__("Broadcast has already been sent or is currently sending.")

from .repository import EmailBroadcastRepository


class EmailBroadcastService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: UUID | None = None,
        status: str | None = None,
        q: str | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[EmailBroadcast], int]:
        repository = EmailBroadcastRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(
                EmailBroadcast.organization_id == organization_id
            )

        if status is not None:
            statement = statement.where(EmailBroadcast.status == status)

        if q is not None and q.strip():
            from sqlalchemy import func

            like = f"%{q.strip().lower()}%"
            statement = statement.where(
                func.lower(EmailBroadcast.subject).like(like)
            )

        statement = statement.order_by(EmailBroadcast.created_at.desc())
        return await repository.paginate(statement, limit=pagination.limit, page=pagination.page)

    async def list_analytics(
        self,
        session: AsyncReadSession,
        broadcast_ids: list[UUID],
    ) -> dict[UUID, dict[str, int | float]]:
        """Per-broadcast headline numbers used by the broadcast list view."""
        if not broadcast_ids:
            return {}
        repository = EmailBroadcastRepository.from_session(session)
        raw = await repository.get_analytics_counts_for_broadcasts(broadcast_ids)
        out: dict[UUID, dict[str, int | float]] = {}
        for bid, c in raw.items():
            delivered = c["delivered"]
            out[bid] = {
                "recipients": c["total"],
                "delivered": delivered,
                "opens": c["opened"],
                "clicks": c["clicked"],
                "unsubs": c["unsubscribed"],
                "open_rate": (c["opened"] / delivered * 100) if delivered else 0.0,
                "click_rate": (c["clicked"] / delivered * 100) if delivered else 0.0,
            }
        return out

    async def list_sends(
        self,
        session: AsyncReadSession,
        broadcast_id: UUID,
        *,
        pagination: PaginationParams,
    ) -> tuple[list, int]:
        repository = EmailBroadcastRepository.from_session(session)
        return await repository.list_sends(
            broadcast_id, limit=pagination.limit, page=pagination.page
        )

    async def duplicate(
        self,
        session: AsyncSession,
        original: EmailBroadcast,
    ) -> EmailBroadcast:
        repository = EmailBroadcastRepository.from_session(session)
        copy = EmailBroadcast(
            organization_id=original.organization_id,
            subject=f"Copy of {original.subject}",
            sender_name=original.sender_name,
            sender_email=original.sender_email,
            reply_to_email=original.reply_to_email,
            content_json=original.content_json,
            content_html=original.content_html,
            segment_id=original.segment_id,
            status=EmailBroadcastStatus.draft,
        )
        return await repository.create(copy, flush=True)

    async def cancel_schedule(
        self,
        session: AsyncSession,
        broadcast: EmailBroadcast,
    ) -> EmailBroadcast:
        if broadcast.status != EmailBroadcastStatus.scheduled:
            return broadcast
        repository = EmailBroadcastRepository.from_session(session)
        broadcast.status = EmailBroadcastStatus.draft
        broadcast.scheduled_at = None
        return await repository.update(broadcast)

    async def archive(
        self,
        session: AsyncSession,
        broadcast: EmailBroadcast,
    ) -> None:
        from polar.kit.utils import utc_now

        broadcast.deleted_at = utc_now()
        repository = EmailBroadcastRepository.from_session(session)
        await repository.update(broadcast)

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
        preview_text: str | None = None,
        reply_to_email: str | None = None,
        content_json: dict | None = None,
        content_html: str | None = None,
        segment_id: UUID | None = None,
    ) -> EmailBroadcast:
        repository = EmailBroadcastRepository.from_session(session)
        broadcast = EmailBroadcast(
            organization_id=organization_id,
            subject=subject,
            preview_text=preview_text,
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
        update: dict,
    ) -> EmailBroadcast:
        """Apply only the fields explicitly present in `update`. Pass `None` to clear."""
        repository = EmailBroadcastRepository.from_session(session)
        for key in (
            "subject",
            "preview_text",
            "sender_name",
            "reply_to_email",
            "content_json",
            "content_html",
            "segment_id",
        ):
            if key in update:
                setattr(broadcast, key, update[key])
        return await repository.update(broadcast)

    async def send_test(
        self,
        session: AsyncSession,
        broadcast: EmailBroadcast,
        *,
        to_email: str,
    ) -> None:
        """Send a one-off test of this broadcast to a single inbox.

        Doesn't create EmailBroadcastSend rows or change status — it's just
        meant to render the same template the worker will render and drop it
        into the requester's inbox.
        """
        from polar.models.organization import Organization

        from .tasks import send_broadcast_email

        organization = await session.get(Organization, broadcast.organization_id)
        unsubscribe_url = (
            "https://space.spairehq.com/email/unsubscribe?test=1"
        )
        await send_broadcast_email(
            broadcast,
            organization,
            to_email=to_email,
            unsubscribe_url=unsubscribe_url,
            extra_subject_prefix="[TEST] ",
        )

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

    async def schedule(
        self,
        session: AsyncSession,
        broadcast: EmailBroadcast,
        *,
        scheduled_at: datetime,
    ) -> EmailBroadcast:
        """Schedule a broadcast to be sent at a specific time."""
        if broadcast.status in (
            EmailBroadcastStatus.sending,
            EmailBroadcastStatus.sent,
        ):
            raise BroadcastAlreadySent()

        repository = EmailBroadcastRepository.from_session(session)
        broadcast.status = EmailBroadcastStatus.scheduled
        broadcast.scheduled_at = scheduled_at
        return await repository.update(broadcast)

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


    async def get_aggregate_analytics(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
    ) -> dict[str, int | float]:
        repository = EmailBroadcastRepository.from_session(session)
        counts = await repository.get_aggregate_analytics(organization_id)

        total_sent = counts["total_sent"]
        delivered = counts["delivered"]
        opened = counts["opened"]
        clicked = counts["clicked"]
        unsubscribed = counts["unsubscribed"]

        return {
            "total_sent": total_sent,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "unsubscribed": unsubscribed,
            "open_rate": (opened / delivered * 100) if delivered > 0 else 0.0,
            "click_rate": (clicked / delivered * 100) if delivered > 0 else 0.0,
        }

    async def get_daily_sends(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        days: int = 30,
    ) -> list[dict]:
        repository = EmailBroadcastRepository.from_session(session)
        return await repository.get_daily_sends(organization_id, days)


email_broadcast = EmailBroadcastService()
