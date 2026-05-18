from datetime import datetime
from typing import Literal

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema


# ---- Newsletter -----------------------------------------------------


class NewsletterBase(Schema):
    name: str = Field(max_length=200)
    slug: str = Field(max_length=200)
    masthead: str = Field(default="", max_length=200)
    description: str | None = None
    cover_url: str | None = Field(default=None, max_length=2048)
    default_sender_name: str | None = Field(default=None, max_length=100)
    default_sender_email: str | None = Field(default=None, max_length=255)
    default_reply_to_email: str | None = Field(default=None, max_length=255)
    theme: dict = Field(default_factory=dict)


class NewsletterCreate(NewsletterBase):
    organization_id: UUID4
    product_id: UUID4 | None = None


class NewsletterUpdate(Schema):
    name: str | None = Field(default=None, max_length=200)
    slug: str | None = Field(default=None, max_length=200)
    masthead: str | None = Field(default=None, max_length=200)
    description: str | None = None
    cover_url: str | None = Field(default=None, max_length=2048)
    default_sender_name: str | None = Field(default=None, max_length=100)
    default_sender_email: str | None = Field(default=None, max_length=255)
    default_reply_to_email: str | None = Field(default=None, max_length=255)
    theme: dict | None = None
    product_id: UUID4 | None = None


class NewsletterRead(TimestampedSchema, NewsletterBase):
    id: UUID4
    organization_id: UUID4
    product_id: UUID4 | None


# ---- Newsletter posts -----------------------------------------------


_Channel = Literal["email_and_web", "email_only", "web_only"]
_AudienceTier = Literal["all", "paid"]
_SendMode = Literal["send_now", "smart_time", "scheduled", "drip_tz"]
_Status = Literal[
    "draft", "scheduled", "sending", "published", "failed", "archived"
]


class NewsletterPostBase(Schema):
    title: str = Field(default="", max_length=500)
    subtitle: str | None = Field(default=None, max_length=500)
    slug: str = Field(max_length=200)
    cover_url: str | None = Field(default=None, max_length=2048)
    cover_visible: bool = True
    tags: list[str] = Field(default_factory=list)
    content_json: dict | None = None
    theme_overrides: dict | None = None

    channel: _Channel = "email_and_web"
    send_mode: _SendMode = "send_now"
    scheduled_at: datetime | None = None

    audience_tier: _AudienceTier = "all"
    audience_segment_id: UUID4 | None = None
    audience_filter_rules: dict | None = None

    subject_override: str | None = Field(default=None, max_length=255)
    preview_text_override: str | None = Field(default=None, max_length=200)
    show_socials: bool = True
    show_likes_comments: bool = False
    custom_read_online_url: str | None = Field(default=None, max_length=2048)

    audio_enabled: bool = False
    audio_url: str | None = Field(default=None, max_length=2048)

    web_thumbnail_url: str | None = Field(default=None, max_length=2048)
    web_thumbnail_on_top: bool = False
    seo_meta_title: str | None = Field(default=None, max_length=200)
    seo_meta_description: str | None = Field(default=None, max_length=500)


class NewsletterPostCreate(NewsletterPostBase):
    newsletter_id: UUID4


class NewsletterPostUpdate(Schema):
    # All optional — PATCH semantics. Pass None to clear when the
    # column is nullable, omit to leave untouched.
    title: str | None = Field(default=None, max_length=500)
    subtitle: str | None = Field(default=None, max_length=500)
    slug: str | None = Field(default=None, max_length=200)
    cover_url: str | None = Field(default=None, max_length=2048)
    cover_visible: bool | None = None
    tags: list[str] | None = None
    content_json: dict | None = None
    theme_overrides: dict | None = None

    channel: _Channel | None = None
    send_mode: _SendMode | None = None
    scheduled_at: datetime | None = None

    audience_tier: _AudienceTier | None = None
    audience_segment_id: UUID4 | None = None
    audience_filter_rules: dict | None = None

    subject_override: str | None = Field(default=None, max_length=255)
    preview_text_override: str | None = Field(default=None, max_length=200)
    show_socials: bool | None = None
    show_likes_comments: bool | None = None
    custom_read_online_url: str | None = Field(default=None, max_length=2048)

    audio_enabled: bool | None = None
    audio_url: str | None = Field(default=None, max_length=2048)

    web_thumbnail_url: str | None = Field(default=None, max_length=2048)
    web_thumbnail_on_top: bool | None = None
    seo_meta_title: str | None = Field(default=None, max_length=200)
    seo_meta_description: str | None = Field(default=None, max_length=500)


class NewsletterPostRead(TimestampedSchema, NewsletterPostBase):
    id: UUID4
    newsletter_id: UUID4
    organization_id: UUID4
    content_html: str | None
    status: _Status
    published_at: datetime | None
    broadcast_id: UUID4 | None


# ---- Subscription -----------------------------------------------------


class NewsletterPublicPostRead(Schema):
    """Public read schema for the web-archive route. Mirrors the fields
    a public reader actually needs — no audience config, no scheduling,
    no broadcast id — plus a server-rendered ``content_html`` that already
    has the theme applied (so the public page doesn't ship the theme
    dict to the browser) and a ``gated`` flag flipped by the paywall
    truncation."""

    id: UUID4
    organization_id: UUID4
    organization_slug: str
    organization_name: str
    newsletter_id: UUID4
    newsletter_name: str
    newsletter_masthead: str
    title: str
    subtitle: str | None
    slug: str
    cover_url: str | None
    cover_visible: bool
    tags: list[str]
    content_html: str
    published_at: datetime | None
    web_thumbnail_url: str | None
    web_thumbnail_on_top: bool
    seo_meta_title: str | None
    seo_meta_description: str | None
    audio_enabled: bool
    audio_url: str | None
    gated: bool
    # Resolved theme dict so the public page can colour the wrapper
    # chrome (outside bg / masthead colour) to match the email render.
    # The block HTML is already baked above.
    theme: dict


class NewsletterSubscriptionRead(TimestampedSchema):
    id: UUID4
    newsletter_id: UUID4
    customer_id: UUID4 | None
    email_subscriber_id: UUID4 | None
    status: Literal["active", "unsubscribed"]
    tier: Literal["free", "paid"]
    subscribed_at: datetime
    unsubscribed_at: datetime | None


# ---- AI transform ----------------------------------------------------


class NewsletterPostAITransformRequest(Schema):
    text: str = Field(min_length=1, max_length=4000)
    action: Literal["polish", "shorter", "longer", "grammar", "tone"]
    # Free-form tone label used when action == "tone"
    # (e.g. "warm", "formal", "playful"). Ignored otherwise.
    tone: str | None = Field(default=None, max_length=40)


class NewsletterPostAITransformResponse(Schema):
    text: str
