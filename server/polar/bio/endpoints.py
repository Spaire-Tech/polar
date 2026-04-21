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

from . import auth
from .schemas import (
    BioBlock as BioBlockSchema,
)
from .schemas import (
    BioBlockCreate,
    BioBlockReorder,
    BioBlockUpdate,
    BioPublicOrganization,
    BioPublicPage,
    BioSettingsUpdate,
)
from .service import bio as bio_service

router = APIRouter(prefix="/bio", tags=["bio", APITag.private])

BlockNotFound = {
    "description": "Bio block not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/blocks",
    summary="List Bio Blocks",
    response_model=list[BioBlockSchema],
)
async def list_blocks(
    auth_subject: auth.BioRead,
    organization_id: UUID = Query(description="Organization whose blocks to return."),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> list[BioBlockSchema]:
    blocks = await bio_service.list_blocks(
        session, auth_subject, organization_id=organization_id
    )
    return [
        BioBlockSchema.model_validate(block, from_attributes=True) for block in blocks
    ]


@router.post(
    "/blocks",
    summary="Create Bio Block",
    response_model=BioBlockSchema,
    status_code=201,
)
async def create_block(
    auth_subject: auth.BioWrite,
    create_schema: BioBlockCreate,
    session: AsyncSession = Depends(get_db_session),
) -> BioBlockSchema:
    block = await bio_service.create_block(session, auth_subject, create_schema)
    return BioBlockSchema.model_validate(block, from_attributes=True)


@router.post(
    "/blocks/reorder",
    summary="Reorder Bio Blocks",
    response_model=list[BioBlockSchema],
)
async def reorder_blocks(
    auth_subject: auth.BioWrite,
    payload: BioBlockReorder,
    session: AsyncSession = Depends(get_db_session),
) -> list[BioBlockSchema]:
    blocks = await bio_service.reorder(session, auth_subject, payload)
    return [
        BioBlockSchema.model_validate(block, from_attributes=True) for block in blocks
    ]


@router.get(
    "/blocks/{block_id}",
    summary="Get Bio Block",
    response_model=BioBlockSchema,
    responses={404: BlockNotFound},
)
async def get_block(
    auth_subject: auth.BioRead,
    block_id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> BioBlockSchema:
    block = await bio_service.get_by_id(session, auth_subject, block_id)
    if block is None:
        raise ResourceNotFound()
    return BioBlockSchema.model_validate(block, from_attributes=True)


@router.patch(
    "/blocks/{block_id}",
    summary="Update Bio Block",
    response_model=BioBlockSchema,
    responses={404: BlockNotFound},
)
async def update_block(
    auth_subject: auth.BioWrite,
    block_id: UUID4,
    update_schema: BioBlockUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> BioBlockSchema:
    block = await bio_service.get_by_id(session, auth_subject, block_id)
    if block is None:
        raise ResourceNotFound()
    updated = await bio_service.update_block(session, block, update_schema)
    return BioBlockSchema.model_validate(updated, from_attributes=True)


@router.delete(
    "/blocks/{block_id}",
    summary="Delete Bio Block",
    status_code=204,
    responses={404: BlockNotFound},
)
async def delete_block(
    auth_subject: auth.BioWrite,
    block_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    block = await bio_service.get_by_id(session, auth_subject, block_id)
    if block is None:
        raise ResourceNotFound()
    await bio_service.delete_block(session, block)


@router.patch(
    "/settings/{organization_id}",
    summary="Update Bio Settings",
    response_model=dict[str, object],
)
async def update_bio_settings(
    auth_subject: auth.BioWrite,
    organization_id: UUID4,
    update_schema: BioSettingsUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, object]:
    org = await bio_service.update_bio_settings(
        session, auth_subject, organization_id, update_schema
    )
    return {
        "organization_id": str(org.id),
        "bio_settings": org.bio_settings,
        "bio_enabled": org.bio_enabled,
    }


@router.get(
    "/public/{slug}",
    summary="Get Public Bio Page",
    response_model=BioPublicPage,
    responses={404: BlockNotFound},
)
async def get_public_bio(
    slug: str,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> BioPublicPage:
    result = await bio_service.get_public_page(session, slug)
    if result is None:
        raise ResourceNotFound()
    org, blocks = result
    return BioPublicPage(
        organization=BioPublicOrganization(
            id=org.id,
            slug=org.slug,
            name=org.name,
            avatar_url=org.avatar_url,
            socials=[{"platform": s["platform"], "url": s["url"]} for s in org.socials],
            bio_settings=dict(org.bio_settings),
        ),
        blocks=[
            BioBlockSchema.model_validate(block, from_attributes=True)
            for block in blocks
        ],
    )
