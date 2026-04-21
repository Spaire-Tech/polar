from uuid import UUID

from fastapi import Depends, Query
from pydantic import UUID4

from polar.exceptions import ResourceNotFound
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.storefront.service import storefront as storefront_service

from . import auth
from .repository import OrganizationLinkRepository
from .schemas import (
    OrganizationLink as OrganizationLinkSchema,
)
from .schemas import (
    OrganizationLinkCreate,
    OrganizationLinkPublic,
    OrganizationLinkReorder,
    OrganizationLinkUpdate,
)
from .service import organization_link as organization_link_service

router = APIRouter(
    prefix="/organization-links",
    tags=["organization-links", APITag.private],
)

LinkNotFound = {
    "description": "Organization link not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Organization Links",
    response_model=list[OrganizationLinkSchema],
)
async def list_links(
    auth_subject: auth.OrganizationLinksRead,
    organization_id: UUID = Query(description="Organization whose links to return."),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[OrganizationLinkSchema]:
    links = await organization_link_service.list_by_organization(
        session, auth_subject, organization_id=organization_id
    )
    return [
        OrganizationLinkSchema.model_validate(link, from_attributes=True)
        for link in links
    ]


@router.post(
    "/",
    summary="Create Organization Link",
    response_model=OrganizationLinkSchema,
    status_code=201,
)
async def create_link(
    auth_subject: auth.OrganizationLinksWrite,
    create_schema: OrganizationLinkCreate,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationLinkSchema:
    link = await organization_link_service.create(session, auth_subject, create_schema)
    return OrganizationLinkSchema.model_validate(link, from_attributes=True)


@router.post(
    "/reorder",
    summary="Reorder Organization Links",
    response_model=list[OrganizationLinkSchema],
)
async def reorder_links(
    auth_subject: auth.OrganizationLinksWrite,
    payload: OrganizationLinkReorder,
    session: AsyncSession = Depends(get_db_session),
) -> list[OrganizationLinkSchema]:
    links = await organization_link_service.reorder(session, auth_subject, payload)
    return [
        OrganizationLinkSchema.model_validate(link, from_attributes=True)
        for link in links
    ]


@router.get(
    "/public/{slug}",
    summary="Get Public Organization Links",
    response_model=list[OrganizationLinkPublic],
    responses={404: LinkNotFound},
)
async def public_list_links(
    slug: str,
    session: AsyncSession = Depends(get_db_session),
) -> list[OrganizationLinkPublic]:
    """Return enabled organization links for a public storefront."""
    organization = await storefront_service.get(session, slug)
    if organization is None:
        raise ResourceNotFound()

    repository = OrganizationLinkRepository.from_session(session)
    links = await repository.list_public_for_organization(organization.id)
    return [
        OrganizationLinkPublic(
            id=link.id,
            label=link.label,
            url=link.url,
            icon=link.icon,
            description=link.description,
            button_label=link.button_label,
        )
        for link in links
    ]


@router.get(
    "/{link_id}",
    summary="Get Organization Link",
    response_model=OrganizationLinkSchema,
    responses={404: LinkNotFound},
)
async def get_link(
    auth_subject: auth.OrganizationLinksRead,
    link_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationLinkSchema:
    link = await organization_link_service.get_by_id(session, auth_subject, link_id)
    if link is None:
        raise ResourceNotFound()
    return OrganizationLinkSchema.model_validate(link, from_attributes=True)


@router.patch(
    "/{link_id}",
    summary="Update Organization Link",
    response_model=OrganizationLinkSchema,
    responses={404: LinkNotFound},
)
async def update_link(
    auth_subject: auth.OrganizationLinksWrite,
    link_id: UUID4,
    update_schema: OrganizationLinkUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationLinkSchema:
    link = await organization_link_service.get_by_id(session, auth_subject, link_id)
    if link is None:
        raise ResourceNotFound()
    updated = await organization_link_service.update(session, link, update_schema)
    return OrganizationLinkSchema.model_validate(updated, from_attributes=True)


@router.delete(
    "/{link_id}",
    summary="Delete Organization Link",
    status_code=204,
    responses={404: LinkNotFound},
)
async def delete_link(
    auth_subject: auth.OrganizationLinksWrite,
    link_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    link = await organization_link_service.get_by_id(session, auth_subject, link_id)
    if link is None:
        raise ResourceNotFound()
    await organization_link_service.delete(session, link)
