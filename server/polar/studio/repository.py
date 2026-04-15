from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import selectinload

from polar.auth.models import AuthSubject, User
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import StudioConversation, UserOrganization

from .sorting import StudioConversationSortProperty


class StudioConversationRepository(
    RepositorySortingMixin[StudioConversation, StudioConversationSortProperty],
    RepositorySoftDeletionIDMixin[StudioConversation, UUID],
    RepositorySoftDeletionMixin[StudioConversation],
    RepositoryBase[StudioConversation],
):
    model = StudioConversation
    sorting_enum = StudioConversationSortProperty

    def get_eager_options(self) -> Options:
        return (selectinload(StudioConversation.messages),)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[tuple[StudioConversation]]:
        """
        Conversations are personal drafts. Only the author can see them, and
        only within an organization they currently belong to.
        """
        user = auth_subject.subject
        return (
            self.get_base_statement()
            .where(StudioConversation.user_id == user.id)
            .where(
                StudioConversation.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        )

    async def is_user_in_organization(
        self, user_id: UUID, organization_id: UUID
    ) -> bool:
        """Check whether the user is an active member of the organization."""
        statement = select(UserOrganization.organization_id).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == organization_id,
            UserOrganization.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.first() is not None

    def get_sorting_clause(
        self, property: StudioConversationSortProperty
    ) -> SortingClause:
        match property:
            case StudioConversationSortProperty.created_at:
                return StudioConversation.created_at
            case StudioConversationSortProperty.modified_at:
                return StudioConversation.modified_at
            case StudioConversationSortProperty.conversation_title:
                return StudioConversation.title
