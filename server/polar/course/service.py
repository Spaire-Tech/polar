from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select

from polar.email_sequence.events import fire_event
from polar.email_subscriber.repository import EmailSubscriberRepository
from polar.entitlements.service import entitlements as entitlements_service
from polar.models.benefit import Benefit, BenefitType
from polar.models.course import Course
from polar.models.course_enrollment import CourseEnrollment
from polar.models.course_lesson import CourseLesson
from polar.models.course_lesson_progress import CourseLessonProgress
from polar.models.course_module import CourseModule
from polar.models.course_note import CourseNote
from polar.models.customer import Customer
from polar.models.lesson_comment import LessonComment
from polar.models.lesson_comment_like import LessonCommentLike
from polar.models.product_benefit import ProductBenefit
from polar.postgres import AsyncSession

from .landing import merge_landing_overrides, validate_landing_overrides
from .repository import (
    CourseEnrollmentRepository,
    CourseLessonProgressRepository,
    CourseLessonRepository,
    CourseModuleRepository,
    CourseNoteRepository,
    CourseRepository,
    LessonCommentLikeRepository,
    LessonCommentRepository,
)
from .schemas import (
    CourseCreate,
    CourseLessonCreate,
    CourseLessonUpdate,
    CourseModuleCreate,
    CourseModuleUpdate,
    CourseUpdate,
)


def _build_lesson(schema: CourseLessonCreate) -> CourseLesson:
    """Build a CourseLesson from a create schema, persisting every declared
    field (description, drip, comments_mode, thumbnails, etc.). Without this,
    fields silently drop on initial create and require a follow-up PATCH."""
    lesson = CourseLesson(
        title=schema.title,
        content_type=schema.content_type,
        content=schema.content,
        video_asset_id=schema.video_asset_id,
        duration_seconds=schema.duration_seconds,
        position=schema.position,
        is_free_preview=schema.is_free_preview,
        published=schema.published,
        description=schema.description,
        release_at=schema.release_at,
        drip_days=schema.drip_days,
        comments_mode=schema.comments_mode,
        thumbnail_url=schema.thumbnail_url,
    )
    # Attach a pre-staged Mux upload. The webhook resolves lessons by
    # mux_upload_id, so once Mux finishes the playback id will land on
    # this row automatically — no follow-up PATCH required.
    if schema.mux_upload_id:
        lesson.mux_upload_id = schema.mux_upload_id
        lesson.mux_status = "waiting"
        lesson.content_type = "video"
    return lesson


