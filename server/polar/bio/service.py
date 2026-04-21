from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import UserOrganization
from polar.models.bio_block import BioBlock
from polar.models.organization import Organization as OrganizationModel
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import BioBlockRepository
from .schemas import (
    BioBlockCreate,
    BioBlockReorder,
    BioBlockUpdate,
    BioSettingsUpdate,
)


class BioService:
    async def list_blocks(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: UUID,
    ) -> Sequence[BioBlock]:
        await self._assert_access(session, auth_subject, organization_id)
        repository = BioBlockRepository.from_session(session)
        return await repository.list_for_organization(organization_id)

    async def get_by_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        block_id: UUID,
    ) -> BioBlock | None:
        repository = BioBlockRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            BioBlock.id == block_id
        )
        return await repository.get_one_or_none(statement)

    async def create_block(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: BioBlockCreate,
    ) -> BioBlock:
        await self._assert_access(
            session, auth_subject, create_schema.organization_id
        )
        repository = BioBlockRepository.from_session(session)
        order = create_schema.order
        if order is None or order < 0:
            order = await repository.get_next_order(create_schema.organization_id)

        block = BioBlock(
            organization_id=create_schema.organization_id,
            type=create_schema.type,
            order=order,
            enabled=create_schema.enabled,
            settings=create_schema.settings,
        )
        return await repository.create(block, flush=True)

    async def update_block(
        self,
        session: AsyncSession,
        block: BioBlock,
        update_schema: BioBlockUpdate,
    ) -> BioBlock:
        repository = BioBlockRepository.from_session(session)
        changes = update_schema.model_dump(exclude_unset=True)
        for key, value in changes.items():
            setattr(block, key, value)
        if "settings" in changes:
            flag_modified(block, "settings")
        return await repository.update(block)

    async def delete_block(
        self,
        session: AsyncSession,
        block: BioBlock,
    ) -> None:
        block.deleted_at = utc_now()
        repository = BioBlockRepository.from_session(session)
        await repository.update(block)

    async def reorder(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        payload: BioBlockReorder,
    ) -> Sequence[BioBlock]:
        await self._assert_access(session, auth_subject, payload.organization_id)
        repository = BioBlockRepository.from_session(session)
        existing = await repository.list_for_organization(payload.organization_id)
        existing_by_id = {block.id: block for block in existing}

        for incoming_id in payload.ids:
            if incoming_id not in existing_by_id:
                raise NotPermitted(
                    f"Block {incoming_id} does not belong to this organization."
                )

        for index, block_id in enumerate(payload.ids):
            block = existing_by_id[block_id]
            if block.order != index:
                block.order = index
                await repository.update(block)

        return await repository.list_for_organization(payload.organization_id)

    async def update_bio_settings(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: UUID,
        update_schema: BioSettingsUpdate,
    ) -> OrganizationModel:
        await self._assert_access(session, auth_subject, organization_id)
        org = await session.get(OrganizationModel, organization_id)
        if org is None:
            raise ResourceNotFound()
        changes = update_schema.model_dump(exclude_unset=True)
        current = dict(org.bio_settings)
        current.update(changes)
        org.bio_settings = current  # type: ignore[assignment]
        flag_modified(org, "bio_settings")
        session.add(org)
        await session.flush()
        return org

    async def get_public_page(
        self,
        session: AsyncReadSession,
        slug: str,
    ) -> tuple[OrganizationModel, Sequence[BioBlock]] | None:
        statement = select(OrganizationModel).where(
            OrganizationModel.slug == slug,
            OrganizationModel.deleted_at.is_(None),
            OrganizationModel.blocked_at.is_(None),
        )
        result = await session.execute(statement)
        org = result.scalar_one_or_none()
        if org is None or not org.bio_enabled:
            return None
        repository = BioBlockRepository.from_session(session)
        blocks = await repository.list_enabled_for_organization(org.id)
        return org, blocks

    async def _assert_access(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: UUID,
    ) -> None:
        if is_user(auth_subject):
            user = auth_subject.subject
            statement = select(UserOrganization).where(
                UserOrganization.user_id == user.id,
                UserOrganization.organization_id == organization_id,
                UserOrganization.deleted_at.is_(None),
            )
            result = await session.execute(statement)
            if result.scalar_one_or_none() is None:
                raise NotPermitted()
        else:
            if auth_subject.subject.id != organization_id:
                raise NotPermitted()


bio = BioService()
