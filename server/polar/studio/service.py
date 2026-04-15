import uuid
from collections.abc import Sequence

from polar.auth.models import AuthSubject
from polar.exceptions import SpaireRequestValidationError
from polar.kit.pagination import PaginationParams
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.models import (
    StudioConversation,
    StudioConversationMessage,
    User,
)
from polar.postgres import AsyncSession

from .repository import StudioConversationRepository
from .schemas import (
    StudioConversationSyncRequest,
    StudioConversationUpdate,
)
from .sorting import StudioConversationSortProperty


class StudioConversationService(ResourceServiceReader[StudioConversation]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[StudioConversationSortProperty]] = [
            (StudioConversationSortProperty.modified_at, True)
        ],
    ) -> tuple[Sequence[StudioConversation], int]:
        repository = StudioConversationRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(
                StudioConversation.organization_id.in_(organization_id)
            )

        statement = repository.apply_sorting(statement, sorting)
        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        id: uuid.UUID,
    ) -> StudioConversation | None:
        repository = StudioConversationRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(StudioConversation.id == id)
            .options(*repository.get_eager_options())
        )
        return await repository.get_one_or_none(statement)

    async def sync(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        sync_request: StudioConversationSyncRequest,
    ) -> StudioConversation:
        """
        Upsert the conversation and replace its entire message list. The client is
        the source of truth for message order and content — we store what it sends.
        """
        user = auth_subject.subject
        repository = StudioConversationRepository.from_session(session)

        # Ensure the caller actually belongs to the target organization before
        # letting them associate a conversation with it.
        if not await repository.is_user_in_organization(
            user.id, sync_request.organization_id
        ):
            raise SpaireRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "organization_id"),
                        "msg": "User is not a member of the target organization.",
                        "input": sync_request.organization_id,
                    }
                ]
            )

        conversation: StudioConversation | None = None
        if sync_request.id is not None:
            statement = (
                repository.get_readable_statement(auth_subject)
                .where(StudioConversation.id == sync_request.id)
                .options(*repository.get_eager_options())
            )
            conversation = await repository.get_one_or_none(statement)

        if conversation is None:
            conversation = StudioConversation(
                id=sync_request.id if sync_request.id is not None else uuid.uuid4(),
                organization_id=sync_request.organization_id,
                user_id=user.id,
                title=sync_request.title,
                product_id=sync_request.product_id,
                messages=[],
            )
            session.add(conversation)
        else:
            conversation.title = sync_request.title
            conversation.product_id = sync_request.product_id
            # Replace the message set. cascade="all, delete-orphan" on the
            # relationship removes the old rows when we reassign.
            conversation.messages = []
            await session.flush()

        conversation.messages = [
            StudioConversationMessage(
                role=message.role,
                parts=message.parts,
            )
            for message in sync_request.messages
        ]

        await session.flush()
        return conversation

    async def update(
        self,
        session: AsyncSession,
        conversation: StudioConversation,
        update_schema: StudioConversationUpdate,
    ) -> StudioConversation:
        repository = StudioConversationRepository.from_session(session)
        return await repository.update(
            conversation,
            update_dict=update_schema.model_dump(exclude_unset=True),
        )

    async def delete(
        self,
        session: AsyncSession,
        conversation: StudioConversation,
    ) -> StudioConversation:
        repository = StudioConversationRepository.from_session(session)
        return await repository.soft_delete(conversation)


studio_conversation = StudioConversationService(StudioConversation)
