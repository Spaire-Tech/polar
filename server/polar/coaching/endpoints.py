import logging
from uuid import UUID

from fastapi import Depends, HTTPException

from polar.auth.models import is_organization, is_user
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .repository import CoachingProgramRepository
from .schemas import (
    CoachingProgramCreate,
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


# TODO: file upload endpoints are pending. Mirror the course module's
# uploads when ready:
#   - POST /coaching/{program_id}/thumbnail
#   - POST /coaching/{program_id}/trailer
#   - POST /coaching/{program_id}/coach-photo
#   - POST /coaching/{program_id}/landing-media


def _program_read(program) -> CoachingProgramRead:
    return CoachingProgramRead.model_validate(program, from_attributes=True)


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


@router.post("/wizard", response_model=CoachingProgramRead)
async def submit_coaching_wizard(
    submit: CoachingWizardSubmit,
    auth_subject: auth.CoachingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CoachingProgramRead:
    """Accept a wizard payload and upsert the coaching program for the product.

    This is what the frontend wizard's `Preview.openInEditor` calls AFTER
    creating the underlying product.
    """
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
