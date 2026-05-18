from collections.abc import Sequence
from typing import Literal
from uuid import UUID

from polar.email_broadcast.render import render_blocks_to_html
from polar.email_subscriber.repository import EmailSubscriberRepository
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models.customer import Customer
from polar.models.email_subscriber import EmailSubscriber, EmailSubscriberStatus
from polar.models.newsletter import Newsletter
from polar.models.newsletter_post import (
    NewsletterPost,
    NewsletterPostStatus,
)
from polar.models.newsletter_subscription import (
    NewsletterSubscription,
    NewsletterSubscriptionStatus,
    NewsletterSubscriptionTier,
)
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .repository import (
    NewsletterPostRepository,
    NewsletterRepository,
    NewsletterSubscriptionRepository,
)
from .schemas import (
    NewsletterCreate,
    NewsletterPostCreate,
    NewsletterPostUpdate,
    NewsletterUpdate,
)


class NewsletterError(PolarError): ...


class NewsletterNotFound(NewsletterError):
    def __init__(self, newsletter_id: UUID) -> None:
        super().__init__(f"Newsletter {newsletter_id} not found")


class NewsletterPostNotFound(NewsletterError):
    def __init__(self, post_id: UUID) -> None:
        super().__init__(f"Newsletter post {post_id} not found")


class NewsletterPostAlreadyPublished(NewsletterError):
    def __init__(self, post_id: UUID) -> None:
        super().__init__(
            f"Newsletter post {post_id} has already been published or is sending"
        )


