from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.email_broadcast import EmailBroadcast
    from polar.models.email_segment import EmailSegment
    from polar.models.newsletter import Newsletter
    from polar.models.organization import Organization


class NewsletterPostStatus(StrEnum):
    draft = "draft"
    scheduled = "scheduled"
    sending = "sending"
    published = "published"
    failed = "failed"
    archived = "archived"


class NewsletterPostChannel(StrEnum):
    email_and_web = "email_and_web"
    email_only = "email_only"
    web_only = "web_only"


class NewsletterPostAudienceTier(StrEnum):
    all_subscribers = "all"
    paid_only = "paid"


class NewsletterPostSendMode(StrEnum):
    send_now = "send_now"
    smart_time = "smart_time"
    scheduled = "scheduled"
    drip_tz = "drip_tz"


class NewsletterPost(RecordModel):
    __tablename__ = "newsletter_posts"
    __table_args__ = (
        # Slug uniqueness per-newsletter, not per-org. Two different
        # newsletters can both have a post slugged "welcome".
        UniqueConstraint(
            "newsletter_id", "slug", name="newsletter_posts_newsletter_slug_key"
        ),
    )

    newsletter_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("newsletters.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    # Denormalised from Newsletter.organization_id so we can build the
    # `get_readable_statement` org filter without joining newsletters
    # on every query.
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    # ---- Content -----------------------------------------------------

    title: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    subtitle: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    slug: Mapped[str] = mapped_column(String(200), nullable=False, index=True)

    cover_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, default=None
    )
    cover_visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Free-form content tags. Array of strings. Used for filtering in the
    # archive and as a hint to the recommender; not a foreign key.
    tags: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )

    # Block document — same shape as EmailBroadcast.content_json
    # (extended with newsletter-specific block types: pull, callout,
    # gallery, embed, poll, paywall, audio).
    content_json: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, default=None
    )

    # Server-rendered HTML mirror. Regenerated whenever content_json
    # changes. Source of truth for both email send and web archive
    # render.
    content_html: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )

    # Per-post overrides on top of the Newsletter.theme. Sparse — only
    # fields the author actually changed. None = inherit fully.
    theme_overrides: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, default=None
    )

    # ---- Publication state -------------------------------------------

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=NewsletterPostStatus.draft
    )

    channel: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=NewsletterPostChannel.email_and_web,
        server_default=NewsletterPostChannel.email_and_web.value,
    )

    send_mode: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=NewsletterPostSendMode.send_now,
        server_default=NewsletterPostSendMode.send_now.value,
    )

    scheduled_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    published_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None, index=True
    )

    # ---- Audience ----------------------------------------------------

    audience_tier: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=NewsletterPostAudienceTier.all_subscribers,
        server_default=NewsletterPostAudienceTier.all_subscribers.value,
    )

    # Optional saved segment. NULL means "use audience_tier + filter_rules".
    audience_segment_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("email_segments.id", ondelete="set null"),
        nullable=True,
        default=None,
    )

    # Optional ad-hoc filter rules (same shape as
    # EmailBroadcast.filter_rules — segment service consumes it).
    audience_filter_rules: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, default=None
    )

    # ---- Linked broadcast --------------------------------------------

    # Set when publish() spawns an EmailBroadcast for the send. Used to
    # show send analytics on the post and to dedupe re-publishes.
    broadcast_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("email_broadcasts.id", ondelete="set null"),
        nullable=True,
        default=None,
        index=True,
    )

    # ---- Email-specific options --------------------------------------

    # Overrides Newsletter defaults when set.
    subject_override: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    preview_text_override: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )

    show_socials: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    show_likes_comments: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    custom_read_online_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, default=None
    )

    # ---- Audio newsletter --------------------------------------------

    audio_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    audio_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, default=None
    )

    # ---- Web post settings -------------------------------------------

    web_thumbnail_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, default=None
    )
    web_thumbnail_on_top: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    seo_meta_title: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )
    seo_meta_description: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    @declared_attr
    def newsletter(cls) -> Mapped["Newsletter"]:
        return relationship("Newsletter", lazy="raise")

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def broadcast(cls) -> Mapped["EmailBroadcast | None"]:
        return relationship("EmailBroadcast", lazy="raise")

    @declared_attr
    def audience_segment(cls) -> Mapped["EmailSegment | None"]:
        return relationship("EmailSegment", lazy="raise")
