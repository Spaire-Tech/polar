from collections.abc import Sequence
from typing import Literal
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.email_broadcast.render import render_blocks_to_html
from polar.email_broadcast.repository import EmailBroadcastRepository
from polar.models import User

from .theme import resolve_theme
from polar.email_subscriber.repository import EmailSubscriberRepository
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.models.customer import Customer
from polar.models.email_broadcast import EmailBroadcast, EmailBroadcastStatus
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
from polar.models.organization import Organization
from polar.organization.repository import OrganizationRepository
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


def truncate_at_paywall(
    content_json: dict | None,
) -> tuple[dict | None, bool]:
    """Return content with everything after the first paywall block dropped.

    Used for non-entitled public viewers — they see the lead-in plus
    the paywall block (which renders the upsell CTA), but nothing past
    it. The second tuple element is True when truncation happened so
    callers can flag the response as gated.

    Returns the original content_json untouched when there's no
    paywall block, when content_json is None / malformed, or when the
    paywall is the very first block (in which case there's nothing
    above it to show anyway — the caller still flags it as gated).
    """
    if not isinstance(content_json, dict):
        return content_json, False
    blocks = content_json.get("blocks")
    if not isinstance(blocks, list):
        return content_json, False
    cut: int | None = None
    for i, b in enumerate(blocks):
        if isinstance(b, dict) and b.get("type") == "paywall":
            cut = i
            break
    if cut is None:
        return content_json, False
    # Keep the paywall block itself in the rendered output — it carries
    # the upsell CTA. Strip everything after.
    return {**content_json, "blocks": blocks[: cut + 1]}, True


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

    async def send_test_post(
        self,
        session: AsyncSession,
        post: NewsletterPost,
        *,
        to_email: str,
    ) -> EmailBroadcast:
        """Send a single test render of `post` to `to_email`.

        Implementation reuses the broadcast pipeline: we materialise a
        draft EmailBroadcast (same shape the publish task creates),
        persist it, then hand off to email_broadcast's test-send
        dispatcher. The broadcast row sticks around as a record of the
        test send — cheap to keep, and useful for the author to see
        what render the test recipient actually saw.
        """
        newsletter_repo = NewsletterRepository.from_session(session)
        newsletter = await newsletter_repo.get_by_id(post.newsletter_id)

        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_id(post.organization_id)

        subject = (
            post.subject_override or post.title or (newsletter.name if newsletter else "")
        )
        preview_text = post.preview_text_override or post.subtitle
        sender_name = (
            (newsletter.default_sender_name if newsletter else None)
            or (organization.name if organization else "Newsletter")
        )
        sender_email = newsletter.default_sender_email if newsletter else None
        reply_to_email = newsletter.default_reply_to_email if newsletter else None

        theme = resolve_theme(
            newsletter.theme if newsletter else None,
            post.theme_overrides,
        )
        content_html = render_blocks_to_html(post.content_json or {}, theme) or ""

        broadcast = EmailBroadcast(
            organization_id=post.organization_id,
            subject=subject,
            preview_text=preview_text,
            sender_name=sender_name,
            reply_to_email=reply_to_email,
            content_json=post.content_json,
            content_html=content_html,
            status=EmailBroadcastStatus.draft,
        )
        if sender_email:
            broadcast.sender_email = sender_email

        broadcast_repo = EmailBroadcastRepository.from_session(session)
        broadcast = await broadcast_repo.create(broadcast, flush=True)

        # Hand off to the existing email_broadcast test pipeline so we
        # inherit retries, [TEST] subject prefix, tracking, and Resend
        # idempotency.
        enqueue_job(
            "email_broadcast.send_test",
            broadcast_id=broadcast.id,
            to_email=to_email,
        )

        # Soft-delete the broadcast row immediately so the org's
        # broadcasts list isn't littered with one entry per test send.
        # The worker still loads the broadcast via `session.get()`
        # (which ignores the soft-delete filter), so this doesn't race
        # with the send. (Audit fix #20 / fix-list #5b.)
        broadcast.deleted_at = utc_now()
        await broadcast_repo.update(broadcast)
        return broadcast

    # ---- Paid-tier setup --------------------------------------------

    async def setup_paid_access(
        self,
        session: AsyncSession,
        newsletter: Newsletter,
        auth_subject: AuthSubject[User | Organization],
        *,
        product_name: str,
        amount: int,
        currency: str,
        recurring_interval: Literal["month", "year"] | None,
    ) -> tuple[Newsletter, "object"]:
        """Create the Product + newsletter_access Benefit + linkage in
        one atomic-ish swing.

        Built for the onboarding wizard's pricing step. Idempotent at
        the entry point — re-running on an already-linked newsletter
        raises rather than spawning a duplicate Product.

        The newsletter_access benefit type is internal (not part of
        the public BenefitCreate union), so we instantiate the row
        directly here rather than going through benefit_service. The
        BenefitGrant lifecycle takes care of customer-side enrolment
        via the strategy we registered in Phase 0.
        """
        # Imports are local to keep the newsletter package's import
        # surface clean and avoid a top-level cycle with product /
        # benefit.
        from polar.benefit.repository import BenefitRepository
        from polar.models import Benefit, Product
        from polar.models.benefit import BenefitType
        from polar.product.repository import ProductRepository
        from polar.product.schemas import (
            ProductCreateOneTime,
            ProductCreateRecurring,
            ProductPriceFixedCreate,
        )
        from polar.product.service import product as product_service

        if newsletter.product_id is not None:
            raise NewsletterError(
                "Newsletter already has a paid product attached"
            )

        price = ProductPriceFixedCreate(
            amount_type="fixed",
            price_amount=amount,
            price_currency=currency,
        )
        if recurring_interval is None:
            create_schema: ProductCreateOneTime | ProductCreateRecurring = (
                ProductCreateOneTime(
                    name=product_name,
                    description=newsletter.description,
                    organization_id=newsletter.organization_id,
                    prices=[price],
                )
            )
        else:
            create_schema = ProductCreateRecurring(
                name=product_name,
                description=newsletter.description,
                organization_id=newsletter.organization_id,
                recurring_interval=recurring_interval,
                prices=[price],
            )
        product: Product = await product_service.create(
            session, create_schema, auth_subject
        )

        # Instantiate the newsletter_access benefit directly. We're
        # bypassing the closed BenefitCreate Pydantic union (which
        # intentionally omits internal grant types) — the underlying
        # model column is a generic StringEnum so this is safe.
        benefit_repo = BenefitRepository.from_session(session)
        benefit = Benefit(
            type=BenefitType.newsletter_access,
            description=f"Access to {newsletter.name}",
            is_tax_applicable=True,
            selectable=False,  # Author-managed; not user-pickable.
            deletable=False,  # Tied to the newsletter's lifecycle.
            organization_id=newsletter.organization_id,
            properties={"newsletter_id": str(newsletter.id)},
        )
        benefit = await benefit_repo.create(benefit, flush=True)

        # Attach the benefit to the new product. Reuses the same code
        # path the dashboard's product-benefits picker drives, so
        # downstream invalidation hooks (webhooks, search indexes)
        # fire as if the user had wired it manually.
        await product_service.update_benefits(
            session, product, [benefit.id], auth_subject
        )

        # Finally, link the product to the newsletter so the rest of
        # the codebase (audience-tier checks, the storefront paid
        # badge, future analytics) can find it.
        newsletter_repo = NewsletterRepository.from_session(session)
        newsletter.product_id = product.id
        await newsletter_repo.update(newsletter)

        return newsletter, product

    # ---- Public archive ---------------------------------------------

    async def get_public_post(
        self,
        session: AsyncSession,
        *,
        organization_slug: str,
        post_slug: str,
        viewer_entitled: bool = False,
    ) -> (
        tuple[NewsletterPost, Newsletter, Organization, str, bool] | None
    ):
        """Resolve a publicly-readable post by org slug + post slug.

        Returns ``(post, newsletter, organization, content_html, gated)``
        when the post exists, is published, and the channel includes
        web (``email_and_web`` or ``web_only``). When the post has a
        paywall block and ``viewer_entitled`` is False, the content is
        truncated and ``gated`` is True so callers can show the upsell
        state.

        Returns ``None`` when the org or post can't be found, or when
        the post isn't public-readable (draft, email-only, soft-deleted).
        We deliberately don't distinguish "not found" from "not public"
        in the public response so we don't leak draft slugs.
        """
        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_slug(organization_slug)
        if organization is None:
            return None

        post_repo = NewsletterPostRepository.from_session(session)
        post = await post_repo.get_public_by_slug(organization.id, post_slug)
        if post is None:
            return None

        newsletter_repo = NewsletterRepository.from_session(session)
        newsletter = await newsletter_repo.get_by_id(post.newsletter_id)
        if newsletter is None:
            # Newsletter deleted after the post published — same
            # not-public-anymore treatment.
            return None

        # Resolve theme + gate-truncate content + render fresh HTML.
        # We don't trust the stored content_html cache here: the theme
        # may have changed since publish and the cache was rendered
        # against whatever theme was active at the time.
        content_json, gated = truncate_at_paywall(post.content_json)
        if gated and viewer_entitled:
            content_json = post.content_json
            gated = False
        theme = resolve_theme(newsletter.theme, post.theme_overrides)
        content_html = render_blocks_to_html(content_json or {}, theme) or ""

        return post, newsletter, organization, content_html, gated

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
