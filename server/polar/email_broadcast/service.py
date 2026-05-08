import random
from collections.abc import Sequence
from datetime import datetime, timedelta
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models.email_broadcast import EmailBroadcast, EmailBroadcastStatus
from polar.models.email_broadcast_ab_test import EmailBroadcastABTest
from polar.models.email_broadcast_send import (
    EmailBroadcastSend,
    EmailBroadcastSendStatus,
)
from polar.models.email_subscriber import EmailSubscriber
from polar.postgres import AsyncReadSession, AsyncSession
from polar.worker import enqueue_job


class BroadcastError(PolarError): ...


class BroadcastAlreadySent(BroadcastError):
    def __init__(self) -> None:
        super().__init__("Broadcast has already been sent or is currently sending.")

from .render import render_blocks_to_html
from .repository import EmailBroadcastABTestRepository, EmailBroadcastRepository


def _pct_delta(current: float | int, prior: float | int) -> float:
    """Percent-change of `current` relative to `prior`.

    Returns 0 when both sides are 0; returns 100 when `prior` is 0 and
    `current` is positive (avoids division by zero while still
    surfacing the growth direction).
    """
    if not prior:
        return 100.0 if current else 0.0
    return float(current - prior) / float(prior) * 100.0


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

    async def get_ab_test(
        self, session: AsyncReadSession, broadcast_id: UUID
    ) -> EmailBroadcastABTest | None:
        repo = EmailBroadcastABTestRepository.from_session(session)
        return await repo.get_by_broadcast(broadcast_id)

    async def upsert_ab_test(
        self,
        session: AsyncSession,
        broadcast: EmailBroadcast,
        *,
        subject_b: str,
        slice_pct: int,
        decide_after_minutes: int,
        winner_metric: str,
    ) -> EmailBroadcastABTest:
        if broadcast.status not in (
            EmailBroadcastStatus.draft,
            EmailBroadcastStatus.scheduled,
        ):
            raise BroadcastError(
                "A/B test config can only change while the broadcast is a draft or scheduled."
            )

        slice_pct = max(5, min(50, int(slice_pct)))
        decide_after_minutes = max(15, int(decide_after_minutes))
        if winner_metric not in ("open_rate", "click_rate"):
            winner_metric = "open_rate"

        repo = EmailBroadcastABTestRepository.from_session(session)
        existing = await repo.get_by_broadcast(broadcast.id)
        if existing is not None:
            existing.subject_b = subject_b
            existing.slice_pct = slice_pct
            existing.decide_after_minutes = decide_after_minutes
            existing.winner_metric = winner_metric
            return await repo.update(existing)

        ab_test = EmailBroadcastABTest(
            broadcast_id=broadcast.id,
            subject_b=subject_b,
            slice_pct=slice_pct,
            decide_after_minutes=decide_after_minutes,
            winner_metric=winner_metric,
        )
        return await repo.create(ab_test, flush=True)

    async def delete_ab_test(
        self,
        session: AsyncSession,
        broadcast: EmailBroadcast,
    ) -> None:
        if broadcast.status not in (
            EmailBroadcastStatus.draft,
            EmailBroadcastStatus.scheduled,
        ):
            raise BroadcastError(
                "A/B test config can only change while the broadcast is a draft or scheduled."
            )
        repo = EmailBroadcastABTestRepository.from_session(session)
        existing = await repo.get_by_broadcast(broadcast.id)
        if existing is not None:
            existing.deleted_at = utc_now()
            await repo.update(existing)

    async def get_ab_analytics(
        self, session: AsyncReadSession, broadcast_id: UUID
    ) -> dict[str, dict[str, int | float]]:
        repo = EmailBroadcastABTestRepository.from_session(session)
        return await repo.variant_analytics(broadcast_id)

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
        filter_rules: dict | None = None,
    ) -> EmailBroadcast:
        # Whenever the JSON document is present, regenerate the HTML so the
        # send pipeline always reflects what the editor produced.
        if content_json:
            content_html = render_blocks_to_html(content_json) or content_html

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
            filter_rules=filter_rules,
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
            "filter_rules",
        ):
            if key in update:
                setattr(broadcast, key, update[key])

        # If the client patched content_json without supplying a matching
        # content_html, regenerate the HTML from the JSON so the worker stays
        # in sync. An explicit content_html in the same patch wins.
        if "content_json" in update and "content_html" not in update:
            broadcast.content_html = render_blocks_to_html(broadcast.content_json) or broadcast.content_html

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
        from polar.email_subscriber.unsubscribe_token import (
            build_test_unsubscribe_url,
        )
        from polar.models.organization import Organization

        from .tasks import send_broadcast_email

        organization = await session.get(Organization, broadcast.organization_id)
        # Test sends don't have a real subscriber id; the unsubscribe page
        # treats `?test=1` as a no-op so the link still resolves cleanly.
        unsubscribe_url = build_test_unsubscribe_url()
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

        # Audience precedence: inline filter_rules → saved segment → all active.
        if broadcast.filter_rules:
            from polar.email_subscriber.service import (
                email_subscriber as subscriber_service,
            )

            subscribers = await subscriber_service.resolve_filter_subscribers(
                session,
                organization_id=broadcast.organization_id,
                filter_rules=broadcast.filter_rules,
            )
        elif broadcast.segment_id is not None:
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

        # Did the user configure an A/B test? If so, only the test slice gets
        # variant labels right now; the remainder stays variant=null and is
        # filled in once the winner is picked by the cron job.
        ab_repo = EmailBroadcastABTestRepository.from_session(session)
        ab_test = await ab_repo.get_by_broadcast(broadcast.id)
        ab_active = ab_test is not None and ab_test.winner_picked_at is None

        if ab_active and ab_test is not None:
            shuffled = list(subscribers)
            random.shuffle(shuffled)
            slice_size = max(2, int(len(shuffled) * (ab_test.slice_pct / 100)))
            slice_size = min(slice_size, len(shuffled))
            test_slice = shuffled[:slice_size]
            remainder = shuffled[slice_size:]
            half = len(test_slice) // 2
            for i, subscriber in enumerate(test_slice):
                variant = "a" if i < half else "b"
                session.add(
                    EmailBroadcastSend(
                        broadcast_id=broadcast.id,
                        subscriber_id=subscriber.id,
                        status=EmailBroadcastSendStatus.pending,
                        variant=variant,
                    )
                )
            for subscriber in remainder:
                session.add(
                    EmailBroadcastSend(
                        broadcast_id=broadcast.id,
                        subscriber_id=subscriber.id,
                        status=EmailBroadcastSendStatus.pending,
                        variant=None,
                    )
                )
            ab_test.test_sent_at = utc_now()
        else:
            for subscriber in subscribers:
                session.add(
                    EmailBroadcastSend(
                        broadcast_id=broadcast.id,
                        subscriber_id=subscriber.id,
                        status=EmailBroadcastSendStatus.pending,
                    )
                )

        broadcast.status = EmailBroadcastStatus.sending
        broadcast.total_recipients = len(subscribers)
        await repository.update(broadcast)

        # Flush to persist send records
        await session.flush()

        # Worker dispatch. For A/B we only release the test slice now; the
        # winner-picker cron releases the remainder once it has data.
        enqueue_job(
            "email_broadcast.send_emails",
            broadcast_id=broadcast.id,
            variant_filter="ab_test_only" if ab_active else None,
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


    # Industry baselines surfaced on the analytics tiles. These are
    # generic creator-newsletter benchmarks (Mailchimp/ConvertKit
    # publish similar numbers); we expose them on the response so the
    # frontend can render "+2.1pt vs industry 21%" without baking
    # constants into the UI.
    _INDUSTRY_OPEN_RATE = 21.0
    _INDUSTRY_CLICK_RATE = 2.5

    @staticmethod
    def _shape_aggregate(counts: dict[str, int]) -> dict[str, int | float]:
        total_sent = counts["total_sent"]
        delivered = counts["delivered"]
        opened = counts["opened"]
        clicked = counts["clicked"]
        unsubscribed = counts["unsubscribed"]
        # Use `delivered` as the denominator when we have webhook
        # confirmations; otherwise fall back to `total_sent` so a
        # workspace whose Resend webhooks haven't wired up still sees
        # honest open/click rates rather than 0%.
        denom = delivered if delivered > 0 else total_sent
        open_rate = (opened / denom * 100) if denom > 0 else 0.0
        click_rate = (clicked / denom * 100) if denom > 0 else 0.0
        unsub_rate = (unsubscribed / denom * 100) if denom > 0 else 0.0
        return {
            "total_sent": total_sent,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "unsubscribed": unsubscribed,
            "open_rate": open_rate,
            "click_rate": click_rate,
            "unsub_rate": unsub_rate,
        }

    async def get_aggregate_analytics(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        *,
        days: int | None = None,
        compare_prior: bool = False,
    ) -> dict:
        """Aggregate analytics for the org.

        When `days` is provided we constrain to the last N days; when
        `compare_prior` is also set we run the same query for the
        immediately preceding window (the same N days before that) and
        return both alongside a delta map. The frontend uses this to
        render "+12.4% vs prior 30d" on every tile.
        """
        repository = EmailBroadcastRepository.from_session(session)

        since: datetime | None = None
        until: datetime | None = None
        prior: dict[str, int | float] | None = None
        if days is not None:
            now = utc_now()
            since = now - timedelta(days=days)
            until = now

        current_counts = await repository.get_aggregate_analytics(
            organization_id, since=since, until=until
        )
        current = self._shape_aggregate(current_counts)

        delta: dict[str, float] = {}
        if compare_prior and days is not None and since is not None:
            prior_since = since - timedelta(days=days)
            prior_until = since
            prior_counts = await repository.get_aggregate_analytics(
                organization_id, since=prior_since, until=prior_until
            )
            prior = self._shape_aggregate(prior_counts)
            delta = {
                "total_sent_pct": _pct_delta(
                    current["total_sent"], prior["total_sent"]
                ),
                "open_rate_pt": float(current["open_rate"])
                - float(prior["open_rate"]),
                "click_rate_pt": float(current["click_rate"])
                - float(prior["click_rate"]),
                "unsub_rate_pt": float(current["unsub_rate"])
                - float(prior["unsub_rate"]),
            }

        return {
            "current": current,
            "prior": prior,
            "delta": delta,
            "industry": {
                "open_rate": self._INDUSTRY_OPEN_RATE,
                "click_rate": self._INDUSTRY_CLICK_RATE,
            },
        }

    async def get_engagement_heatmap(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        days: int = 90,
    ) -> dict:
        """7×24 (day-of-week × hour) open-rate heatmap.

        Returns the matrix shape directly (`matrix[dow][hour] = rate
        in 0..1 or null`) so the frontend can drop straight into the
        SVG. Buckets with fewer than the threshold sample size return
        null so the UI can render them as empty.
        """
        repository = EmailBroadcastRepository.from_session(session)
        rows = await repository.get_send_engagement_heatmap(
            organization_id, days=days
        )
        threshold = 5
        matrix: list[list[float | None]] = [
            [None for _ in range(24)] for _ in range(7)
        ]
        sample_total = 0
        for row in rows:
            sends = row["sends"]
            opens = row["opens"]
            sample_total += sends
            if sends < threshold:
                continue
            dow = row["dow"]
            hour = row["hour"]
            if 0 <= dow < 7 and 0 <= hour < 24:
                matrix[dow][hour] = (opens / sends) if sends > 0 else 0.0
        return {
            "matrix": matrix,
            "sample_size": sample_total,
            "threshold": threshold,
        }

    async def get_daily_sends(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        days: int = 30,
    ) -> list[dict]:
        repository = EmailBroadcastRepository.from_session(session)
        return await repository.get_daily_sends(organization_id, days)

    async def get_top_links(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        days: int = 14,
        limit: int = 10,
    ) -> list[dict]:
        repository = EmailBroadcastRepository.from_session(session)
        return await repository.get_top_links(organization_id, days, limit=limit)

    async def get_device_share(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        days: int = 90,
    ) -> list[dict]:
        repository = EmailBroadcastRepository.from_session(session)
        return await repository.get_device_share(organization_id, days)

    async def get_daily_engagement(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        days: int = 14,
    ) -> list[dict]:
        repository = EmailBroadcastRepository.from_session(session)
        return await repository.get_daily_engagement(organization_id, days)


email_broadcast = EmailBroadcastService()
