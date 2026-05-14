from datetime import datetime
from uuid import UUID

from pydantic import Field

from polar.entitlements.schemas import (
    Entitlements,
    TierFeatures,
    TierLimits,
    TransactionFee,
)
from polar.entitlements.tiers import TierKey
from polar.kit.schemas import Schema


class TierPlan(Schema):
    """A subscribable tier plan, as exposed to creators in the upgrade UI."""

    tier: TierKey = Field(description="Tier identifier.")
    name: str = Field(description="Display name, e.g. 'Spaire Pro'.")
    description: str | None = Field(description="Marketing description.")
    product_id: UUID | None = Field(
        description=(
            "Platform-org Product id backing this tier (None if no product "
            "has been seeded yet)."
        )
    )
    monthly_price_cents: int = Field(
        description="Monthly recurring price for this tier, in cents."
    )
    currency: str = Field(default="usd", description="Currency code (lowercased).")
    trial_days: int | None = Field(
        description="Trial duration in days, if any (Pro has 14)."
    )
    transaction_fee: TransactionFee
    features: TierFeatures
    limits: TierLimits


class TierPlanList(Schema):
    items: list[TierPlan]


class CurrentSpaireSubscription(Schema):
    """The caller's current Spaire subscription state (billing-side info,
    complementary to the entitlements snapshot)."""

    tier: TierKey
    status: str = Field(
        description=(
            "Subscription status — 'active', 'trialing', 'past_due', "
            "'canceled', or 'none' when no subscription exists."
        )
    )
    monthly_price_cents: int = Field(
        description="Recurring monthly cost in cents (0 for Free/Legacy)."
    )
    currency: str = Field(default="usd")
    current_period_end: datetime | None = Field(
        description="When the current billing period ends."
    )
    trial_end: datetime | None = Field(
        description="When the trial period ends, if currently trialing."
    )
    cancel_at_period_end: bool = Field(
        description="Whether the subscription is scheduled to cancel."
    )
    entitlements: Entitlements


class UpgradeCheckoutCreate(Schema):
    tier: TierKey = Field(
        description="Target tier to upgrade to (must be Pro or Scale)."
    )
    success_url: str | None = Field(
        default=None,
        description=(
            "URL the customer will be redirected to after a successful "
            "checkout. The {CHECKOUT_ID} placeholder is replaced with the "
            "completed checkout's id."
        ),
    )
    billing_email: str | None = Field(
        default=None,
        description=(
            "Email address for Spaire's own billing of this subscription. "
            "If omitted, the calling user's email is used. Stored on the "
            "platform-org customer record so invoices and receipts reach "
            "the creator."
        ),
    )


class UpgradeCheckout(Schema):
    checkout_id: UUID
    checkout_url: str
    client_secret: str


class SwitchPlan(Schema):
    tier: TierKey = Field(
        description=(
            "Target tier. Must be a different paid tier than the current "
            "one (e.g. pro -> scale or scale -> pro). Use the cancel "
            "endpoint to downgrade to Free."
        )
    )


class CancelSpaireSubscription(Schema):
    """Schedule the current Spaire subscription for cancellation at the
    end of the current billing period. The org will be auto-resubscribed
    to Free when the cancellation revokes."""

    pass


class CustomerPortalSessionCreate(Schema):
    return_url: str | None = Field(
        default=None,
        description=(
            "URL the customer portal will link back to (shows a 'Back' "
            "control). Use the dashboard URL the creator came from."
        ),
    )


class CustomerPortalSession(Schema):
    token: str = Field(description="Short-lived customer portal token.")
    expires_at: datetime
    customer_portal_url: str = Field(
        description=(
            "URL the creator visits to manage their Spaire subscription "
            "(view invoices, change payment method, cancel)."
        )
    )


class EmailSenderDomainStatus(Schema):
    domain: str | None = Field(
        description="Configured custom sender domain (None if cleared)."
    )
    verified_at: datetime | None = Field(
        description="When DKIM verification last succeeded."
    )
    resend_id: str | None = Field(
        description="Resend's domain id, present once registered."
    )
    dns_records: list[dict[str, str | int | None]] | None = Field(
        description=(
            "DNS records the creator must install (TXT/MX/CNAME). Each "
            "entry follows Resend's payload shape (record, name, value, "
            "type, status, ttl)."
        )
    )
