from uuid import UUID

import structlog

from polar.email_broadcast.render import render_blocks_to_html
from polar.email_broadcast.repository import EmailBroadcastRepository
from polar.exceptions import PolarTaskError
from polar.kit.utils import utc_now
from polar.models.email_broadcast import EmailBroadcast, EmailBroadcastStatus
from polar.models.newsletter_post import NewsletterPostStatus
from polar.organization.repository import OrganizationRepository
from polar.worker import AsyncSessionMaker, TaskPriority, actor, enqueue_job

from .repository import NewsletterPostRepository, NewsletterRepository

log = structlog.get_logger()


class NewsletterTaskError(PolarTaskError): ...


class NewsletterPostNotFoundForTask(NewsletterTaskError):
    def __init__(self, post_id: UUID) -> None:
        super().__init__(f"NewsletterPost {post_id} not found for publish task")


def _merge_theme(newsletter_theme: dict | None, overrides: dict | None) -> dict:
    """Shallow merge: newsletter theme is the base, post overrides win.

    Nested element-level overrides are NOT deep-merged here — Phase 4 can
    decide whether to support that. For V1, an override of `colors` would
    replace the entire `colors` sub-object.
    """
    base = dict(newsletter_theme or {})
    if overrides:
        base.update(overrides)
    return base


@actor(actor_name="newsletter.post.publish", priority=TaskPriority.HIGH)
async def newsletter_post_publish(post_id: UUID) -> None:
    """Materialise an EmailBroadcast for a published post and trigger send.

    This is the Phase 0 bridge — we lean on the existing
    `email_broadcast` send pipeline rather than duplicating the
    per-recipient fan-out, retry, and tracking logic. The broadcast is
    created in `draft`, then transitioned to `scheduled`/`sending` so
    the existing dispatchers pick it up.
    """
    async with AsyncSessionMaker() as session:
        post_repo = NewsletterPostRepository.from_session(session)
        post = await post_repo.get_by_id(post_id)
        if post is None:
            raise NewsletterPostNotFoundForTask(post_id)

        newsletter_repo = NewsletterRepository.from_session(session)
        newsletter = await newsletter_repo.get_by_id(post.newsletter_id)
        if newsletter is None:
            # Newsletter was deleted while the publish job was queued.
            # Mark the post failed and bail — there's nothing to send.
            post.status = NewsletterPostStatus.failed
            await post_repo.update(post)
            return

        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_id(post.organization_id)

        # Re-render HTML at send time so theme changes between save and
        # publish are picked up. Pass the merged theme down once the
        # renderer is theme-aware (Phase 4); for now `render_blocks_to_html`
        # ignores any theme arg, so this still produces the hardcoded-style
        # email.
        _theme = _merge_theme(newsletter.theme, post.theme_overrides)
        content_html = render_blocks_to_html(post.content_json or {}) or ""

        subject = (
            post.subject_override
            or post.title
            or newsletter.name
        )
        preview_text = post.preview_text_override or post.subtitle
        sender_name = (
            newsletter.default_sender_name
            or (organization.name if organization else "Newsletter")
        )
        sender_email = newsletter.default_sender_email
        reply_to_email = newsletter.default_reply_to_email

        broadcast = EmailBroadcast(
            organization_id=post.organization_id,
            subject=subject,
            preview_text=preview_text,
            sender_name=sender_name,
            reply_to_email=reply_to_email,
            content_json=post.content_json,
            content_html=content_html,
            segment_id=post.audience_segment_id,
            filter_rules=post.audience_filter_rules,
            status=EmailBroadcastStatus.draft,
        )
        if sender_email:
            broadcast.sender_email = sender_email

        broadcast_repo = EmailBroadcastRepository.from_session(session)
        broadcast = await broadcast_repo.create(broadcast, flush=True)

        post.broadcast_id = broadcast.id
        await post_repo.update(post)

        # Hand off to the existing email_broadcast send actors. They
        # handle the per-recipient fan-out, A/B logic, scheduled vs
        # immediate dispatch, retries, and analytics.
        if post.send_mode == "scheduled" and post.scheduled_at is not None:
            broadcast.status = EmailBroadcastStatus.scheduled
            broadcast.scheduled_at = post.scheduled_at
            await broadcast_repo.update(broadcast)
            # The email_broadcast cron picks up scheduled rows when due.
        else:
            broadcast.status = EmailBroadcastStatus.sending
            await broadcast_repo.update(broadcast)
            enqueue_job(
                "email_broadcast.send_emails", broadcast_id=broadcast.id
            )
            post.status = NewsletterPostStatus.published
            post.published_at = utc_now()
            await post_repo.update(post)
