"""Seed the Pro/Studio/Scale subscription products and overage meters in
the Spaire platform organization.

Idempotent: re-running updates existing rows in place rather than creating
duplicates. Products and meters are identified by metadata tier key and
name respectively, both scoped to the platform organization.

Usage:
    python -m scripts.seed_platform_products run
    python -m scripts.seed_platform_products run --dry-run
"""

import asyncio
import logging.config
from dataclasses import dataclass
from functools import wraps
from typing import Any
from uuid import UUID

import structlog
import typer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.trial import TrialInterval
from polar.meter.aggregation import (
    AggregationFunction,
    CountAggregation,
    PropertyAggregation,
)
from polar.meter.filter import (
    Filter,
    FilterClause,
    FilterConjunction,
    FilterOperator,
)
from polar.models import (
    Meter,
    Organization,
    Product,
    ProductPrice,
)
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceFixed,
    ProductPriceFree,
)
from polar.platform.service import PlatformError, platform as platform_service
from polar.postgres import create_async_engine

cli = typer.Typer()


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


# ---------------------------------------------------------------------------
# Specs — the source of truth for what Spaire Pro/Studio/Scale look like.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class MeterSpec:
    name: str
    event_name: str
    aggregation_func: AggregationFunction
    aggregation_property: str | None  # None = count

    def build_filter(self) -> Filter:
        return Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(
                    property="name",
                    operator=FilterOperator.eq,
                    value=self.event_name,
                )
            ],
        )

    def build_aggregation(
        self,
    ) -> CountAggregation | PropertyAggregation:
        if self.aggregation_func == AggregationFunction.cnt:
            return CountAggregation()
        assert self.aggregation_property is not None
        return PropertyAggregation(
            func=self.aggregation_func,  # type: ignore[arg-type]
            property=self.aggregation_property,
        )


METER_SPECS: list[MeterSpec] = [
    # Sum of duration_seconds on every video upload. Entitlements service
    # divides by 3600 to compare against the per-tier hour cap.
    MeterSpec(
        name="spaire.video_hours_hosted",
        event_name="spaire.video.uploaded",
        aggregation_func=AggregationFunction.sum,
        aggregation_property="duration_seconds",
    ),
    # Count of video plays. Compared against per-tier monthly view cap.
    MeterSpec(
        name="spaire.video_views_monthly",
        event_name="spaire.video.viewed",
        aggregation_func=AggregationFunction.cnt,
        aggregation_property=None,
    ),
    # Sum of bytes_delta (positive on upload, negative on delete). Entitlements
    # service divides by 1024^3 to compare against the per-tier GB cap.
    MeterSpec(
        name="spaire.storage_bytes",
        event_name="spaire.storage.bytes",
        aggregation_func=AggregationFunction.sum,
        aggregation_property="bytes_delta",
    ),
    # Count of outbound emails sent. Compared against per-tier monthly send cap.
    MeterSpec(
        name="spaire.email_sends_monthly",
        event_name="spaire.email.sent",
        aggregation_func=AggregationFunction.cnt,
        aggregation_property=None,
    ),
]


@dataclass(frozen=True)
class TrialSpec:
    interval: TrialInterval
    count: int


@dataclass(frozen=True)
class PriceSpec:
    amount_type: ProductPriceAmountType
    price_currency: str = "usd"
    price_amount_cents: int | None = None  # required if amount_type == fixed


@dataclass(frozen=True)
class ProductSpec:
    tier: str  # "pro" | "studio" | "scale" | "legacy" — stamped onto user_metadata["tier"]
    name: str
    description: str
    recurring_interval: SubscriptionRecurringInterval
    price: PriceSpec
    trial: TrialSpec | None = None


