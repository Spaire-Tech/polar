import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends, File, HTTPException, UploadFile

from polar.auth.dependencies import Authenticator
from polar.auth.models import (
    Anonymous,
    AuthSubject,
    Organization,
    User,
    is_organization,
    is_user,
)
from polar.auth.scope import Scope
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .repository import CoachingProgramRepository
from .schemas import (
    AIFinalizePayload,
    CoachingDraftCreate,
    CoachingProgramCreate,
    CoachingProgramPublicRead,
    CoachingProgramRead,
    CoachingProgramUpdate,
    CoachingWizardSubmit,
)
from .service import (
    CoachingProductNotFound,
    CoachingProgramForbidden,
    coaching_program_service,
)

log = logging.getLogger(__name__)

router = APIRouter(
    prefix="/coaching",
    tags=["coaching", APITag.private],
)


# Public (anonymous-allowed) authenticator for the public landing endpoint.
_CoachingPublic = Authenticator(
    required_scopes={Scope.web_read},
    allowed_subjects={User, Organization, Anonymous},
)
CoachingPublic = Annotated[
    AuthSubject[User | Organization | Anonymous], Depends(_CoachingPublic)
]


_IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif"}
_VIDEO_EXTS = {"mp4", "mov", "webm", "m4v"}


def _program_read(program) -> CoachingProgramRead:
    return CoachingProgramRead.model_validate(program, from_attributes=True)


def _program_public_read(program, organization_slug: str) -> CoachingProgramPublicRead:
    return CoachingProgramPublicRead(
        id=program.id,
        product_id=program.product_id,
        organization_id=program.organization_id,
        organization_slug=organization_slug,
        slug=program.slug,
        title=program.title,
        promise=program.promise,
        coach_name=program.coach_name,
        coach_bio=program.coach_bio,
        coach_credentials=program.coach_credentials,
        coach_photo_url=program.coach_photo_url,
        thumbnail_url=program.thumbnail_url,
        trailer_url=program.trailer_url,
        format=program.format,
        cohort_start=program.cohort_start,
        cohort_end=program.cohort_end,
        weeks=program.weeks,
        free_preview=program.free_preview,
        landing_data=program.landing_data,
        published_at=program.published_at,
    )


