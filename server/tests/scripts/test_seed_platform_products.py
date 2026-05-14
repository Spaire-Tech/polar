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

        # Free
        free = (
            await session.execute(
                select(Product)
                .where(Product.organization_id == platform_org.id)
                .where(Product.user_metadata["tier"].astext == "free")
            )
        ).scalar_one()
        assert free.name == "Spaire Free"
        assert free.trial_interval is None
        free_price = (
            await session.execute(
                select(ProductPrice)
                .where(ProductPrice.product_id == free.id)
                .where(ProductPrice.is_archived.is_(False))
            )
        ).scalar_one()
        assert isinstance(free_price, ProductPriceFree)
        assert free_price.amount_type == ProductPriceAmountType.free

        # Pro — $49/mo, 14-day trial
        pro = (
            await session.execute(
                select(Product)
                .where(Product.organization_id == platform_org.id)
                .where(Product.user_metadata["tier"].astext == "pro")
            )
        ).scalar_one()
        assert pro.name == "Spaire Pro"
        assert pro.trial_interval is not None
        assert pro.trial_interval_count == 14
        pro_price = (
            await session.execute(
                select(ProductPrice)
                .where(ProductPrice.product_id == pro.id)
                .where(ProductPrice.is_archived.is_(False))
            )
        ).scalar_one()
        assert isinstance(pro_price, ProductPriceFixed)
        assert pro_price.price_amount == 4900
        assert pro_price.price_currency == "usd"

        # Scale — $299/mo, no trial
        scale = (
            await session.execute(
                select(Product)
                .where(Product.organization_id == platform_org.id)
                .where(Product.user_metadata["tier"].astext == "scale")
            )
        ).scalar_one()
        assert scale.name == "Spaire Scale"
        assert scale.trial_interval is None
        scale_price = (
            await session.execute(
                select(ProductPrice)
                .where(ProductPrice.product_id == scale.id)
                .where(ProductPrice.is_archived.is_(False))
            )
        ).scalar_one()
        assert isinstance(scale_price, ProductPriceFixed)
        assert scale_price.price_amount == 29900

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
