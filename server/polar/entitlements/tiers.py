"""Static tier definitions — the source of truth for what each tier includes.

These mirror the customer-facing PRICING.md table. When updating prices or
limits here, update PRICING.md in the same PR.
"""

from dataclasses import dataclass
from enum import StrEnum

from polar.config import settings


class TierKey(StrEnum):
    free = "free"
    pro = "pro"
    scale = "scale"
    # Fallback for orgs that don't have a platform-org subscription yet:
    # either because the platform is not configured (single-tenant /
    # development), the grandfather migration hasn't run, or the org is
    # the platform org itself. Treated as "unlimited" — no enforcement.
    legacy = "legacy"


@dataclass(frozen=True)
class TransactionFee:
    """List price for the tier's transaction fee.

    The actually-charged fee is stored on Account._platform_fee_percent and
    Account._platform_fee_fixed. Tier sync (PR 5) keeps Account aligned with
    the tier; Scale customers with negotiated rates may diverge. Use this
    field for UI display ("list rate"); use the Account fields for actual
    fee deduction.
    """

    percent_basis_points: int  # 500 = 5.00%
    fixed_cents: int  # 50 = $0.50


@dataclass(frozen=True)
class TierLimits:
    """Quota caps. None = unlimited / no enforcement."""

    published_courses: int | None
    lessons_per_course: int | None
    video_hours_hosted: int | None
    video_views_monthly: int | None
    storage_gb: int | None
    email_subscribers: int | None
    email_sends_monthly: int | None
    dashboard_team_seats: int | None


@dataclass(frozen=True)
class TierFeatures:
    """Boolean feature gates."""

    # Pro+
    drip_scheduling: bool
    email_sequences_and_segments: bool
    email_ab_testing: bool
    stackable_discounts: bool
    custom_email_sender_domain: bool
    seat_based_product_pricing: bool
    cohort_analytics: bool
    # Scale+
    custom_pricing_negotiation: bool
    customer_wallet: bool
    white_label_course_player: bool
    sandbox_mode: bool
    custom_storefront_domain: bool
    custom_checkout_domain: bool
    sso: bool
    audit_logs: bool


@dataclass(frozen=True)
class TierEntitlements:
    """Everything a downstream consumer needs to know about a tier."""

    tier: TierKey
    transaction_fee: TransactionFee
    limits: TierLimits
    features: TierFeatures
    rate_limit_group: str
    # The monthly fee Spaire charges for this tier itself (informational —
    # the actual billing is driven by the platform-org subscription).
    monthly_price_cents: int
    # Soft overage grace above the limit, expressed as a percent. Free
    # and Legacy use 0% (hard-block at the limit). Pro and Scale use 10%
    # so creators are not surprised by abrupt blocks when they slightly
    # exceed their cap; the overage is recorded for billing reconciliation.
    overage_grace_pct: int


# `legacy` matches the behavior the platform had before tier billing existed:
# unlimited everything, fee from the global config default. This is the
# fallback for any org that doesn't have an active platform-org subscription.
_LEGACY = TierEntitlements(
    tier=TierKey.legacy,
    transaction_fee=TransactionFee(
        percent_basis_points=settings.PLATFORM_FEE_BASIS_POINTS,
        fixed_cents=settings.PLATFORM_FEE_FIXED,
    ),
    limits=TierLimits(
        published_courses=None,
        lessons_per_course=None,
        video_hours_hosted=None,
        video_views_monthly=None,
        storage_gb=None,
        email_subscribers=None,
        email_sends_monthly=None,
        dashboard_team_seats=None,
    ),
    features=TierFeatures(
        drip_scheduling=True,
        email_sequences_and_segments=True,
        email_ab_testing=True,
        stackable_discounts=True,
        custom_email_sender_domain=True,
        seat_based_product_pricing=True,
        cohort_analytics=True,
        custom_pricing_negotiation=True,
        customer_wallet=True,
        white_label_course_player=True,
        sandbox_mode=True,
        custom_storefront_domain=True,
        custom_checkout_domain=True,
        sso=True,
        audit_logs=True,
    ),
    rate_limit_group="default",
    monthly_price_cents=0,
    overage_grace_pct=0,
)


_FREE = TierEntitlements(
    tier=TierKey.free,
    transaction_fee=TransactionFee(percent_basis_points=500, fixed_cents=50),
    limits=TierLimits(
        published_courses=1,
        lessons_per_course=10,
        video_hours_hosted=5,
        video_views_monthly=1000,
        storage_gb=1,
        email_subscribers=1000,
        email_sends_monthly=5000,
        dashboard_team_seats=1,
    ),
    features=TierFeatures(
        drip_scheduling=False,
        email_sequences_and_segments=False,
        email_ab_testing=False,
        stackable_discounts=False,
        custom_email_sender_domain=False,
        seat_based_product_pricing=False,
        cohort_analytics=False,
        custom_pricing_negotiation=False,
        customer_wallet=False,
        white_label_course_player=False,
        sandbox_mode=False,
        custom_storefront_domain=False,
        custom_checkout_domain=False,
        sso=False,
        audit_logs=False,
    ),
    rate_limit_group="default",
    monthly_price_cents=0,
    overage_grace_pct=0,
)


_PRO = TierEntitlements(
    tier=TierKey.pro,
    transaction_fee=TransactionFee(percent_basis_points=400, fixed_cents=40),
    limits=TierLimits(
        published_courses=None,
        lessons_per_course=None,
        video_hours_hosted=50,
        video_views_monthly=50_000,
        storage_gb=25,
        email_subscribers=25_000,
        email_sends_monthly=250_000,
        dashboard_team_seats=5,
    ),
    features=TierFeatures(
        drip_scheduling=True,
        email_sequences_and_segments=True,
        email_ab_testing=True,
        stackable_discounts=True,
        custom_email_sender_domain=True,
        seat_based_product_pricing=True,
        cohort_analytics=True,
        custom_pricing_negotiation=False,
        customer_wallet=False,
        white_label_course_player=False,
        sandbox_mode=False,
        custom_storefront_domain=False,
        custom_checkout_domain=False,
        sso=False,
        audit_logs=False,
    ),
    rate_limit_group="elevated",
    monthly_price_cents=4900,
    overage_grace_pct=10,
)


_SCALE = TierEntitlements(
    tier=TierKey.scale,
    transaction_fee=TransactionFee(percent_basis_points=350, fixed_cents=30),
    limits=TierLimits(
        published_courses=None,
        lessons_per_course=None,
        video_hours_hosted=None,
        video_views_monthly=None,
        storage_gb=None,
        email_subscribers=None,
        email_sends_monthly=2_000_000,
        dashboard_team_seats=None,
    ),
    features=TierFeatures(
        drip_scheduling=True,
        email_sequences_and_segments=True,
        email_ab_testing=True,
        stackable_discounts=True,
        custom_email_sender_domain=True,
        seat_based_product_pricing=True,
        cohort_analytics=True,
        custom_pricing_negotiation=True,
        customer_wallet=True,
        white_label_course_player=True,
        sandbox_mode=True,
        custom_storefront_domain=False,
        custom_checkout_domain=False,
        sso=False,
        audit_logs=True,
    ),
    rate_limit_group="elevated",
    monthly_price_cents=29900,
    overage_grace_pct=10,
)


def get_definition(tier: TierKey) -> TierEntitlements:
    return _TIER_DEFINITIONS[tier]


_TIER_DEFINITIONS: dict[TierKey, TierEntitlements] = {
    TierKey.free: _FREE,
    TierKey.pro: _PRO,
    TierKey.scale: _SCALE,
    TierKey.legacy: _LEGACY,
}