@router.get(
    "/organization/{organization_id}", response_model=list[CoachingProgramRead]
)
async def list_coaching_programs_by_organization(
    organization_id: UUID,
    auth_subject: auth.CoachingRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[CoachingProgramRead]:
    repo = CoachingProgramRepository.from_session(session)
    if is_organization(auth_subject):
        if auth_subject.subject.id != organization_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif is_user(auth_subject):
        if not await repo.user_in_organization(
            auth_subject.subject.id, organization_id
        ):
            raise HTTPException(status_code=403, detail="Forbidden")
    programs = await coaching_program_service.list_by_organization(
        session, organization_id
    )
    return [_program_read(p) for p in programs]


@router.get("/product/{product_id}", response_model=CoachingProgramRead)
async def get_coaching_program_by_product(
    product_id: UUID,
    auth_subject: auth.CoachingRead,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    program = await coaching_program_service.get_by_product(session, product_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")
    repo = CoachingProgramRepository.from_session(session)
    if await repo.get_readable_by_id(program.id, auth_subject) is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")
    return _program_read(program)


@router.get(
    "/public/{org_slug}/{slug}",
    response_model=CoachingProgramPublicRead,
)
async def get_public_coaching_program(
    org_slug: str,
    slug: str,
    auth_subject: CoachingPublic,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramPublicRead:
    org_repo = OrganizationRepository.from_session(session)
    organization = await org_repo.get_by_slug(org_slug)
    if organization is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")

    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_published_by_slug(organization.id, slug)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")
    return _program_public_read(program, organization.slug)


@router.get("/{program_id}", response_model=CoachingProgramRead)
async def get_coaching_program(
    program_id: UUID,
    auth_subject: auth.CoachingRead,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_readable_by_id(program_id, auth_subject)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")
    return _program_read(program)


@router.post("/", response_model=CoachingProgramRead, status_code=201)
async def create_coaching_program(
    program_create: CoachingProgramCreate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    repo = CoachingProgramRepository.from_session(session)
    if is_organization(auth_subject):
        if auth_subject.subject.id != program_create.organization_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    elif is_user(auth_subject):
        if not await repo.user_in_organization(
            auth_subject.subject.id, program_create.organization_id
        ):
            raise HTTPException(status_code=403, detail="Forbidden")
    program = await coaching_program_service.create(session, program_create)
    return _program_read(program)


@router.post("/draft", response_model=CoachingProgramRead, status_code=201)
async def create_coaching_draft(
    payload: CoachingDraftCreate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    """Create an empty/draft coaching program. The wizard calls this right
    after the underlying product is created."""
    try:
        program = await coaching_program_service.create_draft(
            session, auth_subject, payload
        )
    except CoachingProductNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    except CoachingProgramForbidden as exc:
        raise HTTPException(status_code=403, detail=exc.message) from exc
    return _program_read(program)


@router.post("/wizard", response_model=CoachingProgramRead)
async def submit_coaching_wizard(
    submit: CoachingWizardSubmit,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    """Accept a wizard payload and upsert the coaching program for the product."""
    try:
        program = await coaching_program_service.submit_wizard(
            session, auth_subject, submit
        )
    except CoachingProductNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    except CoachingProgramForbidden as exc:
        raise HTTPException(status_code=403, detail=exc.message) from exc
    return _program_read(program)


@router.patch("/{program_id}", response_model=CoachingProgramRead)
async def update_coaching_program(
    program_id: UUID,
    program_update: CoachingProgramUpdate,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_readable_by_id(program_id, auth_subject)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")
    program = await coaching_program_service.update(session, program, program_update)
    return _program_read(program)


@router.post(
    "/{program_id}/coach-photo",
    response_model=CoachingProgramRead,
    summary="Upload Coach Photo",
)
async def upload_coach_photo(
    program_id: UUID,
    auth_subject: auth.CoachingWrite,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service

    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_readable_by_id(program_id, auth_subject)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")

    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 10 MB")

    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    if ext not in _IMAGE_EXTS:
        ext = "jpg"

    path = f"coaching/coach-photos/{program_id}.{ext}"
    s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
    s3.upload(data, path, content_type)
    url = s3.get_public_url(path)

    program = await coaching_program_service.set_coach_photo_url(
        session, program, url
    )
    return _program_read(program)


@router.post(
    "/{program_id}/thumbnail",
    response_model=CoachingProgramRead,
    summary="Upload Coaching Program Thumbnail",
)
async def upload_thumbnail(
    program_id: UUID,
    auth_subject: auth.CoachingWrite,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service

    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_readable_by_id(program_id, auth_subject)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")

    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 10 MB")

    ext = (file.filename or "thumbnail.jpg").rsplit(".", 1)[-1].lower()
    if ext not in _IMAGE_EXTS:
        ext = "jpg"

    path = f"coaching/thumbnails/{program_id}.{ext}"
    s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
    s3.upload(data, path, content_type)
    url = s3.get_public_url(path)

    program = await coaching_program_service.set_thumbnail_url(
        session, program, url
    )
    return _program_read(program)


@router.post(
    "/{program_id}/landing-media",
    summary="Upload Landing Media (returns URL only)",
)
async def upload_landing_media(
    program_id: UUID,
    auth_subject: auth.CoachingWrite,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    from uuid import uuid4

    from polar.config import settings
    from polar.integrations.aws.s3 import S3Service

    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_readable_by_id(program_id, auth_subject)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")

    content_type = file.content_type or "application/octet-stream"
    is_image = content_type.startswith("image/")
    is_video = content_type.startswith("video/")
    if not (is_image or is_video):
        raise HTTPException(
            status_code=400, detail="File must be an image or video"
        )

    data = await file.read()
    max_bytes = (500 if is_video else 10) * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File must be under {max_bytes // (1024 * 1024)} MB",
        )

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if not ext or "/" in ext:
        ext = "mp4" if is_video else "jpg"

    path = f"coaching/landing-media/{program_id}/{uuid4().hex}.{ext}"
    s3 = S3Service(bucket=settings.S3_FILES_PUBLIC_BUCKET_NAME)
    s3.upload(data, path, content_type)
    url = s3.get_public_url(path)

    return {"url": url, "kind": "video" if is_video else "image"}


@router.post(
    "/{program_id}/finalize-ai",
    response_model=CoachingProgramRead,
    summary="Persist AI-generated landing/intake/sessions and create backing course",
)
async def finalize_ai(
    program_id: UUID,
    payload: AIFinalizePayload,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_readable_by_id(program_id, auth_subject)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")
    program = await coaching_program_service.finalize_ai(session, program, payload)
    return _program_read(program)


@router.post(
    "/{program_id}/publish",
    response_model=CoachingProgramRead,
    summary="Publish Coaching Program",
)
async def publish_coaching_program(
    program_id: UUID,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_readable_by_id(program_id, auth_subject)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")
    program = await coaching_program_service.publish(session, program)
    return _program_read(program)


@router.post(
    "/{program_id}/unpublish",
    response_model=CoachingProgramRead,
    summary="Unpublish Coaching Program",
)
async def unpublish_coaching_program(
    program_id: UUID,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_readable_by_id(program_id, auth_subject)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")
    program = await coaching_program_service.unpublish(session, program)
    return _program_read(program)


@router.delete("/{program_id}", status_code=204)
async def delete_coaching_program(
    program_id: UUID,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    repo = CoachingProgramRepository.from_session(session)
    program = await repo.get_readable_by_id(program_id, auth_subject)
    if program is None:
        raise HTTPException(status_code=404, detail="Coaching program not found")
    await coaching_program_service.soft_delete(session, program)