PRODUCT_SPECS: list[ProductSpec] = [
    ProductSpec(
        tier="legacy",
        name="Spaire Legacy",
        description=(
            "Grandfathered plan for organizations created before tiered "
            "pricing existed. Preserves the pre-tier transaction fee "
            "(global default), no quota enforcement, full feature access. "
            "Not available for new signups."
        ),
        recurring_interval=SubscriptionRecurringInterval.month,
        price=PriceSpec(amount_type=ProductPriceAmountType.free),
    ),
    ProductSpec(
        tier="pro",
        name="Spaire Pro",
        description=(
            "For solo creators. $49/month + 4% + $0.40 per transaction. "
            "Unlimited courses, email sequences, custom email sender domain, "
            "B2B seat-based pricing, embedded checkout. 14-day free trial."
        ),
        recurring_interval=SubscriptionRecurringInterval.month,
        price=PriceSpec(
            amount_type=ProductPriceAmountType.fixed,
            price_amount_cents=4900,
        ),
        trial=TrialSpec(interval=TrialInterval.day, count=14),
    ),
    ProductSpec(
        tier="studio",
        name="Spaire Studio",
        description=(
            "For small teams. $129/month + 3.8% + $0.35 per transaction. "
            "Everything in Pro plus white-label course player, customer "
            "wallet, 15 team seats, and higher quotas (200 video hours, "
            "1M monthly email sends, 100GB storage). 14-day free trial."
        ),
        recurring_interval=SubscriptionRecurringInterval.month,
        price=PriceSpec(
            amount_type=ProductPriceAmountType.fixed,
            price_amount_cents=12900,
        ),
        trial=TrialSpec(interval=TrialInterval.day, count=14),
    ),
    ProductSpec(
        tier="scale",
        name="Spaire Scale",
        description=(
            "For established businesses. $299/month + 3.5% + $0.30 per "
            "transaction, with custom pricing available above $50,000/month "
            "GMV. Unlimited courses, video, storage and team seats. Email "
            "sends capped at 2M/month for deliverability protection. "
            "Audit logs, dedicated support. 14-day free trial."
        ),
        recurring_interval=SubscriptionRecurringInterval.month,
        price=PriceSpec(
            amount_type=ProductPriceAmountType.fixed,
            price_amount_cents=29900,
        ),
        trial=TrialSpec(interval=TrialInterval.day, count=14),
    ),
]


# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------


async def _upsert_meter(
    session: AsyncSession,
    platform_org: Organization,
    spec: MeterSpec,
    *,
    dry_run: bool,
) -> tuple[Meter, str]:
    """Returns (meter, action) where action is 'created' | 'updated' | 'unchanged'."""
    result = await session.execute(
        select(Meter)
        .where(Meter.organization_id == platform_org.id)
        .where(Meter.name == spec.name)
        .where(Meter.deleted_at.is_(None))
    )
    existing = result.scalar_one_or_none()
    target_filter = spec.build_filter()
    target_agg = spec.build_aggregation()

    if existing is None:
        meter = Meter(
            organization_id=platform_org.id,
            name=spec.name,
            filter=target_filter,
            aggregation=target_agg,
        )
        if not dry_run:
            session.add(meter)
            await session.flush()
        return meter, "created"

    changed = False
    if existing.filter.model_dump() != target_filter.model_dump():
        if not dry_run:
            existing.filter = target_filter
        changed = True
    if existing.aggregation.model_dump() != target_agg.model_dump():
        if not dry_run:
            existing.aggregation = target_agg
        changed = True
    return existing, "updated" if changed else "unchanged"


async def _find_product_by_tier(
    session: AsyncSession, platform_org_id: UUID, tier: str
) -> Product | None:
    result = await session.execute(
        select(Product)
        .where(Product.organization_id == platform_org_id)
        .where(Product.user_metadata["tier"].astext == tier)
        .where(Product.deleted_at.is_(None))
    )
    products = result.scalars().all()
    if len(products) > 1:
        raise RuntimeError(
            f"More than one product on platform org with metadata.tier='{tier}': "
            f"{[str(p.id) for p in products]}. Resolve manually before re-seeding."
        )
    return products[0] if products else None


async def _upsert_product(
    session: AsyncSession,
    platform_org: Organization,
    spec: ProductSpec,
    *,
    dry_run: bool,
) -> tuple[Product, str]:
    existing = await _find_product_by_tier(session, platform_org.id, spec.tier)

    target_trial_interval = spec.trial.interval if spec.trial else None
    target_trial_count = spec.trial.count if spec.trial else None

    if existing is None:
        product = Product(
            organization_id=platform_org.id,
            name=spec.name,
            description=spec.description,
            recurring_interval=spec.recurring_interval,
            trial_interval=target_trial_interval,
            trial_interval_count=target_trial_count,
            user_metadata={"tier": spec.tier, "managed_by": "scripts.seed_platform_products"},
        )
        if not dry_run:
            session.add(product)
            await session.flush()
        return product, "created"

    changed = False
    if existing.name != spec.name:
        if not dry_run:
            existing.name = spec.name
        changed = True
    if existing.description != spec.description:
        if not dry_run:
            existing.description = spec.description
        changed = True
    if existing.recurring_interval != spec.recurring_interval:
        if not dry_run:
            existing.recurring_interval = spec.recurring_interval
        changed = True
    if existing.trial_interval != target_trial_interval:
        if not dry_run:
            existing.trial_interval = target_trial_interval
        changed = True
    if existing.trial_interval_count != target_trial_count:
        if not dry_run:
            existing.trial_interval_count = target_trial_count
        changed = True
    return existing, "updated" if changed else "unchanged"


