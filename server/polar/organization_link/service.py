from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.exceptions import NotPermitted
from polar.kit.utils import utc_now
from polar.models.organization_link import OrganizationLink
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import OrganizationLinkRepository
from .schemas import (
    OrganizationLinkCreate,
    OrganizationLinkReorder,
    OrganizationLinkUpdate,
)


class OrganizationLinkService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: UUID,
    ) -> list[OrganizationLink]:
        repository = OrganizationLinkRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(OrganizationLink.organization_id == organization_id)
            .order_by(OrganizationLink.order.asc(), OrganizationLink.created_at.asc())
        )
        return list(await repository.get_all(statement))

    async def get_by_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        link_id: UUID,
    ) -> OrganizationLink | None:
        repository = OrganizationLinkRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            OrganizationLink.id == link_id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: OrganizationLinkCreate,
    ) -> OrganizationLink:
        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )
        repository = OrganizationLinkRepository.from_session(session)

        order = create_schema.order
        if order is None:
            order = await repository.get_next_order(organization.id)

        link = OrganizationLink(
            organization_id=organization.id,
            label=create_schema.label,
            url=create_schema.url,
            icon=create_schema.icon,
            order=order,
            enabled=create_schema.enabled,
        )
        return await repository.create(link, flush=True)

    async def update(
        self,
        session: AsyncSession,
        link: OrganizationLink,
        update_schema: OrganizationLinkUpdate,
    ) -> OrganizationLink:
        repository = OrganizationLinkRepository.from_session(session)
        changes = update_schema.model_dump(exclude_unset=True)
        for key, value in changes.items():
            setattr(link, key, value)
        return await repository.update(link)

    async def delete(
        self,
        session: AsyncSession,
        link: OrganizationLink,
    ) -> None:
        link.deleted_at = utc_now()
        repository = OrganizationLinkRepository.from_session(session)
        await repository.update(link)

    async def reorder(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        payload: OrganizationLinkReorder,
    ) -> list[OrganizationLink]:
        organization = await get_payload_organization(session, auth_subject, payload)
        repository = OrganizationLinkRepository.from_session(session)
        existing = await repository.list_for_organization(organization.id)
        existing_by_id = {link.id: link for link in existing}

        for incoming_id in payload.ids:
            if incoming_id not in existing_by_id:
                raise NotPermitted(
                    f"Link {incoming_id} does not belong to this organization."
                )

        for index, link_id in enumerate(payload.ids):
            link = existing_by_id[link_id]
            if link.order != index:
                link.order = index
                await repository.update(link)

        return await repository.list_for_organization(organization.id)


organization_link = OrganizationLinkService()