class CourseService:
    async def get_by_id(self, session: AsyncSession, course_id: UUID) -> Course | None:
        repo = CourseRepository.from_session(session)
        return await repo.get_by_id(course_id)

    async def get_by_product(
        self, session: AsyncSession, product_id: UUID
    ) -> Course | None:
        repo = CourseRepository.from_session(session)
        statement = repo.get_by_product_statement(product_id)
        return await repo.get_one_or_none(statement)

    async def list_by_organization(
        self, session: AsyncSession, organization_id: UUID
    ) -> Sequence[Course]:
        repo = CourseRepository.from_session(session)
        statement = repo.get_by_organization_statement(organization_id)
        return await repo.get_all(statement)

    async def create(
        self, session: AsyncSession, create_schema: CourseCreate
    ) -> Course:
        repo = CourseRepository.from_session(session)

        course = Course(
            product_id=create_schema.product_id,
            organization_id=create_schema.organization_id,
            title=create_schema.title,
            course_type=create_schema.course_type,
            format=create_schema.format,
            paywall_enabled=create_schema.paywall_enabled,
            paywall_lesson_id=create_schema.paywall_lesson_id,
            paywall_position=create_schema.paywall_position,
            ai_generated=create_schema.ai_generated,
            hero_variant=create_schema.hero_variant,
            lesson_card_variant=create_schema.lesson_card_variant,
            trial_mode=create_schema.trial_mode,
            # AI-synthesised hero copy (under landing_overrides.ai_hero) and any
            # human edits — persisted so the public portal renders it.
            landing_overrides=create_schema.landing_overrides,
            description=create_schema.description,
            thumbnail_url=create_schema.thumbnail_url,
            thumbnail_object_position=create_schema.thumbnail_object_position,
            instructor_name=create_schema.instructor_name,
            instructor_bio=create_schema.instructor_bio,
            trailer_url=create_schema.trailer_url,
            sample=(
                create_schema.sample.model_dump(mode="json")
                if create_schema.sample is not None
                else None
            ),
            instructor_name_italic=create_schema.instructor_name_italic,
            instructor_name_bold=create_schema.instructor_name_bold,
            instructor_name_uppercase=create_schema.instructor_name_uppercase,
        )

        # Use provided modules or create implicit "Lessons" module
        modules_to_add = create_schema.modules
        if not modules_to_add:
            # Create implicit module for flat lesson structure
            modules_to_add = [CourseModuleCreate(
                title='Lessons',
                description=None,
                position=0,
                lessons=[],
            )]

        # Drafts are free; the published_courses cap only applies once a
        # course actually goes live. A course can be created already-public
        # (e.g. AI generation that publishes its lessons), so enforce the
        # cap up front when any seed lesson is published. Counts the org's
        # *other* published courses — this one isn't persisted yet.
        will_be_published = any(
            lesson.published
            for module in modules_to_add
            for lesson in module.lessons
        )
        if will_be_published:
            current = await repo.count_published_by_organization(
                create_schema.organization_id
            )
            await entitlements_service.require_under_limit(
                session,
                create_schema.organization_id,
                "published_courses",
                current=current,
            )

        for mod_schema in modules_to_add:
            module = CourseModule(
                title=mod_schema.title,
                description=mod_schema.description,
                position=mod_schema.position,
                status=mod_schema.status,
                release_at=mod_schema.release_at,
                drip_days=mod_schema.drip_days,
            )
            for lesson_schema in mod_schema.lessons:
                module.lessons.append(_build_lesson(lesson_schema))
            course.modules.append(module)

        course = await repo.create(course, flush=True)
        # Refresh to avoid MissingGreenlet when selectin relationships are accessed
        await session.refresh(course, attribute_names=["modules"])

        # Wire the course up to a course_access benefit on its product, so
        # that the existing Order → enqueue_benefits_grants → grant_benefit
        # → BenefitCourseAccessService.grant pipeline actually enrolls every
        # customer who pays. Without this row the buy-flow silently never
        # creates a CourseEnrollment.
        await self._ensure_course_access_benefit(session, course)

        return course

    async def _ensure_course_access_benefit(
        self,
        session: AsyncSession,
        course: Course,
    ) -> Benefit | None:
        """Create + attach a course_access benefit to course.product if missing.

        Returns the benefit row (existing or freshly created), or None if
        the course has no product to attach to.
        """
        if course.product_id is None:
            return None

        # Already wired? Match on (organization, course_id property) so we
        # don't create duplicates if a benefit was created out-of-band.
        existing_stmt = (
            select(Benefit)
            .where(
                Benefit.type == BenefitType.course_access,
                Benefit.organization_id == course.organization_id,
                Benefit.deleted_at.is_(None),
                Benefit.properties["course_id"].astext == str(course.id),
            )
        )
        result = await session.execute(existing_stmt)
        benefit = result.scalar_one_or_none()

        if benefit is None:
            title = course.title or "this course"
            benefit = Benefit(
                type=BenefitType.course_access,
                description=f"Access to {title}",
                is_tax_applicable=True,
                selectable=False,
                deletable=False,
                organization_id=course.organization_id,
                properties={"course_id": str(course.id)},
            )
            session.add(benefit)
            await session.flush()

        # Attach to the product if not already attached. The
        # product_benefits table is keyed on (product_id, benefit_id) so
        # the existence check is cheap and exact.
        existing_link_stmt = select(ProductBenefit).where(
            ProductBenefit.product_id == course.product_id,
            ProductBenefit.benefit_id == benefit.id,
        )
        link_result = await session.execute(existing_link_stmt)
        if link_result.scalar_one_or_none() is None:
            # Find the next order slot to satisfy UniqueConstraint(product_id, order).
            max_order_stmt = select(ProductBenefit.order).where(
                ProductBenefit.product_id == course.product_id
            )
            existing_orders = (await session.execute(max_order_stmt)).scalars().all()
            next_order = (max(existing_orders) + 1) if existing_orders else 0
            session.add(
                ProductBenefit(
                    product_id=course.product_id,
                    benefit_id=benefit.id,
                    order=next_order,
                )
            )
            await session.flush()

        return benefit

    async def update(
        self,
        session: AsyncSession,
        course: Course,
        update_schema: CourseUpdate,
    ) -> Course:
        repo = CourseRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True, mode="json")

        # Deep-merge landing_overrides onto whatever is already stored rather
        # than replacing the column wholesale. The editor PATCHes the whole
        # blob, so before this a stale or partial client snapshot (e.g. a
        # second tab, or a payload written before a concurrent AI job added
        # ai_hero) would silently wipe sibling keys. Merging makes those edits
        # converge instead of clobbering. An explicit `None` for a key inside
        # the patch deletes that key; sending `landing_overrides: null` clears
        # the whole blob (a deliberate full reset).
        if "landing_overrides" in update_dict:
            patch = update_dict["landing_overrides"]
            if patch is not None:
                update_dict["landing_overrides"] = validate_landing_overrides(
                    merge_landing_overrides(course.landing_overrides, patch)
                )

        # Validate the sample's lesson_id refers to a lesson on this course.
        # Falls back to disabling the sample silently if the lesson is gone
        # (e.g. the user deleted the episode the sample pointed at after
        # the editor staged the change).
        if "sample" in update_dict and update_dict["sample"] is not None:
            sample_dict = update_dict["sample"]
            lesson_id_str = sample_dict.get("lesson_id")
            lesson_ids = {
                str(lesson.id)
                for module in course.modules
                for lesson in module.lessons
            }
            if lesson_id_str not in lesson_ids:
                update_dict["sample"] = None

        return await repo.update(course, update_dict=update_dict)

    async def add_module(
        self,
        session: AsyncSession,
        course: Course,
        create_schema: CourseModuleCreate,
    ) -> CourseModule:
        module_repo = CourseModuleRepository.from_session(session)

        # A new module seeded with published lessons can flip a draft course
        # live — enforce the published_courses cap in that case.
        if any(lesson.published for lesson in create_schema.lessons):
            await self._require_published_course_slot(
                session,
                course_id=course.id,
                organization_id=course.organization_id,
            )

        module = CourseModule(
            course_id=course.id,
            title=create_schema.title,
            description=create_schema.description,
            position=create_schema.position,
            status=create_schema.status,
            release_at=create_schema.release_at,
            drip_days=create_schema.drip_days,
        )

        for lesson_schema in create_schema.lessons:
            module.lessons.append(_build_lesson(lesson_schema))

        module = await module_repo.create(module, flush=True)
        # Refresh lessons so selectin access doesn't trigger MissingGreenlet
        await session.refresh(module, attribute_names=["lessons"])
        return module

    async def update_module(
        self,
        session: AsyncSession,
        module: CourseModule,
        update_schema: CourseModuleUpdate,
    ) -> CourseModule:
        module_repo = CourseModuleRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True)
        return await module_repo.update(module, update_dict=update_dict)

    async def get_module_by_id(
        self, session: AsyncSession, module_id: UUID
    ) -> CourseModule | None:
        module_repo = CourseModuleRepository.from_session(session)
        return await module_repo.get_by_id(module_id)

    async def delete_module(
        self, session: AsyncSession, module: CourseModule
    ) -> None:
        module_repo = CourseModuleRepository.from_session(session)
        await module_repo.soft_delete(module)

    async def reorder_modules(
        self,
        session: AsyncSession,
        course: Course,
        ordered_ids: Sequence[UUID],
    ) -> Sequence[CourseModule]:
        """Reorder modules within a course by setting position to list index."""
        module_repo = CourseModuleRepository.from_session(session)
        existing_ids = {m.id for m in course.modules}
        if set(ordered_ids) != existing_ids:
            raise ValueError("ordered_ids must contain exactly the course's modules")
        by_id = {m.id: m for m in course.modules}
        for index, module_id in enumerate(ordered_ids):
            await module_repo.update(by_id[module_id], update_dict={"position": index})
        return [by_id[mid] for mid in ordered_ids]

    async def add_lesson(
        self,
        session: AsyncSession,
        module: CourseModule,
        create_schema: CourseLessonCreate,
    ) -> CourseLesson:
        lesson_repo = CourseLessonRepository.from_session(session)

        # Resolve the owning org through module.course_id so we can gate
        # against the tier's lessons-per-course limit.
        course_repo = CourseRepository.from_session(session)
        course = await course_repo.get_by_id(module.course_id)
        if course is not None:
            current = await lesson_repo.count_by_course(module.course_id)
            await entitlements_service.require_under_limit(
                session,
                course.organization_id,
                "lessons_per_course",
                current=current,
            )
            # Drip scheduling is Pro+. Block setting drip_days or
            # release_at on lessons for orgs without the feature.
            if (
                create_schema.drip_days is not None
                or create_schema.release_at is not None
            ):
                await entitlements_service.require_feature(
                    session, course.organization_id, "drip_scheduling"
                )

            # Adding an already-published lesson can flip a draft course
            # live — enforce the published_courses cap in that case.
            if create_schema.published:
                await self._require_published_course_slot(
                    session,
                    course_id=course.id,
                    organization_id=course.organization_id,
                )

        lesson = _build_lesson(create_schema)
        lesson.module_id = module.id
        return await lesson_repo.create(lesson, flush=True)

    async def _require_published_course_slot(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        organization_id: UUID,
    ) -> None:
        """Enforce the published_courses cap when a course is about to gain
        its *first* published lesson (draft -> published). A course that
        already has a published lesson doesn't consume a new slot, and draft
        courses are free, so the cap meters live courses — not created ones.
        """
        lesson_repo = CourseLessonRepository.from_session(session)
        if await lesson_repo.count_published_by_course(course_id) > 0:
            return
        course_repo = CourseRepository.from_session(session)
        current = await course_repo.count_published_by_organization(
            organization_id
        )
        await entitlements_service.require_under_limit(
            session, organization_id, "published_courses", current=current
        )

    async def update_lesson(
        self,
        session: AsyncSession,
        lesson: CourseLesson,
        update_schema: CourseLessonUpdate,
    ) -> CourseLesson:
        lesson_repo = CourseLessonRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True)

        # Block enabling drip scheduling on tiers that don't include it.
        # Clearing drip (None) is always allowed so creators on Free can
        # remove drip from a previously-Pro lesson after a downgrade.
        setting_drip = (
            update_dict.get("drip_days") is not None
            or update_dict.get("release_at") is not None
        )
        if setting_drip:
            organization_id = await lesson_repo.get_organization_id_for_lesson(
                lesson.id
            )
            if organization_id is not None:
                await entitlements_service.require_feature(
                    session, organization_id, "drip_scheduling"
                )

        # Publishing a lesson can flip its course from draft to live. Enforce
        # the published_courses cap on that transition (False/None -> True),
        # before the update lands. Unpublishing is always allowed.
        publishing = update_dict.get("published") is True and not lesson.published
        if publishing:
            resolved = await lesson_repo.get_course_and_org_for_lesson(lesson.id)
            if resolved is not None:
                course_id, organization_id = resolved
                await self._require_published_course_slot(
                    session,
                    course_id=course_id,
                    organization_id=organization_id,
                )

        return await lesson_repo.update(lesson, update_dict=update_dict)

    async def get_lesson_by_id(
        self, session: AsyncSession, lesson_id: UUID
    ) -> CourseLesson | None:
        lesson_repo = CourseLessonRepository.from_session(session)
        return await lesson_repo.get_by_id(lesson_id)

    async def clear_lesson_video(
        self, session: AsyncSession, lesson: CourseLesson
    ) -> CourseLesson:
        """Detach any video asset from a lesson and reset its content state.

        Fires the asset-cleanup job idempotently so a half-uploaded or
        ready asset is removed from the provider even if the user immediately
        re-uploads — the worker tolerates 404s on subsequent attempts.
        """
        from polar.worker import enqueue_job

        asset_id = getattr(lesson, "mux_asset_id", None)
        if asset_id:
            enqueue_job("course.mux_delete_asset", asset_id=asset_id)

        lesson_repo = CourseLessonRepository.from_session(session)
        return await lesson_repo.update(
            lesson,
            update_dict={
                "mux_upload_id": None,
                "mux_asset_id": None,
                "mux_playback_id": None,
                "mux_status": None,
                "duration_seconds": None,
            },
        )

    async def delete_lesson(
        self, session: AsyncSession, lesson: CourseLesson
    ) -> None:
        # Enqueue Mux asset cleanup before soft-delete so we still have
        # the asset id available. The worker is idempotent (404 from Mux
        # counts as success), so a failed enqueue is safe to retry later.
        from polar.worker import enqueue_job

        lesson_repo = CourseLessonRepository.from_session(session)
        asset_id = getattr(lesson, "mux_asset_id", None)
        if asset_id:
            enqueue_job("course.mux_delete_asset", asset_id=asset_id)
        await lesson_repo.soft_delete(lesson)

    async def reorder_lessons(
        self,
        session: AsyncSession,
        module: CourseModule,
        ordered_ids: Sequence[UUID],
    ) -> Sequence[CourseLesson]:
        """Reorder lessons within a module by setting position to list index."""
        lesson_repo = CourseLessonRepository.from_session(session)
        existing_ids = {lesson.id for lesson in module.lessons}
        if set(ordered_ids) != existing_ids:
            raise ValueError("ordered_ids must contain exactly the module's lessons")
        by_id = {lesson.id: lesson for lesson in module.lessons}
        for index, lesson_id in enumerate(ordered_ids):
            await lesson_repo.update(by_id[lesson_id], update_dict={"position": index})
        return [by_id[lid] for lid in ordered_ids]

    # --- Enrollment ---

    async def enroll_customer(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        customer: Customer,
        product_id: UUID | None = None,
    ) -> CourseEnrollment:
        """Enroll a customer in a course.

        Idempotent: if an active enrollment already exists, return it.
        Soft-deleted enrollments are ignored by the lookup so a customer
        who was revoked can re-enroll cleanly. The partial unique index
        on (customer_id, course_id) where deleted_at IS NULL prevents
        duplicate active rows under concurrent grants — a losing
        transaction will surface as IntegrityError and the caller (a
        Dramatiq actor for benefit grant) will retry.
        """
        repo = CourseEnrollmentRepository.from_session(session)
        statement = repo.get_by_customer_and_course_statement(customer.id, course_id)
        existing = await repo.get_one_or_none(statement)
        if existing is not None:
            return existing

        enrollment = CourseEnrollment(
            customer_id=customer.id,
            course_id=course_id,
            product_id=product_id,
            enrolled_at=datetime.now(tz=UTC),
        )
        enrollment = await repo.create(enrollment, flush=True)
        await self._fire_course_event(
            session,
            course_id=course_id,
            customer_id=customer.id,
            event_name="course.enrolled",
        )
        return enrollment

    async def revoke_enrollment(
        self,
        session: AsyncSession,
        enrollment_id: UUID,
    ) -> None:
        repo = CourseEnrollmentRepository.from_session(session)
        enrollment = await repo.get_by_id(enrollment_id)
        if enrollment is not None:
            await repo.soft_delete(enrollment)

    async def list_enrollments_for_customer(
        self,
        session: AsyncSession,
        customer_id: UUID,
    ) -> Sequence[CourseEnrollment]:
        repo = CourseEnrollmentRepository.from_session(session)
        statement = repo.get_by_customer_statement(customer_id)
        return await repo.get_all(statement)

    async def list_enrollments_for_course(
        self,
        session: AsyncSession,
        course_id: UUID,
    ) -> Sequence[CourseEnrollment]:
        repo = CourseEnrollmentRepository.from_session(session)
        statement = repo.get_base_statement().where(
            CourseEnrollment.course_id == course_id
        )
        return await repo.get_all(statement)

    async def paginate_enrollments_for_course(
        self,
        session: AsyncSession,
        course_id: UUID,
        *,
        limit: int,
        page: int,
    ) -> tuple[Sequence[CourseEnrollment], int]:
        from sqlalchemy.orm import selectinload

        repo = CourseEnrollmentRepository.from_session(session)
        # Eager-load the customer in the same round trip — the endpoint
        # used to issue a follow-up SELECT … WHERE id IN (…) which
        # doubled the wire time on the customers tab. With selectinload
        # SQLAlchemy batches the customers query alongside this one.
        statement = (
            repo.get_base_statement()
            .where(CourseEnrollment.course_id == course_id)
            .order_by(CourseEnrollment.enrolled_at.desc())
            .options(selectinload(CourseEnrollment.customer))
        )
        return await repo.paginate(statement, limit=limit, page=page)

    async def get_enrollment_by_id(
        self,
        session: AsyncSession,
        enrollment_id: UUID,
    ) -> CourseEnrollment | None:
        repo = CourseEnrollmentRepository.from_session(session)
        return await repo.get_by_id(enrollment_id)

    async def get_enrollment_for_customer(
        self,
        session: AsyncSession,
        customer_id: UUID,
        course_id: UUID,
    ) -> CourseEnrollment | None:
        repo = CourseEnrollmentRepository.from_session(session)
        statement = repo.get_by_customer_and_course_statement(customer_id, course_id)
        return await repo.get_one_or_none(statement)

    # --- Progress ---

    async def mark_lesson_complete(
        self,
        session: AsyncSession,
        *,
        enrollment_id: UUID,
        lesson_id: UUID,
    ) -> CourseLessonProgress:
        repo = CourseLessonProgressRepository.from_session(session)
        existing = await repo.get_one_or_none(
            repo.get_by_enrollment_and_lesson_statement(enrollment_id, lesson_id)
        )
        if existing is not None:
            return existing
        progress = CourseLessonProgress(
            enrollment_id=enrollment_id,
            lesson_id=lesson_id,
            completed_at=datetime.now(tz=UTC),
        )
        progress = await repo.create(progress, flush=True)
        await self._fire_lesson_completion_events(
            session, enrollment_id=enrollment_id, lesson_id=lesson_id
        )
        return progress

    # --- Automation event firing ---

    async def _fire_course_event(
        self,
        session: AsyncSession,
        *,
        course_id: UUID,
        customer_id: UUID,
        event_name: str,
        lesson_id: UUID | None = None,
    ) -> None:
        course = await CourseRepository.from_session(session).get_by_id(course_id)
        if course is None:
            return
        subscriber_repo = EmailSubscriberRepository.from_session(session)
        subscriber = await subscriber_repo.get_by_customer_and_organization(
            customer_id, course.organization_id
        )
        if subscriber is None:
            return
        await fire_event(
            session,
            organization_id=course.organization_id,
            subscriber_id=subscriber.id,
            event_name=event_name,
            course_id=course_id,
            lesson_id=lesson_id,
        )

        # Goal completion: a sequence whose builder goal is "Completes the
        # course" / "Finishes a lesson" exits the moment the subscriber hits
        # that event — even while parked mid-wait. complete_for_goal only
        # touches sequences whose trigger_config.goal_event.type matches, so
        # this is a no-op for every other sequence. Run it BEFORE the enrol
        # fan-out below so it never closes an enrolment created on this tick.
        goal_type = {
            "course.completed": "course_completed",
            "course.lesson_completed": "lesson_completed",
        }.get(event_name)
        if goal_type is not None:
            from polar.email_sequence.service import (
                email_sequence as sequence_service,
            )

            await sequence_service.complete_for_goal(
                session,
                course.organization_id,
                subscriber.id,
                goal_type=goal_type,
            )

        # Per-lesson automations use a dedicated "completes this lesson"
        # trigger: completing the lesson ENTERS the subscriber into any active
        # sequence scoped to it (whereas fire_event above only resumes
        # sequences already parked on an until-event wait).
        if event_name == "course.lesson_completed" and lesson_id is not None:
            from polar.email_sequence.service import (
                email_sequence as sequence_service,
            )
            from polar.models.email_sequence import EmailSequenceTriggerType

            await sequence_service.enroll_for_trigger(
                session,
                course.organization_id,
                EmailSequenceTriggerType.on_lesson_completed,
                subscriber.id,
                lesson_id=lesson_id,
            )

        # Course-lifecycle automations enter the subscriber when they cross a
        # milestone — and, crucially, the moment they ENROL. Scoped to this
        # course so an event here never enrols into another course's sequence.
        # fire_event above already resumes any sequence parked on an until-event
        # wait for these same events.
        #
        # The "Student enrols" builder trigger is persisted as `on_purchase`
        # (see clients automationTrigger.ts) but enrolling into a course is not
        # a purchase — without this mapping the authored welcome email had no
        # path to ever send. We scope the on_purchase fan-out to this course_id,
        # so it only matches the course's own enrol automations and never the
        # org-wide purchase sequences (which carry no course_id).
        from polar.models.email_sequence import EmailSequenceTriggerType

        milestone_trigger = {
            "course.enrolled": EmailSequenceTriggerType.on_purchase,
            "course.first_lesson_completed": (
                EmailSequenceTriggerType.on_first_lesson_completed
            ),
            "course.mid_checkpoint": (
                EmailSequenceTriggerType.on_course_progress_halfway
            ),
            "course.completed": EmailSequenceTriggerType.on_course_completed,
        }.get(event_name)
        if milestone_trigger is not None:
            from polar.email_sequence.service import (
                email_sequence as sequence_service,
            )

            await sequence_service.enroll_for_trigger(
                session,
                course.organization_id,
                milestone_trigger,
                subscriber.id,
                course_id=course_id,
            )

    async def _fire_lesson_completion_events(
        self,
        session: AsyncSession,
        *,
        enrollment_id: UUID,
        lesson_id: UUID,
    ) -> None:
        """Fire automation events triggered by a lesson completion: the
        per-lesson event, plus derived events (first lesson, mid-course
        checkpoint, course complete) when their thresholds are crossed.
        """
        enrollment = await CourseEnrollmentRepository.from_session(
            session
        ).get_by_id(enrollment_id)
        if enrollment is None:
            return

        progress_repo = CourseLessonProgressRepository.from_session(session)
        lesson_repo = CourseLessonRepository.from_session(session)
        completed_count = await progress_repo.count_by_enrollment(enrollment_id)
        total_count = await lesson_repo.count_by_course(enrollment.course_id)

        common = {
            "course_id": enrollment.course_id,
            "customer_id": enrollment.customer_id,
        }

        await self._fire_course_event(
            session,
            event_name="course.lesson_completed",
            lesson_id=lesson_id,
            **common,
        )

        if completed_count == 1:
            await self._fire_course_event(
                session, event_name="course.first_lesson_completed", **common
            )

        # course.module_completed — fires the first time an enrollment
        # has every (non-soft-deleted) lesson in a single module
        # completed. Used by the community milestone job (Chunk 6 in the
        # community module) and available to email_sequence flow_engine.
        lesson = await lesson_repo.get_by_id(lesson_id)
        if lesson is not None:
            module_total = await lesson_repo.count_by_module(lesson.module_id)
            if module_total > 0:
                module_completed = (
                    await progress_repo.count_by_enrollment_in_module(
                        enrollment_id, lesson.module_id
                    )
                )
                if module_completed >= module_total:
                    await self._fire_course_event(
                        session,
                        event_name="course.module_completed",
                        lesson_id=lesson_id,
                        **common,
                    )
                    # Forward to the community module so it can insert a
                    # milestone post (subject to community-enabled +
                    # milestones_enabled flags). Cross-module via the
                    # job queue so course/ stays free of community/
                    # imports.
                    from polar.worker import enqueue_job

                    enqueue_job(
                        "community.module_completed_listener",
                        course_id=enrollment.course_id,
                        customer_id=enrollment.customer_id,
                        lesson_id=lesson_id,
                    )

        if total_count > 0:
            prev_pct = (completed_count - 1) / total_count
            cur_pct = completed_count / total_count
            if prev_pct < 0.5 <= cur_pct:
                await self._fire_course_event(
                    session, event_name="course.mid_checkpoint", **common
                )
            if completed_count >= total_count:
                await self._fire_course_event(
                    session, event_name="course.completed", **common
                )

    async def get_progress_for_enrollment(
        self,
        session: AsyncSession,
        *,
        enrollment_id: UUID,
    ) -> Sequence[CourseLessonProgress]:
        repo = CourseLessonProgressRepository.from_session(session)
        return await repo.get_all(repo.get_by_enrollment_statement(enrollment_id))

    # --- Lesson comments ---

    async def list_lesson_comments(
        self,
        session: AsyncSession,
        *,
        lesson_id: UUID,
    ) -> Sequence[LessonComment]:
        """List visible comments for a lesson, plus soft-deleted parents
        whose replies are still visible. The frontend renders deleted
        parents as tombstones so the reply tree stays reachable.
        """
        from polar.kit.comments import (
            find_orphan_parent_ids,
            merge_with_tombstones,
        )

        repo = LessonCommentRepository.from_session(session)
        statement = repo.get_by_lesson_statement(lesson_id).order_by(
            LessonComment.created_at.asc()
        )
        visible = list(await repo.get_all(statement))

        orphan_parent_ids = find_orphan_parent_ids(visible)
        if not orphan_parent_ids:
            return visible

        tombstones = await repo.get_tombstone_parents(lesson_id, orphan_parent_ids)
        return merge_with_tombstones(visible, tombstones)

    async def create_lesson_comment(
        self,
        session: AsyncSession,
        *,
        enrollment_id: UUID,
        lesson_id: UUID,
        content: str,
        parent_id: UUID | None = None,
    ) -> LessonComment:
        repo = LessonCommentRepository.from_session(session)
        if parent_id is not None:
            parent = await repo.get_by_id(parent_id)
            if parent is None or parent.lesson_id != lesson_id:
                raise ValueError("Invalid parent comment")
        comment = LessonComment(
            lesson_id=lesson_id,
            enrollment_id=enrollment_id,
            parent_id=parent_id,
            content=content,
        )
        return await repo.create(comment, flush=True)

    async def get_lesson_comment(
        self, session: AsyncSession, comment_id: UUID
    ) -> LessonComment | None:
        repo = LessonCommentRepository.from_session(session)
        return await repo.get_by_id(comment_id)

    async def delete_lesson_comment(
        self,
        session: AsyncSession,
        comment: LessonComment,
    ) -> None:
        repo = LessonCommentRepository.from_session(session)
        await repo.soft_delete(comment)

    async def toggle_lesson_comment_like(
        self,
        session: AsyncSession,
        *,
        comment: LessonComment,
        enrollment_id: UUID,
    ) -> tuple[bool, int]:
        """Toggle the requesting enrollment's heart on a comment.

        Returns (liked, likes) — the new liked state for this enrollment and
        the comment's total like count. The unique (comment, enrollment)
        constraint means a row can exist at most once, so a second call
        hard-deletes it: there is no way to double-like.
        """
        repo = LessonCommentLikeRepository.from_session(session)
        existing = await repo.get_like(comment.id, enrollment_id)
        if existing is not None:
            await session.delete(existing)
            await session.flush()
            liked = False
        else:
            await repo.create(
                LessonCommentLike(
                    lesson_comment_id=comment.id,
                    enrollment_id=enrollment_id,
                ),
                flush=True,
            )
            liked = True
        likes = await repo.count_for_comment(comment.id)
        return liked, likes

    async def get_lesson_comment_likes(
        self,
        session: AsyncSession,
        *,
        comment_ids: Sequence[UUID],
        enrollment_id: UUID,
    ) -> tuple[dict[UUID, int], set[UUID]]:
        """Bulk like data for a listing: (counts by comment id, set of
        comment ids the requesting enrollment has liked)."""
        repo = LessonCommentLikeRepository.from_session(session)
        counts = await repo.counts_for_comments(comment_ids)
        liked = await repo.liked_comment_ids(comment_ids, enrollment_id)
        return counts, liked

    async def toggle_lesson_comment_pin(
        self,
        session: AsyncSession,
        *,
        comment: LessonComment,
    ) -> bool:
        """Pin/unpin a comment, YouTube-style: at most one pinned comment
        per lesson, so pinning clears the pin on any sibling first.
        Returns the comment's new pinned state."""
        repo = LessonCommentRepository.from_session(session)
        if comment.pinned_at is not None:
            await repo.update(comment, update_dict={"pinned_at": None})
            return False
        await repo.clear_pins_for_lesson(comment.lesson_id)
        await repo.update(
            comment, update_dict={"pinned_at": datetime.now(tz=UTC)}
        )
        return True

    async def toggle_instructor_heart(
        self,
        session: AsyncSession,
        *,
        comment: LessonComment,
    ) -> bool:
        """Toggle the single creator heart on a comment. Returns the new
        hearted state."""
        repo = LessonCommentRepository.from_session(session)
        hearted = comment.instructor_hearted_at is None
        await repo.update(
            comment,
            update_dict={
                "instructor_hearted_at": datetime.now(tz=UTC) if hearted else None
            },
        )
        return hearted

    # --- Flat lesson gating logic ---

    async def get_all_lessons_for_course(
        self, session: AsyncSession, course_id: UUID
    ) -> Sequence[CourseLesson]:
        """Get all lessons for a course, flattened across modules, ordered by position."""
        lesson_repo = CourseLessonRepository.from_session(session)
        statement = lesson_repo.get_by_course_statement(course_id)
        return await lesson_repo.get_all(statement)

    async def get_first_free_lesson(
        self, session: AsyncSession, course_id: UUID
    ) -> CourseLesson | None:
        """Get the first lesson marked as free preview (trailer) for a course."""
        lesson_repo = CourseLessonRepository.from_session(session)
        statement = (
            lesson_repo.get_by_course_statement(course_id)
            .where(CourseLesson.is_free_preview == True)
            .limit(1)
        )
        return await lesson_repo.get_one_or_none(statement)

    def calculate_lesson_accessibility(
        self,
        lesson: CourseLesson,
        paywall_position: int | None,
        enrolled_at: datetime,
        now: datetime,
        *,
        global_lesson_index: int | None = None,
    ) -> tuple[bool, datetime | None]:
        """Calculate if a lesson is accessible for an enrolled customer.

        Returns (is_accessible, locked_until_timestamp).

        Paywall is intentionally NOT considered here: once a customer is
        enrolled, every lesson past the paywall is theirs. The
        ``paywall_position`` parameter is kept for call-site compatibility.
        The only gating left is drip schedule (release_at / drip_days).

        Free previews are always accessible regardless of drip.
        """
        del paywall_position, global_lesson_index  # enrolled → paywall n/a

        if lesson.is_free_preview:
            return True, None

        if lesson.release_at and now < lesson.release_at:
            return False, lesson.release_at
        if lesson.drip_days is not None:
            from datetime import timedelta
            unlock_at = enrolled_at + timedelta(days=lesson.drip_days)
            if now < unlock_at:
                return False, unlock_at

        return True, None


    # ── Notes ────────────────────────────────────────────────────────────────

    async def get_lesson_note(
        self,
        session: AsyncSession,
        enrollment_id: UUID,
        lesson_id: UUID,
    ) -> CourseNote | None:
        repo = CourseNoteRepository.from_session(session)
        stmt = repo.get_by_enrollment_and_lesson_statement(enrollment_id, lesson_id)
        return await repo.get_one_or_none(stmt)

    async def list_course_notes(
        self,
        session: AsyncSession,
        enrollment_id: UUID,
    ) -> Sequence[CourseNote]:
        repo = CourseNoteRepository.from_session(session)
        stmt = repo.get_by_enrollment_statement(enrollment_id)
        return await repo.get_all(stmt)

    async def upsert_lesson_note(
        self,
        session: AsyncSession,
        enrollment_id: UUID,
        lesson_id: UUID,
        content: str,
    ) -> CourseNote:
        repo = CourseNoteRepository.from_session(session)
        stmt = repo.get_by_enrollment_and_lesson_statement(enrollment_id, lesson_id)
        existing = await repo.get_one_or_none(stmt)
        if existing is not None:
            return await repo.update(existing, {"content": content})
        return await repo.create(
            CourseNote(
                enrollment_id=enrollment_id,
                lesson_id=lesson_id,
                content=content,
            )
        )

    async def delete_lesson_note(
        self,
        session: AsyncSession,
        note: CourseNote,
    ) -> None:
        repo = CourseNoteRepository.from_session(session)
        await repo.soft_delete(note)


course_service = CourseService()
