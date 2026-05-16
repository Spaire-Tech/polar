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

from polar.enums import SubscriptionRecurringInterval, TaxBehaviorOption
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
    # tax_behavior=inclusive on Pro/Studio/Scale means the headline price
    # ($49 / $129 / $299) is what the creator pays — Spaire absorbs the
    # sales tax internally rather than tacking it on top. Legacy stays
    # None (no tax to compute on a $0 product).
    tax_behavior: TaxBehaviorOption | None = None


@dataclass(frozen=True)
class ProductSpec:
    tier: str  # "pro" | "studio" | "scale" | "legacy" — stamped onto user_metadata["tier"]
    # "month" | "year" — stamped onto user_metadata["billing_interval"] so a
    # creator can pick monthly vs annual at checkout. Legacy is "month" by
    # convention (it's an internal grandfather product, the interval doesn't
    # really matter).
    billing_interval: str
    name: str
    description: str
    recurring_interval: SubscriptionRecurringInterval
    price: PriceSpec
    trial: TrialSpec | None = None


_PRO_DESCRIPTION = (
    "For solo creators starting out. 4% + $0.40 per transaction. "
    "3 published courses, 1,000 email subscribers, 10,000 monthly email "
    "sends, 1 active email sequence, 10 hours of hosted video, sandbox "
    "environment. 14-day free trial."
)
_STUDIO_DESCRIPTION = (
    "For small teams scaling up. 3.8% + $0.35 per transaction. "
    "Everything in Pro plus 15 published courses, 10,000 subscribers, "
    "100k monthly sends, 10 active sequences, custom email sender domain, "
    "A/B testing, white-label course player, customer wallet, 5 team "
    "seats. 14-day free trial."
)
_SCALE_DESCRIPTION = (
    "For established businesses. 3.5% + $0.30 per transaction, with "
    "custom pricing available above $50,000/month GMV. 100 published "
    "courses, 50,000 subscribers, 500k monthly sends, unlimited "
    "sequences, 250 GB storage, 20 team seats. Audit logs and dedicated "
    "support with a 4-hour SLA. 14-day free trial."
)

# 20% annual discount = pay for ~10 months, get 12. Stripe-standard.
_ANNUAL_PRO_CENTS = 4900 * 12 * 80 // 100  # 47,040
_ANNUAL_STUDIO_CENTS = 12900 * 12 * 80 // 100  # 123,840
_ANNUAL_SCALE_CENTS = 29900 * 12 * 80 // 100  # 287,040


