"""The org-slug swap moves a globally-unique slug between two orgs safely.

Covers the happy path (slug + invoice prefix move, the held org is renamed)
and the guards that must abort BEFORE any write: the release org not
actually holding the slug, and the chosen release slug already being taken.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from polar.models import Organization
from scripts.swap_org_slug import SwapError, _default_release_slug, perform_swap
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization


async def _org(
    save_fixture: SaveFixture, *, slug: str, prefix: str | None = None
) -> Organization:
    # create_organization hardcodes slug/invoice prefix, so set them after.
    org = await create_organization(save_fixture)
    org.slug = slug
    org.customer_invoice_prefix = prefix or slug.upper()
    await save_fixture(org)
    return org


@pytest.mark.asyncio
class TestSwapOrgSlug:
    async def test_moves_slug_and_invoice_prefix(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        claim = await _org(
            save_fixture, slug="robin-kaye-x", prefix="ROBIN-KAYE-X"
        )
        release = await _org(save_fixture, slug="spaire", prefix="SPAIRE")
        release_slug = _default_release_slug("spaire", release)

        await perform_swap(
            session,
            release_org=release,
            claim_org=claim,
            slug="spaire",
            release_slug=release_slug,
        )

        # The platform (claim) org now owns "spaire", invoice prefix follows.
        assert claim.slug == "spaire"
        assert claim.customer_invoice_prefix == "SPAIRE"
        # The test (release) org was renamed off "spaire".
        assert release.slug == release_slug
        assert release.customer_invoice_prefix == release_slug.upper()

    async def test_aborts_if_release_org_does_not_hold_slug(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        claim = await _org(save_fixture, slug="robin-kaye-y")
        release = await _org(save_fixture, slug="not-spaire")

        with pytest.raises(SwapError):
            await perform_swap(
                session,
                release_org=release,
                claim_org=claim,
                slug="spaire",
                release_slug="spaire-test-x",
            )
        # Nothing changed.
        assert claim.slug == "robin-kaye-y"
        assert release.slug == "not-spaire"

    async def test_aborts_if_release_slug_is_taken(
        self, session: AsyncSession, save_fixture: SaveFixture
    ) -> None:
        claim = await _org(save_fixture, slug="robin-kaye-z")
        release = await _org(save_fixture, slug="spaire")
        release_slug = _default_release_slug("spaire", release)
        # A third org already holds the slug we'd rename the release org to.
        await _org(save_fixture, slug=release_slug)

        with pytest.raises(SwapError):
            await perform_swap(
                session,
                release_org=release,
                claim_org=claim,
                slug="spaire",
                release_slug=release_slug,
            )
        assert claim.slug == "robin-kaye-z"
        assert release.slug == "spaire"

