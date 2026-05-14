from uuid import UUID

from polar.config import settings
from polar.exceptions import PolarError
from polar.models import Organization
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession


class PlatformError(PolarError): ...


class PlatformOrganizationNotConfigured(PlatformError):
    def __init__(self) -> None:
        super().__init__(
            "SPAIRE_PLATFORM_ORG_ID is not set. "
            "Run `python -m scripts.platform verify` for setup instructions.",
            500,
        )


class PlatformOrganizationNotFound(PlatformError):
    def __init__(self, organization_id: UUID) -> None:
        super().__init__(
            f"SPAIRE_PLATFORM_ORG_ID={organization_id} does not match any "
            "organization.",
            500,
        )


class PlatformService:
    """The Organization that represents Spaire itself.

    Spaire sells Free/Pro/Scale subscriptions to every other creator org
    using its own product/subscription/checkout machinery. The platform
    organization is the seller; every creator org is a Customer of it.
    """

    def get_id(self) -> UUID:
        if settings.PLATFORM_ORG_ID is None:
            raise PlatformOrganizationNotConfigured()
        return settings.PLATFORM_ORG_ID

    def is_configured(self) -> bool:
        return settings.PLATFORM_ORG_ID is not None

    def is_platform_organization(self, organization_id: UUID) -> bool:
        """Whether the given org IS the platform org itself.

        Returns False when no platform org is configured, so callers that
        gate behavior on "is this the platform org?" stay correct in
        single-tenant/development setups.
        """
        if settings.PLATFORM_ORG_ID is None:
            return False
        return organization_id == settings.PLATFORM_ORG_ID

    async def get(self, session: AsyncReadSession) -> Organization:
        organization_id = self.get_id()
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(
            organization_id, include_blocked=True
        )
        if organization is None:
            raise PlatformOrganizationNotFound(organization_id)
        return organization


platform = PlatformService()
