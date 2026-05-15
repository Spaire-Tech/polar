import pytest
from pytest_mock import MockerFixture
from sqlalchemy import func, select

from polar.kit.db.postgres import AsyncSession
from polar.models import Meter, Organization, Product, ProductPrice
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceFixed,
    ProductPriceFree,
)
from scripts.seed_platform_products import (
    METER_SPECS,
    PRODUCT_SPECS,
    _upsert_catalog_price,
    _upsert_meter,
    _upsert_product,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization


@pytest.mark.asyncio
class TestSeedPlatformProducts:
    async def test_creates_all_meters_and_products(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        mocker.patch(
            "polar.platform.service.settings.PLATFORM_ORG_ID", platform_org.id
        )

        for meter_spec in METER_SPECS:
            _, action = await _upsert_meter(
                session, platform_org, meter_spec, dry_run=False
            )
            assert action == "created"

        for product_spec in PRODUCT_SPECS:
            product, action = await _upsert_product(
                session, platform_org, product_spec, dry_run=False
            )
            assert action == "created"
            price_action = await _upsert_catalog_price(
                session, product, product_spec.price, dry_run=False
            )
            assert price_action == "created"

        await session.flush()

        meter_count = (
            await session.execute(
                select(func.count(Meter.id)).where(
                    Meter.organization_id == platform_org.id
                )
            )
        ).scalar_one()
        assert meter_count == len(METER_SPECS)

        product_count = (
            await session.execute(
                select(func.count(Product.id)).where(
                    Product.organization_id == platform_org.id
                )
            )
        ).scalar_one()
        assert product_count == len(PRODUCT_SPECS)

    async def test_is_idempotent(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        mocker.patch(
            "polar.platform.service.settings.PLATFORM_ORG_ID", platform_org.id
        )

        # First pass.
        for meter_spec in METER_SPECS:
            await _upsert_meter(session, platform_org, meter_spec, dry_run=False)
        for product_spec in PRODUCT_SPECS:
            product, _ = await _upsert_product(
                session, platform_org, product_spec, dry_run=False
            )
            await _upsert_catalog_price(
                session, product, product_spec.price, dry_run=False
            )
        await session.flush()

        # Second pass — everything should already exist.
        for meter_spec in METER_SPECS:
            _, action = await _upsert_meter(
                session, platform_org, meter_spec, dry_run=False
            )
            assert action == "unchanged"
        for product_spec in PRODUCT_SPECS:
            product, action = await _upsert_product(
                session, platform_org, product_spec, dry_run=False
            )
            assert action == "unchanged"
            price_action = await _upsert_catalog_price(
                session, product, product_spec.price, dry_run=False
            )
            assert price_action == "unchanged"

        # And the row counts should not have grown.
        meter_count = (
            await session.execute(
                select(func.count(Meter.id)).where(
                    Meter.organization_id == platform_org.id
                )
            )
        ).scalar_one()
        assert meter_count == len(METER_SPECS)

        product_count = (
            await session.execute(
                select(func.count(Product.id)).where(
                    Product.organization_id == platform_org.id
                )
            )
        ).scalar_one()
        assert product_count == len(PRODUCT_SPECS)

    async def test_products_have_expected_shape(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        mocker.patch(
            "polar.platform.service.settings.PLATFORM_ORG_ID", platform_org.id
        )

        for product_spec in PRODUCT_SPECS:
            product, _ = await _upsert_product(
                session, platform_org, product_spec, dry_run=False
            )
            await _upsert_catalog_price(
                session, product, product_spec.price, dry_run=False
            )
        await session.flush()

        async def _find(tier: str, billing_interval: str) -> Product:
            return (
                await session.execute(
                    select(Product)
                    .where(Product.organization_id == platform_org.id)
                    .where(Product.user_metadata["tier"].astext == tier)
                    .where(
                        Product.user_metadata["billing_interval"].astext
                        == billing_interval
                    )
                )
            ).scalar_one()

        async def _price_for(product: Product) -> ProductPrice:
            return (
                await session.execute(
                    select(ProductPrice)
                    .where(ProductPrice.product_id == product.id)
                    .where(ProductPrice.is_archived.is_(False))
                )
            ).scalar_one()

        # Legacy — $0, no trial, grandfather-only.
        legacy = await _find("legacy", "month")
        assert legacy.name == "Spaire Legacy"
        assert legacy.trial_interval is None
        legacy_price = await _price_for(legacy)
        assert isinstance(legacy_price, ProductPriceFree)
        assert legacy_price.amount_type == ProductPriceAmountType.free

        # Pro — monthly $49 + annual $470.40 (20% off 12 × $49 = $588).
        pro_monthly = await _find("pro", "month")
        assert pro_monthly.name == "Spaire Pro"
        assert pro_monthly.trial_interval_count == 14
        pro_monthly_price = await _price_for(pro_monthly)
        assert isinstance(pro_monthly_price, ProductPriceFixed)
        assert pro_monthly_price.price_amount == 4900

        pro_annual = await _find("pro", "year")
        assert pro_annual.name == "Spaire Pro (Annual)"
        assert pro_annual.trial_interval_count == 14
        pro_annual_price = await _price_for(pro_annual)
        assert isinstance(pro_annual_price, ProductPriceFixed)
        assert pro_annual_price.price_amount == 4900 * 12 * 80 // 100  # 47,040

        # Studio — monthly $129 + annual $1,238.40.
        studio_monthly = await _find("studio", "month")
        assert studio_monthly.name == "Spaire Studio"
        assert studio_monthly.trial_interval_count == 14
        studio_monthly_price = await _price_for(studio_monthly)
        assert isinstance(studio_monthly_price, ProductPriceFixed)
        assert studio_monthly_price.price_amount == 12900

        studio_annual = await _find("studio", "year")
        assert studio_annual.name == "Spaire Studio (Annual)"
        studio_annual_price = await _price_for(studio_annual)
        assert isinstance(studio_annual_price, ProductPriceFixed)
        assert studio_annual_price.price_amount == 12900 * 12 * 80 // 100

        # Scale — monthly $299 + annual $2,870.40.
        scale_monthly = await _find("scale", "month")
        assert scale_monthly.name == "Spaire Scale"
        assert scale_monthly.trial_interval_count == 14
        scale_monthly_price = await _price_for(scale_monthly)
        assert isinstance(scale_monthly_price, ProductPriceFixed)
        assert scale_monthly_price.price_amount == 29900

        scale_annual = await _find("scale", "year")
        assert scale_annual.name == "Spaire Scale (Annual)"
        scale_annual_price = await _price_for(scale_annual)
        assert isinstance(scale_annual_price, ProductPriceFixed)
        assert scale_annual_price.price_amount == 29900 * 12 * 80 // 100

    async def test_archives_stale_price_when_amount_changes(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        platform_org = await create_organization(save_fixture)
        mocker.patch(
            "polar.platform.service.settings.PLATFORM_ORG_ID", platform_org.id
        )
        pro_spec = next(s for s in PRODUCT_SPECS if s.tier == "pro")

        product, _ = await _upsert_product(
            session, platform_org, pro_spec, dry_run=False
        )
        await _upsert_catalog_price(
            session, product, pro_spec.price, dry_run=False
        )
        await session.flush()

        # Simulate a price change: same product, different amount.
        from dataclasses import replace

        new_price_spec = replace(pro_spec.price, price_amount_cents=5900)
        action = await _upsert_catalog_price(
            session, product, new_price_spec, dry_run=False
        )
        assert action == "replaced"
        await session.flush()

        prices = (
            await session.execute(
                select(ProductPrice).where(ProductPrice.product_id == product.id)
            )
        ).scalars().all()
        active = [p for p in prices if not p.is_archived]
        archived = [p for p in prices if p.is_archived]
        assert len(active) == 1
        assert len(archived) == 1
        assert isinstance(active[0], ProductPriceFixed)
        assert active[0].price_amount == 5900
        assert isinstance(archived[0], ProductPriceFixed)
        assert archived[0].price_amount == 4900
