from sqlalchemy import select
from sqlalchemy.orm import selectinload

from polar.kit.services import ResourceServiceReader
from polar.models import Organization, Product, ProductVisibility
from polar.models.course import Course
from polar.postgres import AsyncSession


class CustomerOrganizationService(ResourceServiceReader[Organization]):
    async def resolve_sign_in_image_url(
        self, session: AsyncSession, organization: Organization
    ) -> str | None:
        """Image for the customer portal sign-in screen.

        Uses the creator's explicitly uploaded image when set; otherwise falls
        back to the organization's most recent course thumbnail (the portal is
        org-scoped, so there's no single course context at sign-in time)."""
        if organization.customer_portal_sign_in_image_url:
            return organization.customer_portal_sign_in_image_url

        statement = (
            select(Course.thumbnail_url)
            .where(
                Course.organization_id == organization.id,
                Course.thumbnail_url.is_not(None),
                Course.deleted_at.is_(None),
            )
            .order_by(Course.created_at.desc())
            .limit(1)
        )
        return await session.scalar(statement)

    async def get_by_slug(
        self, session: AsyncSession, slug: str
    ) -> Organization | None:
        statement = (
            select(Organization)
            .where(
                Organization.deleted_at.is_(None),
                Organization.blocked_at.is_(None),
                Organization.slug == slug,
            )
            .options(
                selectinload(
                    Organization.products.and_(
                        Product.deleted_at.is_(None),
                        Product.is_archived.is_(False),
                        Product.visibility == ProductVisibility.public,
                    )
                ).options(
                    selectinload(Product.product_medias),
                )
            )
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()


customer_organization = CustomerOrganizationService(Organization)
