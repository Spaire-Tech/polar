"""Add newsletters, newsletter_posts, newsletter_subscriptions

Revision ID: 7c8d3e2f9a01
Revises: 6f4a9d2c1b08
Create Date: 2026-05-18 12:00:00.000000

Phase 0 of the newsletter feature. Three new tables:

  - newsletters: per-organization publication container. Brand-level
    settings (name, masthead, theme, default sender) shared across
    every post in the publication. Optionally tied to a paid Product
    so a `newsletter_access` benefit can grant subscriptions to it.
  - newsletter_posts: individual issues. Block-document content
    (mirror of EmailBroadcast.content_json) plus per-post audience,
    schedule, channel (email/web/both), SEO, audio, and theme
    overrides. On publish, a NewsletterPost spawns one EmailBroadcast
    that drives the actual per-recipient send pipeline.
  - newsletter_subscriptions: junction created by the newsletter_access
    benefit strategy. Bridges Customer (or anonymous EmailSubscriber)
    to a Newsletter with a free/paid tier and active/unsubscribed
    status — so a customer can be subscribed to Newsletter A and
    unsubscribed from Newsletter B without disturbing their overall
    org-level EmailSubscriber row.

The BenefitType enum gains `newsletter_access` but no schema change is
required for that — BenefitType is stored as a `String(50)` via the
StringEnum SQLAlchemy type, with validation in Python only.

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "7c8d3e2f9a01"
down_revision = "6f4a9d2c1b08"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ---- newsletters --------------------------------------------------
    op.create_table(
        "newsletters",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column(
            "masthead",
            sa.String(length=200),
            nullable=False,
            server_default="",
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_url", sa.String(length=2048), nullable=True),
        sa.Column("default_sender_name", sa.String(length=100), nullable=True),
        sa.Column("default_sender_email", sa.String(length=255), nullable=True),
        sa.Column("default_reply_to_email", sa.String(length=255), nullable=True),
        sa.Column(
            "theme",
            JSONB(),
            nullable=False,
            server_default="{}",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["products.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id", "slug", name="newsletters_org_slug_key"
        ),
    )
    op.create_index(
        op.f("ix_newsletters_organization_id"),
        "newsletters",
        ["organization_id"],
    )
    op.create_index(
        op.f("ix_newsletters_product_id"),
        "newsletters",
        ["product_id"],
    )
    op.create_index(
        op.f("ix_newsletters_slug"), "newsletters", ["slug"]
    )

    # ---- newsletter_posts --------------------------------------------
    op.create_table(
        "newsletter_posts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("newsletter_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("subtitle", sa.String(length=500), nullable=True),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("cover_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "cover_visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "tags", JSONB(), nullable=False, server_default="[]"
        ),
        sa.Column("content_json", JSONB(), nullable=True),
        sa.Column("content_html", sa.Text(), nullable=True),
        sa.Column("theme_overrides", JSONB(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "channel",
            sa.String(length=20),
            nullable=False,
            server_default="email_and_web",
        ),
        sa.Column(
            "send_mode",
            sa.String(length=20),
            nullable=False,
            server_default="send_now",
        ),
        sa.Column("scheduled_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "audience_tier",
            sa.String(length=20),
            nullable=False,
            server_default="all",
        ),
        sa.Column("audience_segment_id", sa.Uuid(), nullable=True),
        sa.Column("audience_filter_rules", JSONB(), nullable=True),
        sa.Column("broadcast_id", sa.Uuid(), nullable=True),
        sa.Column("subject_override", sa.String(length=255), nullable=True),
        sa.Column("preview_text_override", sa.String(length=200), nullable=True),
        sa.Column(
            "show_socials",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "show_likes_comments",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("custom_read_online_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "audio_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("audio_url", sa.String(length=2048), nullable=True),
        sa.Column("web_thumbnail_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "web_thumbnail_on_top",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("seo_meta_title", sa.String(length=200), nullable=True),
        sa.Column("seo_meta_description", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(
            ["newsletter_id"], ["newsletters.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["audience_segment_id"], ["email_segments.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["broadcast_id"], ["email_broadcasts.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "newsletter_id", "slug", name="newsletter_posts_newsletter_slug_key"
        ),
    )
    op.create_index(
        op.f("ix_newsletter_posts_newsletter_id"),
        "newsletter_posts",
        ["newsletter_id"],
    )
    op.create_index(
        op.f("ix_newsletter_posts_organization_id"),
        "newsletter_posts",
        ["organization_id"],
    )
    op.create_index(
        op.f("ix_newsletter_posts_slug"),
        "newsletter_posts",
        ["slug"],
    )
    op.create_index(
        op.f("ix_newsletter_posts_published_at"),
        "newsletter_posts",
        ["published_at"],
    )
    op.create_index(
        op.f("ix_newsletter_posts_broadcast_id"),
        "newsletter_posts",
        ["broadcast_id"],
    )

    # ---- newsletter_subscriptions ------------------------------------
    op.create_table(
        "newsletter_subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("newsletter_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("email_subscriber_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "tier",
            sa.String(length=20),
            nullable=False,
            server_default="free",
        ),
        sa.Column("subscribed_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("unsubscribed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["newsletter_id"], ["newsletters.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"], ["customers.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["email_subscriber_id"],
            ["email_subscribers.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_newsletter_subscriptions_newsletter_id"),
        "newsletter_subscriptions",
        ["newsletter_id"],
    )
    op.create_index(
        op.f("ix_newsletter_subscriptions_customer_id"),
        "newsletter_subscriptions",
        ["customer_id"],
    )
    op.create_index(
        op.f("ix_newsletter_subscriptions_email_subscriber_id"),
        "newsletter_subscriptions",
        ["email_subscriber_id"],
    )
    # Unique active (newsletter, customer). NULL customer rows are
    # excluded so anonymous-only signups don't clash with paying ones.
    op.create_index(
        "ix_newsletter_subscriptions_newsletter_customer_active",
        "newsletter_subscriptions",
        ["newsletter_id", "customer_id"],
        unique=True,
        postgresql_where=sa.text(
            "deleted_at IS NULL AND customer_id IS NOT NULL"
        ),
    )
    # Unique active (newsletter, email_subscriber) for free-list rows
    # without a Customer. Once a customer_id arrives the row is
    # considered "paid" and falls under the index above instead.
    op.create_index(
        "ix_newsletter_subscriptions_newsletter_subscriber_active",
        "newsletter_subscriptions",
        ["newsletter_id", "email_subscriber_id"],
        unique=True,
        postgresql_where=sa.text(
            "deleted_at IS NULL AND email_subscriber_id IS NOT NULL "
            "AND customer_id IS NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_newsletter_subscriptions_newsletter_subscriber_active",
        table_name="newsletter_subscriptions",
    )
    op.drop_index(
        "ix_newsletter_subscriptions_newsletter_customer_active",
        table_name="newsletter_subscriptions",
    )
    op.drop_index(
        op.f("ix_newsletter_subscriptions_email_subscriber_id"),
        table_name="newsletter_subscriptions",
    )
    op.drop_index(
        op.f("ix_newsletter_subscriptions_customer_id"),
        table_name="newsletter_subscriptions",
    )
    op.drop_index(
        op.f("ix_newsletter_subscriptions_newsletter_id"),
        table_name="newsletter_subscriptions",
    )
    op.drop_table("newsletter_subscriptions")

    op.drop_index(
        op.f("ix_newsletter_posts_broadcast_id"),
        table_name="newsletter_posts",
    )
    op.drop_index(
        op.f("ix_newsletter_posts_published_at"),
        table_name="newsletter_posts",
    )
    op.drop_index(op.f("ix_newsletter_posts_slug"), table_name="newsletter_posts")
    op.drop_index(
        op.f("ix_newsletter_posts_organization_id"),
        table_name="newsletter_posts",
    )
    op.drop_index(
        op.f("ix_newsletter_posts_newsletter_id"),
        table_name="newsletter_posts",
    )
    op.drop_table("newsletter_posts")

    op.drop_index(op.f("ix_newsletters_slug"), table_name="newsletters")
    op.drop_index(op.f("ix_newsletters_product_id"), table_name="newsletters")
    op.drop_index(op.f("ix_newsletters_organization_id"), table_name="newsletters")
    op.drop_table("newsletters")