PRODUCT_SPECS: list[ProductSpec] = [
    ProductSpec(
        tier="legacy",
        billing_interval="month",
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
    # Pro — monthly + annual
    ProductSpec(
        tier="pro",
        billing_interval="month",
        name="Spaire Pro",
        description=_PRO_DESCRIPTION,
        recurring_interval=SubscriptionRecurringInterval.month,
        price=PriceSpec(
            amount_type=ProductPriceAmountType.fixed,
            tax_behavior=TaxBehaviorOption.inclusive,
            price_amount_cents=4900,
        ),
        trial=TrialSpec(interval=TrialInterval.day, count=14),
    ),
    ProductSpec(
        tier="pro",
        billing_interval="year",
        name="Spaire Pro (Annual)",
        description=_PRO_DESCRIPTION + " Save 20% with annual billing.",
        recurring_interval=SubscriptionRecurringInterval.year,
        price=PriceSpec(
            amount_type=ProductPriceAmountType.fixed,
            tax_behavior=TaxBehaviorOption.inclusive,
            price_amount_cents=_ANNUAL_PRO_CENTS,
        ),
        trial=TrialSpec(interval=TrialInterval.day, count=14),
    ),
    # Studio — monthly + annual
    ProductSpec(
        tier="studio",
        billing_interval="month",
        name="Spaire Studio",
        description=_STUDIO_DESCRIPTION,
        recurring_interval=SubscriptionRecurringInterval.month,
        price=PriceSpec(
            amount_type=ProductPriceAmountType.fixed,
            tax_behavior=TaxBehaviorOption.inclusive,
            price_amount_cents=12900,
        ),
        trial=TrialSpec(interval=TrialInterval.day, count=14),
    ),
    ProductSpec(
        tier="studio",
        billing_interval="year",
        name="Spaire Studio (Annual)",
        description=_STUDIO_DESCRIPTION + " Save 20% with annual billing.",
        recurring_interval=SubscriptionRecurringInterval.year,
        price=PriceSpec(
            amount_type=ProductPriceAmountType.fixed,
            tax_behavior=TaxBehaviorOption.inclusive,
            price_amount_cents=_ANNUAL_STUDIO_CENTS,
        ),
        trial=TrialSpec(interval=TrialInterval.day, count=14),
    ),
    # Scale — monthly + annual
    ProductSpec(
        tier="scale",
        billing_interval="month",
        name="Spaire Scale",
        description=_SCALE_DESCRIPTION,
        recurring_interval=SubscriptionRecurringInterval.month,
        price=PriceSpec(
            amount_type=ProductPriceAmountType.fixed,
            tax_behavior=TaxBehaviorOption.inclusive,
            price_amount_cents=29900,
        ),
        trial=TrialSpec(interval=TrialInterval.day, count=14),
    ),
    ProductSpec(
        tier="scale",
        billing_interval="year",
        name="Spaire Scale (Annual)",
        description=_SCALE_DESCRIPTION + " Save 20% with annual billing.",
        recurring_interval=SubscriptionRecurringInterval.year,
        price=PriceSpec(
            amount_type=ProductPriceAmountType.fixed,
            tax_behavior=TaxBehaviorOption.inclusive,
            price_amount_cents=_ANNUAL_SCALE_CENTS,
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


async def _find_product_by_tier_and_interval(
    session: AsyncSession,
    platform_org_id: UUID,
    tier: str,
    billing_interval: str,
) -> Product | None:
    """Locate a previously-seeded Product by (tier, billing_interval).

    Tier products created before annual billing existed lack the
    `billing_interval` user_metadata key — we treat any monthly-recurring
    product with the matching tier as the canonical "month" row so a
    re-seed migrates it in place rather than duplicating it.
    """
    result = await session.execute(
        select(Product)
        .where(Product.organization_id == platform_org_id)
        .where(Product.user_metadata["tier"].astext == tier)
        .where(Product.deleted_at.is_(None))
    )
    products = list(result.scalars().all())
    matches: list[Product] = []
    for product in products:
        stored_interval = (product.user_metadata or {}).get("billing_interval")
        if stored_interval is None:
            # Legacy seed row — adopt it as the monthly row, mark below
            # in _upsert_product when we stamp the new metadata.
            if (
                billing_interval == "month"
                and product.recurring_interval == SubscriptionRecurringInterval.month
            ):
                matches.append(product)
        elif stored_interval == billing_interval:
            matches.append(product)

    if len(matches) > 1:
        raise RuntimeError(
            f"More than one product on platform org with "
            f"metadata.tier='{tier}', billing_interval='{billing_interval}': "
            f"{[str(p.id) for p in matches]}. Resolve manually before re-seeding."
        )
    return matches[0] if matches else None


async def _upsert_product(
    session: AsyncSession,
    platform_org: Organization,
    spec: ProductSpec,
    *,
    dry_run: bool,
) -> tuple[Product, str]:
    existing = await _find_product_by_tier_and_interval(
        session, platform_org.id, spec.tier, spec.billing_interval
    )

    target_trial_interval = spec.trial.interval if spec.trial else None
    target_trial_count = spec.trial.count if spec.trial else None
    target_metadata = {
        "tier": spec.tier,
        "billing_interval": spec.billing_interval,
        "managed_by": "scripts.seed_platform_products",
    }

    if existing is None:
        product = Product(
            organization_id=platform_org.id,
            name=spec.name,
            description=spec.description,
            recurring_interval=spec.recurring_interval,
            # Polar's checkout asserts product.recurring_interval_count
            # is not None when creating a subscription. We always bill
            # every interval (every month or every year), so 1 is the
            # right value for every tier; setting it explicitly avoids
            # a bare AssertionError deep inside the checkout flow.
            recurring_interval_count=1,
            trial_interval=target_trial_interval,
            trial_interval_count=target_trial_count,
            user_metadata=target_metadata,
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
    if existing.recurring_interval_count != 1:
        # Backfill the field on previously-seeded rows so the next
        # checkout doesn't trip Polar's assertion.
        if not dry_run:
            existing.recurring_interval_count = 1
        changed = True
    if existing.trial_interval != target_trial_interval:
        if not dry_run:
            existing.trial_interval = target_trial_interval
        changed = True
    if existing.trial_interval_count != target_trial_count:
        if not dry_run:
            existing.trial_interval_count = target_trial_count
        changed = True
    if (existing.user_metadata or {}).get("billing_interval") != spec.billing_interval:
        # Stamp the interval onto pre-existing rows (the previous seed
        # didn't store this key).
        if not dry_run:
            merged = dict(existing.user_metadata or {})
            merged.update(target_metadata)
            existing.user_metadata = merged
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
            if not isinstance(price, ProductPriceFixed):
                return False
            if price.price_amount != spec.price_amount_cents:
                return False
            return True
        if spec.amount_type == ProductPriceAmountType.free:
            return isinstance(price, ProductPriceFree)
        return False

    matching = [p for p in existing_catalog if _matches(p)]
    stale = [p for p in existing_catalog if not _matches(p)]

    # tax_behavior is mutable in place — Stripe accepts price updates that
    # only flip inclusive/exclusive without archiving the price. So we
    # reconcile it on the matching row separately rather than treating it
    # as a "different price."
    tax_behavior_changed = False
    for price in matching:
        if price.tax_behavior != spec.tax_behavior:
            if not dry_run:
                price.tax_behavior = spec.tax_behavior
            tax_behavior_changed = True

    if matching and not stale and not tax_behavior_changed:
        return "unchanged"

    if not dry_run:
        for price in stale:
            price.is_archived = True

    if matching:
        # The desired price already exists; archived the stale ones above
        # and possibly flipped tax_behavior in place.
        return "updated"

    # Need to create the target price.
    new_price: ProductPrice
    if spec.amount_type == ProductPriceAmountType.fixed:
        assert spec.price_amount_cents is not None
        new_price = ProductPriceFixed(
            product_id=product.id,
            price_currency=spec.price_currency,
            price_amount=spec.price_amount_cents,
            tax_behavior=spec.tax_behavior,
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
                f"  {_format_action(action)}  {product_spec.name:<22} "
                f"tier={product_spec.tier:<6} "
                f"interval={product_spec.billing_interval:<5} "
                f"{_format_billing_type(product_spec)}"
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
