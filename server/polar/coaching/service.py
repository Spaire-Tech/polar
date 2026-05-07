import re
from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException
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
from polar.models.course import Course
from polar.models.course_lesson import CourseLesson
from polar.models.course_module import CourseModule

from .repository import CoachingProgramRepository
from .schemas import (
    AIFinalizePayload,
    CoachingDraftCreate,
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


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Lowercase, replace non-alphanumeric runs with `-`, trim leading/trailing dashes."""
    if not value:
        return ""
    return _SLUG_RE.sub("-", value.lower()).strip("-")


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

    async def _unique_slug(
        self,
        session: AsyncSession,
        organization_id: UUID,
        title: str | None,
        ignore_id: UUID | None = None,
    ) -> str | None:
        if not title:
            return None
        base = slugify(title) or "program"
        repo = CoachingProgramRepository.from_session(session)
        candidate = base
        suffix = 2
        while True:
            existing = await repo.get_by_slug(organization_id, candidate)
            if existing is None or existing.id == ignore_id:
                return candidate
            candidate = f"{base}-{suffix}"
            suffix += 1

    async def create(
        self,
        session: AsyncSession,
        create_schema: CoachingProgramCreate,
    ) -> CoachingProgram:
        repo = CoachingProgramRepository.from_session(session)
        data = create_schema.model_dump()
        if not data.get("slug") and data.get("title"):
            data["slug"] = await self._unique_slug(
                session, create_schema.organization_id, data["title"]
            )
        program = CoachingProgram(**data)
        return await repo.create(program, flush=True)

    async def create_draft(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        payload: CoachingDraftCreate,
    ) -> CoachingProgram:
        repo = CoachingProgramRepository.from_session(session)

        # Auth check on the org
        if is_organization(auth_subject):
            if auth_subject.subject.id != payload.organization_id:
                raise CoachingProgramForbidden()
        elif is_user(auth_subject):
            if not await repo.user_in_organization(
                auth_subject.subject.id, payload.organization_id
            ):
                raise CoachingProgramForbidden()

        product = await repo.get_product_by_id(payload.product_id)
        if product is None:
            raise CoachingProductNotFound(payload.product_id)
        if product.organization_id != payload.organization_id:
            raise CoachingProgramForbidden()

        existing = await repo.get_by_product(payload.product_id)
        if existing is not None:
            return existing

        slug = await self._unique_slug(
            session, payload.organization_id, payload.title
        )
        program = CoachingProgram(
            product_id=payload.product_id,
            organization_id=payload.organization_id,
            title=payload.title,
            slug=slug,
            format="self",
            free_preview=False,
            ai_generated=False,
        )
        return await repo.create(program, flush=True)

    async def update(
        self,
        session: AsyncSession,
        program: CoachingProgram,
        update_schema: CoachingProgramUpdate,
    ) -> CoachingProgram:
        repo = CoachingProgramRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True)

        # If title changed and slug isn't being explicitly overridden,
        # regenerate the slug from the new title.
        if "title" in update_dict and "slug" not in update_dict:
            new_title = update_dict["title"]
            if new_title and new_title != program.title:
                update_dict["slug"] = await self._unique_slug(
                    session,
                    program.organization_id,
                    new_title,
                    ignore_id=program.id,
                )

        return await repo.update(program, update_dict=update_dict)

    async def set_coach_photo_url(
        self,
        session: AsyncSession,
        program: CoachingProgram,
        url: str,
    ) -> CoachingProgram:
        repo = CoachingProgramRepository.from_session(session)
        return await repo.update(program, update_dict={"coach_photo_url": url})

    async def set_thumbnail_url(
        self,
        session: AsyncSession,
        program: CoachingProgram,
        url: str,
    ) -> CoachingProgram:
        repo = CoachingProgramRepository.from_session(session)
        return await repo.update(program, update_dict={"thumbnail_url": url})

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

    async def finalize_ai(
        self,
        session: AsyncSession,
        program: CoachingProgram,
        payload: AIFinalizePayload,
    ) -> CoachingProgram:
        """Persist AI-generated landing data and (on first call) create the
        backing hidden Course with modules + lessons."""
        repo = CoachingProgramRepository.from_session(session)

        update_dict: dict = {
            "ai_generated": True,
        }
        if payload.landing_data is not None:
            update_dict["landing_data"] = payload.landing_data
        if payload.intake_questions is not None:
            update_dict["intake_questions"] = payload.intake_questions
        if payload.session_ideas is not None:
            update_dict["session_ideas"] = payload.session_ideas

        # If no backing course yet, auto-create one with modules+lessons.
        # TODO: re-finalize support — currently treated as a no-op for the
        # course/module/lesson tree to avoid destructive overwrites.
        if program.course_id is None and payload.modules:
            course = Course(
                product_id=program.product_id,
                organization_id=program.organization_id,
                title=program.title,
                course_type="evergreen",
                ai_generated=True,
            )
            for mod_index, mod in enumerate(payload.modules):
                module = CourseModule(
                    title=mod.title,
                    position=mod_index,
                )
                for lesson_index, lesson in enumerate(mod.lessons):
                    content_type = "video" if lesson.type == "video" else "text"
                    module.lessons.append(
                        CourseLesson(
                            title=lesson.title,
                            content_type=content_type,
                            position=lesson_index,
                        )
                    )
                course.modules.append(module)

            session.add(course)
            await session.flush()
            update_dict["course_id"] = course.id

        program = await repo.update(program, update_dict=update_dict)
        return program

    async def publish(
        self,
        session: AsyncSession,
        program: CoachingProgram,
    ) -> CoachingProgram:
        missing: list[str] = []
        if not program.title:
            missing.append("title")
        if not program.promise:
            missing.append("promise")
        if not program.coach_name:
            missing.append("coach_name")
        if not program.thumbnail_url:
            missing.append("thumbnail_url")
        if not program.landing_data:
            missing.append("landing_data")
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot publish: missing required fields: {', '.join(missing)}",
            )

        repo = CoachingProgramRepository.from_session(session)
        return await repo.update(
            program, update_dict={"published_at": datetime.now(tz=UTC)}
        )

    async def unpublish(
        self,
        session: AsyncSession,
        program: CoachingProgram,
    ) -> CoachingProgram:
        repo = CoachingProgramRepository.from_session(session)
        return await repo.update(program, update_dict={"published_at": None})

    async def soft_delete(
        self,
        session: AsyncSession,
        program: CoachingProgram,
    ) -> None:
        repo = CoachingProgramRepository.from_session(session)
        await repo.soft_delete(program)


coaching_program_service = CoachingProgramService()
