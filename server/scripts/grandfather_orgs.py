"""Grandfather every existing creator organization onto the Spaire Legacy
plan.

Background: PRs 1-5 wired up tiered pricing. New orgs are auto-subscribed
to Free on creation (PR 4). Orgs that existed before the auto-subscribe
hook deployed have no platform-org subscription, so EntitlementsService
returns the `legacy` sentinel, the fee falls back to the global default,
and no tier enforcement happens.

This script gives those orgs an explicit Legacy subscription, which:
  - Preserves their current transaction fee (Legacy tier == global default)
  - Keeps unlimited quotas (no enforcement)
  - Marks them with subscription.user_metadata.managed_by = "grandfather_v1"
    so we can identify and migrate them later when ready.

Idempotent and safe to re-run. Orgs that already have any active
platform-org subscription (including a Free one created by PR 4 after
the script ran) are skipped.

Usage:
    python -m scripts.grandfather_orgs run
    python -m scripts.grandfather_orgs run --dry-run
    python -m scripts.grandfather_orgs run --limit 100
"""

import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from sqlalchemy import select

from polar.entitlements.tiers import TierKey
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Organization
from polar.platform.billing import TierProductMissing, platform_billing
from polar.platform.repository import (
    platform_customer_repository,
    platform_product_repository,
    platform_subscription_repository,
)
from polar.platform.service import (
    PlatformError,
    platform as platform_service,
)
from polar.postgres import create_async_engine

cli = typer.Typer()


GRANDFATHER_TAG = "grandfather_v1"


class GrandfatherStats:
    __slots__ = (
        "scanned",
        "grandfathered",
        "already_subscribed",
        "skipped_platform_org",
    )

    def __init__(self) -> None:
        self.scanned = 0
        self.grandfathered = 0
        self.already_subscribed = 0
        self.skipped_platform_org = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "scanned": self.scanned,
            "grandfathered": self.grandfathered,
            "already_subscribed": self.already_subscribed,
            "skipped_platform_org": self.skipped_platform_org,
        }


async def grandfather_organizations(
    session: Any,
    *,
    platform_org: Organization,
    dry_run: bool = False,
    limit: int | None = None,
    on_progress: Any = None,
) -> GrandfatherStats:
    """Scan all non-platform orgs and ensure a Legacy subscription exists.

    Idempotent. Orgs that already have any active platform-org subscription
    are skipped without modification. Orgs without one are subscribed to
    the Legacy product (managed_by="grandfather_v1") unless dry_run=True.

    `on_progress(action: str, organization: Organization)` is called for
    each org with action ∈ {"grandfathered", "would_grandfather", "skip"}.
    """
    customer_repo = platform_customer_repository(session)
    subscription_repo = platform_subscription_repository(session)
    stats = GrandfatherStats()

    statement = (
        select(Organization)
        .where(Organization.deleted_at.is_(None))
        .where(Organization.id != platform_org.id)
        .order_by(Organization.created_at)
    )
    if limit is not None:
        statement = statement.limit(limit)

    orgs_stream = await session.stream_scalars(statement)
    async for organization in orgs_stream:
        stats.scanned += 1

        if platform_service.is_platform_organization(organization.id):
            stats.skipped_platform_org += 1
            continue

        existing_customer = await customer_repo.get_for_creator_org(
            platform_org.id, organization.id
        )
        if existing_customer is not None:
            existing_sub = await subscription_repo.get_active_for_customer(
                existing_customer.id
            )
            if existing_sub is not None:
                stats.already_subscribed += 1
                if on_progress is not None:
                    on_progress("skip", organization)
                continue

        if dry_run:
            stats.grandfathered += 1
            if on_progress is not None:
                on_progress("would_grandfather", organization)
            continue

        await platform_billing.ensure_subscription(
            session,
            organization,
            tier=TierKey.legacy,
            managed_by=GRANDFATHER_TAG,
        )
        stats.grandfathered += 1
        if on_progress is not None:
            on_progress("grandfathered", organization)

    return stats


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command(
    help=(
        "Subscribe every pre-existing creator org to the Spaire Legacy plan. "
        "Idempotent — orgs that already have a subscription are skipped."
    )
)
@typer_async
async def run(
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Show what would change without writing."
    ),
    limit: int | None = typer.Option(
        None, "--limit", help="Process at most N orgs (for staged rollouts)."
    ),
) -> None:
    if not platform_service.is_configured():
        typer.echo(
            "❌ SPAIRE_PLATFORM_ORG_ID is not set. "
            "Configure it before running the grandfather migration.",
            err=True,
        )
        raise typer.Exit(code=1)

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        try:
            platform_org = await platform_service.get(session)
        except PlatformError as e:
            typer.echo(f"❌ {e.message}", err=True)
            raise typer.Exit(code=1) from e

        # Pre-flight: verify the Legacy product exists.
        product_repo = platform_product_repository(session)
        legacy_product = await product_repo.get_by_tier(
            platform_org.id, TierKey.legacy.value
        )
        if legacy_product is None:
            typer.echo(
                "❌ Spaire Legacy product not found. Run "
                "`uv run task seed_platform_products` first.",
                err=True,
            )
            raise typer.Exit(code=1)

        typer.echo(
            f"Platform organization: {platform_org.name} "
            f"(id={platform_org.id})\n"
            f"Legacy product:        {legacy_product.id}\n"
            f"Mode:                  {'DRY RUN' if dry_run else 'WRITE'}\n"
        )

        def _emit(action: str, organization: Organization) -> None:
            label = {
                "grandfathered": "✓ grandfathered",
                "would_grandfather": "✓ would grandfather",
                "skip": "· skip",
            }.get(action, action)
            typer.echo(f"  {label}  {organization.slug:<40} ({organization.id})")

        try:
            stats = await grandfather_organizations(
                session,
                platform_org=platform_org,
                dry_run=dry_run,
                limit=limit,
                on_progress=_emit,
            )
        except TierProductMissing as e:
            typer.echo(f"❌ {e.message}", err=True)
            raise typer.Exit(code=1) from e

        if not dry_run:
            await session.commit()

        typer.echo("\nSummary:")
        for key, count in stats.as_dict().items():
            typer.echo(f"  {key:<22} {count}")

        if dry_run:
            typer.echo("\n(dry-run — no changes committed)")
        else:
            typer.echo("\n✓ Grandfather migration complete.")


if __name__ == "__main__":
    cli()