async def _upsert_catalog_price(
    session: AsyncSession,
    product: Product,
    spec: PriceSpec,
    *,
    dry_run: bool,
) -> str:
    """Upsert the catalog price for a product to match `spec`.

    If a catalog price already exists with a different amount_type or amount,
    it is archived and a new price is created. Treating prices as immutable
    once created is consistent with the rest of the platform (e.g. Stripe).
    """
    if product.id is None:
        # New product, freshly flushed — no existing prices.
        existing_catalog: list[ProductPrice] = []
    else:
        result = await session.execute(
            select(ProductPrice)
            .where(ProductPrice.product_id == product.id)
            .where(ProductPrice.source == "catalog")
            .where(ProductPrice.is_archived.is_(False))
            .where(ProductPrice.deleted_at.is_(None))
        )
        existing_catalog = list(result.scalars().all())

    def _matches(price: ProductPrice) -> bool:
        if price.amount_type != spec.amount_type:
            return False
        if price.price_currency != spec.price_currency:
            return False
        if spec.amount_type == ProductPriceAmountType.fixed:
            return (
                isinstance(price, ProductPriceFixed)
                and price.price_amount == spec.price_amount_cents
            )
        if spec.amount_type == ProductPriceAmountType.free:
            return isinstance(price, ProductPriceFree)
        return False

    matching = [p for p in existing_catalog if _matches(p)]
    stale = [p for p in existing_catalog if not _matches(p)]

    if matching and not stale:
        return "unchanged"

    if not dry_run:
        for price in stale:
            price.is_archived = True

    if matching:
        # The desired price already exists; archived the stale ones above.
        return "updated"

    # Need to create the target price.
    new_price: ProductPrice
    if spec.amount_type == ProductPriceAmountType.fixed:
        assert spec.price_amount_cents is not None
        new_price = ProductPriceFixed(
            product_id=product.id,
            price_currency=spec.price_currency,
            price_amount=spec.price_amount_cents,
        )
    elif spec.amount_type == ProductPriceAmountType.free:
        new_price = ProductPriceFree(
            product_id=product.id,
            price_currency=spec.price_currency,
        )
    else:
        raise RuntimeError(f"Unsupported price amount_type for seeding: {spec.amount_type}")

    if not dry_run:
        session.add(new_price)
        await session.flush()

    return "created" if not stale else "replaced"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _format_action(action: str) -> str:
    return {
        "created": "✓ created  ",
        "updated": "✓ updated  ",
        "replaced": "✓ replaced ",
        "unchanged": "· unchanged",
    }.get(action, action)


def _format_billing_type(spec: ProductSpec) -> str:
    interval = spec.recurring_interval.value
    if spec.price.amount_type == ProductPriceAmountType.free:
        return f"$0/{interval}"
    assert spec.price.price_amount_cents is not None
    dollars = spec.price.price_amount_cents / 100
    base = f"${dollars:g}/{interval}"
    if spec.trial:
        base += f" ({spec.trial.count}-{spec.trial.interval.value} trial)"
    return base


@cli.command(
    help=(
        "Seed Pro/Studio/Scale subscription products and overage meters in "
        "the platform organization."
    )
)
@typer_async
async def run(
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Show what would change without writing."
    ),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        try:
            platform_org = await platform_service.get(session)
        except PlatformError as e:
            typer.echo(f"❌ {e.message}", err=True)
            raise typer.Exit(code=1) from e

        typer.echo(
            f"Platform organization: {platform_org.name} "
            f"(slug={platform_org.slug}, id={platform_org.id})\n"
        )

        typer.echo("Meters:")
        for meter_spec in METER_SPECS:
            _, action = await _upsert_meter(
                session, platform_org, meter_spec, dry_run=dry_run
            )
            typer.echo(f"  {_format_action(action)}  {meter_spec.name}")

        typer.echo("\nProducts:")
        for product_spec in PRODUCT_SPECS:
            product, action = await _upsert_product(
                session, platform_org, product_spec, dry_run=dry_run
            )
            typer.echo(
                f"  {_format_action(action)}  {product_spec.name:<14} "
                f"tier={product_spec.tier:<5} {_format_billing_type(product_spec)}"
            )

            price_action = await _upsert_catalog_price(
                session, product, product_spec.price, dry_run=dry_run
            )
            typer.echo(
                f"     └─ price {_format_action(price_action)}  "
                f"{product_spec.price.amount_type.value}"
            )

        if dry_run:
            typer.echo("\n(dry-run — no changes committed)")
        else:
            await session.commit()
            typer.echo("\n✓ Seeded.")


if __name__ == "__main__":
    cli()