class NewsletterService:
    # ---- Newsletter CRUD ---------------------------------------------

    async def get_by_id(
        self, session: AsyncSession, newsletter_id: UUID
    ) -> Newsletter | None:
        repo = NewsletterRepository.from_session(session)
        return await repo.get_by_id(newsletter_id)

    async def get_by_product(
        self, session: AsyncSession, product_id: UUID
    ) -> Newsletter | None:
        repo = NewsletterRepository.from_session(session)
        statement = repo.get_by_product_statement(product_id)
        return await repo.get_one_or_none(statement)

    async def list_by_organization(
        self, session: AsyncSession, organization_id: UUID
    ) -> Sequence[Newsletter]:
        repo = NewsletterRepository.from_session(session)
        statement = repo.get_by_organization_statement(organization_id)
        return await repo.get_all(statement)

    async def create(
        self, session: AsyncSession, create_schema: NewsletterCreate
    ) -> Newsletter:
        repo = NewsletterRepository.from_session(session)
        newsletter = Newsletter(
            organization_id=create_schema.organization_id,
            product_id=create_schema.product_id,
            name=create_schema.name,
            slug=create_schema.slug,
            masthead=create_schema.masthead,
            description=create_schema.description,
            cover_url=create_schema.cover_url,
            default_sender_name=create_schema.default_sender_name,
            default_sender_email=create_schema.default_sender_email,
            default_reply_to_email=create_schema.default_reply_to_email,
            theme=create_schema.theme or {},
        )
        return await repo.create(newsletter, flush=True)

    async def update(
        self,
        session: AsyncSession,
        newsletter: Newsletter,
        update_schema: NewsletterUpdate,
    ) -> Newsletter:
        repo = NewsletterRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(newsletter, key, value)
        return await repo.update(newsletter)

    async def delete(
        self, session: AsyncSession, newsletter: Newsletter
    ) -> None:
        repo = NewsletterRepository.from_session(session)
        await repo.soft_delete(newsletter)

    # ---- Post CRUD ---------------------------------------------------

    async def get_post_by_id(
        self, session: AsyncSession, post_id: UUID
    ) -> NewsletterPost | None:
        repo = NewsletterPostRepository.from_session(session)
        return await repo.get_by_id(post_id)

    async def list_posts(
        self, session: AsyncSession, newsletter_id: UUID
    ) -> Sequence[NewsletterPost]:
        repo = NewsletterPostRepository.from_session(session)
        statement = repo.get_by_newsletter_statement(newsletter_id).order_by(
            NewsletterPost.created_at.desc()
        )
        return await repo.get_all(statement)

    async def create_post(
        self,
        session: AsyncSession,
        newsletter: Newsletter,
        create_schema: NewsletterPostCreate,
    ) -> NewsletterPost:
        repo = NewsletterPostRepository.from_session(session)

        # Regenerate the HTML mirror whenever content_json is present, so
        # the eventual send / archive render always matches the stored
        # JSON. Same invariant as EmailBroadcast.
        content_html: str | None = None
        if create_schema.content_json:
            content_html = render_blocks_to_html(create_schema.content_json)

        post = NewsletterPost(
            newsletter_id=newsletter.id,
            organization_id=newsletter.organization_id,
            title=create_schema.title,
            subtitle=create_schema.subtitle,
            slug=create_schema.slug,
            cover_url=create_schema.cover_url,
            cover_visible=create_schema.cover_visible,
            tags=list(create_schema.tags or []),
            content_json=create_schema.content_json,
            content_html=content_html,
            theme_overrides=create_schema.theme_overrides,
            channel=create_schema.channel,
            send_mode=create_schema.send_mode,
            scheduled_at=create_schema.scheduled_at,
            audience_tier=create_schema.audience_tier,
            audience_segment_id=create_schema.audience_segment_id,
            audience_filter_rules=create_schema.audience_filter_rules,
            subject_override=create_schema.subject_override,
            preview_text_override=create_schema.preview_text_override,
            show_socials=create_schema.show_socials,
            show_likes_comments=create_schema.show_likes_comments,
            custom_read_online_url=create_schema.custom_read_online_url,
            audio_enabled=create_schema.audio_enabled,
            audio_url=create_schema.audio_url,
            web_thumbnail_url=create_schema.web_thumbnail_url,
            web_thumbnail_on_top=create_schema.web_thumbnail_on_top,
            seo_meta_title=create_schema.seo_meta_title,
            seo_meta_description=create_schema.seo_meta_description,
            status=NewsletterPostStatus.draft,
        )
        return await repo.create(post, flush=True)

    async def update_post(
        self,
        session: AsyncSession,
        post: NewsletterPost,
        update_schema: NewsletterPostUpdate,
    ) -> NewsletterPost:
        repo = NewsletterPostRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True)

        # If content_json was patched, regenerate the HTML so the send
        # pipeline doesn't ship stale markup.
        if "content_json" in update_dict:
            update_dict["content_html"] = (
                render_blocks_to_html(update_dict["content_json"]) or None
            )

        for key, value in update_dict.items():
            setattr(post, key, value)
        return await repo.update(post)

    async def delete_post(
        self, session: AsyncSession, post: NewsletterPost
    ) -> None:
        repo = NewsletterPostRepository.from_session(session)
        await repo.soft_delete(post)

    # ---- Publish bridge ----------------------------------------------

    async def publish_post(
        self,
        session: AsyncSession,
        post: NewsletterPost,
    ) -> NewsletterPost:
        """Publish a post.

        Transitions the post into the right status given its channel and
        send_mode, and enqueues a background job that materialises the
        EmailBroadcast and triggers the send (for any channel that
        includes email). For web-only posts the publish is synchronous
        — there's no send to wait on.
        """
        if post.status in (
            NewsletterPostStatus.sending,
            NewsletterPostStatus.published,
        ):
            raise NewsletterPostAlreadyPublished(post.id)

        repo = NewsletterPostRepository.from_session(session)
        now = utc_now()

        if post.channel == "web_only":
            post.status = NewsletterPostStatus.published
            post.published_at = now
            await repo.update(post)
            return post

        # Email or Email+Web — fan out via worker so the API request
        # returns immediately; the worker creates the EmailBroadcast
        # and enqueues per-recipient sends.
        if post.send_mode == "scheduled" and post.scheduled_at is not None:
            post.status = NewsletterPostStatus.scheduled
        else:
            post.status = NewsletterPostStatus.sending

        await repo.update(post)

        enqueue_job("newsletter.post.publish", post_id=post.id)
        return post

    # ---- Subscriptions (called by benefit strategy) -----------------

    async def get_subscription_by_id(
        self, session: AsyncSession, subscription_id: UUID
    ) -> NewsletterSubscription | None:
        repo = NewsletterSubscriptionRepository.from_session(session)
        return await repo.get_by_id(subscription_id)

    async def subscribe_customer(
        self,
        session: AsyncSession,
        *,
        newsletter_id: UUID,
        customer: Customer,
        tier: Literal["free", "paid"] = "free",
    ) -> NewsletterSubscription:
        """Subscribe a paying customer to a newsletter.

        Reuses (or creates) an EmailSubscriber row for the customer's
        email so the broadcast send pipeline has somewhere to push to.
        If the customer is already actively subscribed, returns the
        existing row — idempotent so benefit re-grants are safe.
        """
        sub_repo = NewsletterSubscriptionRepository.from_session(session)
        existing = await sub_repo.get_active_by_customer(
            newsletter_id, customer.id
        )
        if existing is not None:
            # Promote a free→paid tier if the new benefit upgrades them,
            # but never downgrade silently.
            if (
                tier == NewsletterSubscriptionTier.paid
                and existing.tier != NewsletterSubscriptionTier.paid
            ):
                existing.tier = NewsletterSubscriptionTier.paid
                await sub_repo.update(existing)
            return existing

        # Reuse or create an EmailSubscriber row for the customer's email.
        # The unique constraint on (organization_id, email) makes this safe.
        subscriber_repo = EmailSubscriberRepository.from_session(session)
        newsletter_repo = NewsletterRepository.from_session(session)
        newsletter = await newsletter_repo.get_by_id(newsletter_id)
        if newsletter is None:
            raise NewsletterNotFound(newsletter_id)

        subscriber = await subscriber_repo.get_by_email_and_organization(
            customer.email, newsletter.organization_id
        )
        if subscriber is None:
            subscriber = EmailSubscriber(
                organization_id=newsletter.organization_id,
                email=customer.email,
                customer_id=customer.id,
                status=EmailSubscriberStatus.active,
                source="purchase",
            )
            await subscriber_repo.create(subscriber, flush=True)
        elif subscriber.customer_id is None:
            subscriber.customer_id = customer.id
            await subscriber_repo.update(subscriber)

        subscription = NewsletterSubscription(
            newsletter_id=newsletter_id,
            customer_id=customer.id,
            email_subscriber_id=subscriber.id,
            status=NewsletterSubscriptionStatus.active,
            tier=tier,
            subscribed_at=utc_now(),
        )
        return await sub_repo.create(subscription, flush=True)

    async def revoke_subscription(
        self, session: AsyncSession, subscription_id: UUID
    ) -> None:
        sub_repo = NewsletterSubscriptionRepository.from_session(session)
        subscription = await sub_repo.get_by_id(subscription_id)
        if subscription is None:
            return
        subscription.status = NewsletterSubscriptionStatus.unsubscribed
        subscription.unsubscribed_at = utc_now()
        await sub_repo.update(subscription)


newsletter_service = NewsletterService()
