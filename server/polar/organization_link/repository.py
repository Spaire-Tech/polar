from uuid import UUID

from sqlalchemy import Select, func, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models import UserOrganization
from polar.models.organization_link import OrganizationLink


class OrganizationLinkRepository(
    RepositorySoftDeletionMixin[OrganizationLink],
    RepositoryBase[OrganizationLink],
):
    model = OrganizationLink

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[OrganizationLink]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                OrganizationLink.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                OrganizationLink.organization_id == auth_subject.subject.id,
            )

        return statement

    async def list_for_organization(
        self, organization_id: UUID
    ) -> list[OrganizationLink]:
        statement = (
            self.get_base_statement()
            .where(
                OrganizationLink.organization_id == organization_id,
                OrganizationLink.deleted_at.is_(None),
            )
            .order_by(OrganizationLink.order.asc(), OrganizationLink.created_at.asc())
        )
        return list(await self.get_all(statement))

    async def list_public_for_organization(
        self, organization_id: UUID
    ) -> list[OrganizationLink]:
        statement = (
            self.get_base_statement()
            .where(
                OrganizationLink.organization_id == organization_id,
                OrganizationLink.deleted_at.is_(None),
                OrganizationLink.enabled.is_(True),
            )
            .order_by(OrganizationLink.order.asc(), OrganizationLink.created_at.asc())
        )
        return list(await self.get_all(statement))

    async def get_next_order(self, organization_id: UUID) -> int:
        statement = select(func.coalesce(func.max(OrganizationLink.order), -1)).where(
            OrganizationLink.organization_id == organization_id,
            OrganizationLink.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        current_max = result.scalar_one()
        return int(current_max) + 1
