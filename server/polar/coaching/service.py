from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from polar.auth.models import (
    AuthSubject,
    Organization,
    User,
    is_organization,
    is_user,
)
from polar.exceptions import PolarError
from polar.models.coaching_program import CoachingProgram

from .repository import CoachingProgramRepository
from .schemas import (
    CoachingProgramCreate,
    CoachingProgramUpdate,
    CoachingWizardSubmit,
)


class CoachingProgramError(PolarError):
    ...


class CoachingProductNotFound(CoachingProgramError):
    def __init__(self, product_id: UUID) -> None:
        self.product_id = product_id
        super().__init__(
            f"Product {product_id} not found", status_code=404
        )


class CoachingProgramForbidden(CoachingProgramError):
    def __init__(self) -> None:
        super().__init__("Forbidden", status_code=403)


class CoachingProgramService:
    async def get_by_id(
        self, session: AsyncSession, program_id: UUID
    ) -> CoachingProgram | None:
        repo = CoachingProgramRepository.from_session(session)
        return await repo.get_by_id(program_id)

    async def get_by_product(
        self, session: AsyncSession, product_id: UUID
    ) -> CoachingProgram | None:
        repo = CoachingProgramRepository.from_session(session)
        return await repo.get_by_product(product_id)

    async def list_by_organization(
        self, session: AsyncSession, organization_id: UUID
    ) -> Sequence[CoachingProgram]:
        repo = CoachingProgramRepository.from_session(session)
        statement = repo.get_by_organization_statement(organization_id)
        return await repo.get_all(statement)

    async def create(
        self,
        session: AsyncSession,
        create_schema: CoachingProgramCreate,
    ) -> CoachingProgram:
        repo = CoachingProgramRepository.from_session(session)
        program = CoachingProgram(**create_schema.model_dump())
        return await repo.create(program, flush=True)

    async def update(
        self,
        session: AsyncSession,
        program: CoachingProgram,
        update_schema: CoachingProgramUpdate,
    ) -> CoachingProgram:
        repo = CoachingProgramRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True)
        return await repo.update(program, update_dict=update_dict)

    async def submit_wizard(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        submit_schema: CoachingWizardSubmit,
    ) -> CoachingProgram:
        repo = CoachingProgramRepository.from_session(session)

        # Look up the product and verify ownership.
        product = await repo.get_product_by_id(submit_schema.product_id)
        if product is None:
            raise CoachingProductNotFound(submit_schema.product_id)

        organization_id = product.organization_id

        if is_organization(auth_subject):
            if auth_subject.subject.id != organization_id:
                raise CoachingProgramForbidden()
        elif is_user(auth_subject):
            if not await repo.user_in_organization(
                auth_subject.subject.id, organization_id
            ):
                raise CoachingProgramForbidden()

        existing = await repo.get_by_product(submit_schema.product_id)

        # Fields shared between create and update from the wizard payload.
        # NOTE: `modules` are intentionally NOT persisted here; this is the
        # wizard scaffolding only. TODO: persist modules/lessons later.
        payload = submit_schema.model_dump(exclude={"product_id", "modules"})

        if existing is None:
            program = CoachingProgram(
                product_id=submit_schema.product_id,
                organization_id=organization_id,
                **payload,
            )
            return await repo.create(program, flush=True)

        return await repo.update(existing, update_dict=payload)


coaching_program_service = CoachingProgramService()
