from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.organization import Organization
    from polar.models.product import Product


# Per-organization newsletter publication. A Newsletter is the long-lived
# brand container (masthead, theme, default sender). Individual issues
# live in NewsletterPost. A Newsletter MAY be tied to a paid Product —
# when present, a "newsletter_access" benefit on that product grants the
# customer a NewsletterSubscription row.
class Newsletter(RecordModel):
    __tablename__ = "newsletters"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "slug", name="newsletters_org_slug_key"
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    # Optional link to a paid Product. When set, the newsletter has a
    # paid tier; when null, the newsletter is free-only (anyone with an
    # email can subscribe). Posts can still be marked paid-only via
    # audience targeting even when product_id is null (in which case the
    # author manages tiers manually via segments).
    product_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="set null"),
        nullable=True,
        default=None,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # URL-friendly identifier, unique within the organization. Powers
    # the public archive route /{org}/newsletter/{newsletter_slug}.
    slug: Mapped[str] = mapped_column(String(200), nullable=False, index=True)

    # Display wordmark rendered above the cover in emails / web posts.
    # Empty string when the author wants no masthead.
    masthead: Mapped[str] = mapped_column(
        String(200), nullable=False, default="", server_default=""
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    cover_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, default=None
    )

    default_sender_name: Mapped[str | None] = mapped_column(
        String(100), nullable=True, default=None
    )
    default_sender_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    default_reply_to_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )

    # Theme tokens (colors / typography / spacing / per-element overrides).
    # JSONB for now so Phase 4 can iterate on the shape without migrations.
    # The recommended shape (see PHASE-4 plan) mirrors the design's
    # `doc.style` object: outsideBg, postBg, textBg, primary, textPrimary,
    # secondary, links, headingFont, bodyFont, baseSize, lineHeight,
    # headerSize, sectionPadding, blockGap, borderRadius, elements: {...}.
    theme: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def product(cls) -> Mapped["Product | None"]:
        return relationship("Product", lazy="raise")
