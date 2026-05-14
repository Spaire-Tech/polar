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


class UpgradeCheckout(Schema):
    checkout_id: UUID
    checkout_url: str
    client_secret: str
