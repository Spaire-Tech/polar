"""Static tier definitions — the source of truth for what each tier includes.

These mirror the customer-facing PRICING.md table. When updating prices or
limits here, update PRICING.md in the same PR.
"""

from dataclasses import dataclass
from enum import StrEnum

from polar.config import settings


class TierKey(StrEnum):
    pro = "pro"
    studio = "studio"
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
    active_email_sequences: int | None
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
    # Soft overage grace above the limit, expressed as a percent. Legacy
    # uses 0% (no enforcement anyway). Pro/Studio/Scale use 10% so
    # creators are not surprised by abrupt blocks when they slightly
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
        active_email_sequences=None,
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


_PRO = TierEntitlements(
    tier=TierKey.pro,
    transaction_fee=TransactionFee(percent_basis_points=400, fixed_cents=40),
    limits=TierLimits(
        # Tight caps on Pro by design — the cheapest tier intentionally
        # squeezes any creator with a real catalog / list / team into
        # Studio so the $80 jump pays for itself.
        published_courses=3,
        lessons_per_course=50,
        active_email_sequences=1,
        video_hours_hosted=10,
        video_views_monthly=5_000,
        storage_gb=5,
        email_subscribers=1_000,
        email_sends_monthly=10_000,
        dashboard_team_seats=1,
    ),
    features=TierFeatures(
        drip_scheduling=True,
        # email_sequences gate exists; the limit on the count lives in
        # TierLimits.active_email_sequences. Pro gets 1; Studio gets 10.
        email_sequences_and_segments=True,
        # Pulled up to Studio+. Pro doesn't get A/B testing — most Pro
        # customers have lists under 1,000, where A/B testing has no
        # statistical power anyway.
        email_ab_testing=False,
        # stackable_discounts: roadmap — discount engine doesn't support
        # combining codes yet. Flip to True when the engine ships it.
        stackable_discounts=False,
        # Pulled up to Studio+. Domain warming + DKIM is a serious-
        # business need; making it a Studio differentiator helps justify
        # the Studio price.
        custom_email_sender_domain=False,
        # Pulled up to Studio+. B2B seat pricing is for orgs selling to
        # other orgs — that's not a $49 starter use case.
        seat_based_product_pricing=False,
        # cohort_analytics: roadmap — only basic churn rate is computed
        # today. Flip to True when retention curves and segment-level
        # cohort views ship.
        cohort_analytics=False,
        custom_pricing_negotiation=False,
        customer_wallet=False,
        white_label_course_player=False,
        # Sandbox is a separate environment (sandbox.spairehq.com)
        # available to every creator; the entitlement is informational
        # and not used as a require_feature gate.
        sandbox_mode=True,
        custom_storefront_domain=False,
        custom_checkout_domain=False,
        sso=False,
        audit_logs=False,
    ),
    rate_limit_group="elevated",
    monthly_price_cents=4900,
    overage_grace_pct=10,
)


_STUDIO = TierEntitlements(
    tier=TierKey.studio,
    transaction_fee=TransactionFee(percent_basis_points=380, fixed_cents=35),
    limits=TierLimits(
        # Studio is the "real business" tier — generous on courses /
        # lessons / sequences (no working creator hits these caps often)
        # but bounded on contacts / sends / video so Scale stays
        # meaningful.
        published_courses=15,
        lessons_per_course=None,
        active_email_sequences=10,
        video_hours_hosted=50,
        video_views_monthly=50_000,
        storage_gb=50,
        email_subscribers=10_000,
        email_sends_monthly=100_000,
        dashboard_team_seats=5,
    ),
    features=TierFeatures(
        drip_scheduling=True,
        email_sequences_and_segments=True,
        email_ab_testing=True,
        # stackable_discounts: roadmap — see Pro definition.
        stackable_discounts=False,
        custom_email_sender_domain=True,
        seat_based_product_pricing=True,
        # cohort_analytics: roadmap — see Pro definition.
        cohort_analytics=False,
        custom_pricing_negotiation=False,
        customer_wallet=True,
        white_label_course_player=True,
        # See Pro definition.
        sandbox_mode=True,
        custom_storefront_domain=False,
        custom_checkout_domain=False,
        sso=False,
        audit_logs=False,
    ),
    rate_limit_group="elevated",
    monthly_price_cents=12900,
    overage_grace_pct=10,
)


_SCALE = TierEntitlements(
    tier=TierKey.scale,
    transaction_fee=TransactionFee(percent_basis_points=350, fixed_cents=30),
    limits=TierLimits(
        # Scale caps are the ceiling above which custom pricing kicks
        # in. Anything bigger → talk-to-sales. Email sequences are
        # genuinely unlimited because a Scale customer running enough
        # parallel funnels to abuse this is already paying $299/mo.
        published_courses=100,
        lessons_per_course=None,
        active_email_sequences=None,
        video_hours_hosted=200,
        video_views_monthly=250_000,
        storage_gb=250,
        email_subscribers=50_000,
        email_sends_monthly=500_000,
        dashboard_team_seats=20,
    ),
    features=TierFeatures(
        drip_scheduling=True,
        email_sequences_and_segments=True,
        email_ab_testing=True,
        # stackable_discounts: roadmap — see Pro definition.
        stackable_discounts=False,
        custom_email_sender_domain=True,
        seat_based_product_pricing=True,
        # cohort_analytics: roadmap — see Pro definition.
        cohort_analytics=False,
        custom_pricing_negotiation=True,
        customer_wallet=True,
        white_label_course_player=True,
        # See Pro definition.
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
    TierKey.pro: _PRO,
    TierKey.studio: _STUDIO,
    TierKey.scale: _SCALE,
    TierKey.legacy: _LEGACY,
}
