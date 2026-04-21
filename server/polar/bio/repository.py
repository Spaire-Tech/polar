from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import UserOrganization
from polar.models.bio_block import BioBlock


class BioBlockRepository(
    RepositorySoftDeletionIDMixin[BioBlock, UUID],
    RepositorySoftDeletionMixin[BioBlock],
    RepositoryBase[BioBlock],
):
    model = BioBlock

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[BioBlock]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                BioBlock.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                BioBlock.organization_id == auth_subject.subject.id
            )
        return statement

    async def list_for_organization(
        self, organization_id: UUID
    ) -> Sequence[BioBlock]:
        statement = (
            self.get_base_statement()
            .where(BioBlock.organization_id == organization_id)
            .order_by(BioBlock.order.asc(), BioBlock.created_at.asc())
        )
        return await self.get_all(statement)

    async def list_enabled_for_organization(
        self, organization_id: UUID
    ) -> Sequence[BioBlock]:
        statement = (
            self.get_base_statement()
            .where(
                BioBlock.organization_id == organization_id,
                BioBlock.enabled.is_(True),
            )
            .order_by(BioBlock.order.asc(), BioBlock.created_at.asc())
        )
        return await self.get_all(statement)

    async def get_next_order(self, organization_id: UUID) -> int:
        statement = select(func.max(BioBlock.order)).where(
            BioBlock.organization_id == organization_id,
            BioBlock.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        current_max = result.scalar()
        return 0 if current_max is None else current_max + 1
