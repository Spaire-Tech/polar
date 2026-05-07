from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import UserOrganization
from polar.models.coaching_program import CoachingProgram
from polar.models.product import Product


class CoachingProgramRepository(
    RepositorySoftDeletionIDMixin[CoachingProgram, UUID],
    RepositorySoftDeletionMixin[CoachingProgram],
    RepositoryBase[CoachingProgram],
):
    model = CoachingProgram

    def get_by_product_statement(self, product_id: UUID):
        return self.get_base_statement().where(
            CoachingProgram.product_id == product_id
        )

    def get_by_organization_statement(self, organization_id: UUID):
        return self.get_base_statement().where(
            CoachingProgram.organization_id == organization_id
        )

    def get_by_slug_statement(self, slug: str):
        return self.get_base_statement().where(CoachingProgram.slug == slug)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CoachingProgram]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                CoachingProgram.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                CoachingProgram.organization_id == auth_subject.subject.id
            )
        return statement

    async def get_readable_by_id(
        self,
        program_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> CoachingProgram | None:
        statement = self.get_readable_statement(auth_subject).where(
            CoachingProgram.id == program_id
        )
        return await self.get_one_or_none(statement)

    async def get_by_product(
        self, product_id: UUID
    ) -> CoachingProgram | None:
        return await self.get_one_or_none(self.get_by_product_statement(product_id))

    async def get_by_slug(self, slug: str) -> CoachingProgram | None:
        return await self.get_one_or_none(self.get_by_slug_statement(slug))

    async def get_product_by_id(self, product_id: UUID) -> Product | None:
        return await self.session.get(Product, product_id)

    async def user_in_organization(
        self, user_id: UUID, organization_id: UUID
    ) -> bool:
        statement = select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == organization_id,
            UserOrganization.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.first() is not None
