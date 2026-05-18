from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.customer import Customer
    from polar.models.email_subscriber import EmailSubscriber
    from polar.models.newsletter import Newsletter


class NewsletterSubscriptionStatus(StrEnum):
    active = "active"
    unsubscribed = "unsubscribed"


class NewsletterSubscriptionTier(StrEnum):
    free = "free"
    paid = "paid"


# Junction between a Newsletter and a Customer (paid) or
# EmailSubscriber (free). Created by the newsletter_access benefit
# strategy on grant, and torn down (status=unsubscribed) on revoke.
#
# Why a junction instead of reusing EmailSubscriber's segment system:
# - We need a per-newsletter status (a customer can be subscribed to
#   Newsletter A and unsubscribed from Newsletter B without leaving the
#   org's overall subscriber list).
# - We need to know whether the subscription is `free` or `paid` at the
#   newsletter level (drives which posts they can read).
class NewsletterSubscription(RecordModel):
    __tablename__ = "newsletter_subscriptions"
    __table_args__ = (
        # One active subscription per (newsletter, customer). Soft-
        # deleted rows excluded so resubscribe-after-cancel works.
        Index(
            "ix_newsletter_subscriptions_newsletter_customer_active",
            "newsletter_id",
            "customer_id",
            unique=True,
            postgresql_where="deleted_at IS NULL AND customer_id IS NOT NULL",
        ),
        # And one per (newsletter, email_subscriber) for free-list
        # signups that aren't tied to a Customer record yet.
        Index(
            "ix_newsletter_subscriptions_newsletter_subscriber_active",
            "newsletter_id",
            "email_subscriber_id",
            unique=True,
            postgresql_where=(
                "deleted_at IS NULL AND email_subscriber_id IS NOT NULL "
                "AND customer_id IS NULL"
            ),
        ),
    )

    newsletter_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("newsletters.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    email_subscriber_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("email_subscribers.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=NewsletterSubscriptionStatus.active
    )

    tier: Mapped[str] = mapped_column(
        String(20), nullable=False, default=NewsletterSubscriptionTier.free
    )

    subscribed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    unsubscribed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def newsletter(cls) -> Mapped["Newsletter"]:
        return relationship("Newsletter", lazy="raise")

    @declared_attr
    def customer(cls) -> Mapped["Customer | None"]:
        return relationship("Customer", lazy="raise")

    @declared_attr
    def email_subscriber(cls) -> Mapped["EmailSubscriber | None"]:
        return relationship("EmailSubscriber", lazy="raise")
