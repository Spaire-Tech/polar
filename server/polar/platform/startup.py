"""Startup verification for Spaire-on-Spaire billing.

When SPAIRE_PLATFORM_ORG_ID is set, the API requires the four tier
products (legacy, free, pro, scale) and the four overage meters to
exist on the platform org. Without them:

  - organization.created actor can't subscribe new orgs to Free
    (TierProductMissing), leaving them with no platform subscription.
  - EntitlementsService falls back to "legacy" for those orgs.
  - Legacy uses settings.PLATFORM_FEE_BASIS_POINTS (400 = 4%) instead
    of Free's 500 (5%) — every new signup silently undercharges by
    1%+10c until ops notices.

This module surfaces that failure mode at boot time. Run
`uv run task seed_platform_products` before starting the API on any
environment where PLATFORM_ORG_ID is set.

Single-tenant / development setups (PLATFORM_ORG_ID unset) skip the
check.
"""

import structlog

from polar.entitlements.tiers import TierKey
from polar.kit.db.postgres import AsyncSession
from polar.platform.repository import platform_product_repository
from polar.platform.service import (
    PlatformError,
    platform as platform_service,
)

log: structlog.stdlib.BoundLogger = structlog.get_logger()


class PlatformStartupError(Exception):
    """Raised at API startup when the platform-org configuration is
    incomplete. The traceback message lists the missing prerequisites
    so the operator knows exactly what to run."""


_REQUIRED_TIERS = (TierKey.legacy, TierKey.free, TierKey.pro, TierKey.scale)


async def verify_platform_setup(session: AsyncSession) -> None:
    """Block boot if PLATFORM_ORG_ID is set but the seed hasn't been
    run. No-op when PLATFORM_ORG_ID is unset (development / single-
    tenant).
    """
    if not platform_service.is_configured():
        log.info("platform.startup.not_configured")
        return

    try:
        platform_org = await platform_service.get(session)
    except PlatformError as exc:
        raise PlatformStartupError(
            f"SPAIRE_PLATFORM_ORG_ID is set but the organization does not "
            f"exist. {exc.message}"
        ) from exc

    product_repo = platform_product_repository(session)
    missing_tiers: list[str] = []
    for tier in _REQUIRED_TIERS:
        product = await product_repo.get_by_tier(platform_org.id, tier.value)
        if product is None:
            missing_tiers.append(tier.value)

    if missing_tiers:
        raise PlatformStartupError(
            f"Platform organization '{platform_org.slug}' is missing tier "
            f"products: {', '.join(missing_tiers)}. Run "
            "`uv run task seed_platform_products` before starting the API. "
            "Without these products new signups silently fall back to legacy "
            "entitlements and undercharged transaction fees."
        )

    log.info(
        "platform.startup.ok",
        platform_org_id=str(platform_org.id),
        tiers=[t.value for t in _REQUIRED_TIERS],
    )
