from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from polar.email_sequence.events import fire_event
from polar.email_subscriber.repository import EmailSubscriberRepository
from polar.entitlements.service import entitlements as entitlements_service
from polar.models.course import Course
from polar.models.course_enrollment import CourseEnrollment
from polar.models.course_lesson import CourseLesson
from polar.models.course_lesson_progress import CourseLessonProgress
from polar.models.course_module import CourseModule
from polar.models.course_note import CourseNote
from polar.models.customer import Customer
from polar.models.lesson_comment import LessonComment
from polar.postgres import AsyncSession

from .repository import (
    CourseEnrollmentRepository,
    CourseLessonProgressRepository,
    CourseLessonRepository,
    CourseModuleRepository,
    CourseNoteRepository,
    CourseRepository,
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

        # Enforce the tier's published_courses cap. Counts all non-deleted
        # courses owned by the org (draft + public — both occupy a slot).
        current = await repo.count_by_organization(create_schema.organization_id)
        await entitlements_service.require_under_limit(
            session,
            create_schema.organization_id,
            "published_courses",
            current=current,
        )

        course = Course(
            product_id=create_schema.product_id,
            organization_id=create_schema.organization_id,
            title=create_schema.title,
            course_type=create_schema.course_type,
            format=create_schema.format,
            pacing_mode=create_schema.pacing_mode,
            paywall_enabled=create_schema.paywall_enabled,
            paywall_lesson_id=create_schema.paywall_lesson_id,
            ai_generated=create_schema.ai_generated,
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
        return course

    async def update(
        self,
        session: AsyncSession,
        course: Course,
        update_schema: CourseUpdate,
    ) -> Course:
        repo = CourseRepository.from_session(session)
        update_dict = update_schema.model_dump(exclude_unset=True, mode="json")

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

    async def apply_weekly_pacing(
        self,
        session: AsyncSession,
        course: Course,
    ) -> list[CourseModule]:
        """Set drip_days = position*7 on every (non-deleted) module of a
        course in a single transaction, and flip the course's pacing_mode
        to 'paced_weekly' so the student-portal UI side-effect (Week N
        labels, unlock pills) stays consistent with the drip schedule.

        Without the pacing_mode update, calling this endpoint directly
        on a self_paced course set drip_days but the portal still
        rendered as self-paced — half-applied. Doing both in one
        transaction means the schedule and its UI representation always
        agree."""
        course_repo = CourseRepository.from_session(session)
        module_repo = CourseModuleRepository.from_session(session)
        # Re-query modules in SQL order rather than relying on the
        # lazy relationship + Python sort. Same result for fresh
        # sessions, but the SQL path is the canonical "what the DB
        # would currently return" so the schedule lands on the right
        # weeks regardless of relationship caching state (audit B13).
        modules = list(
            await module_repo.get_all(
                module_repo.get_by_course_ordered_statement(course.id)
            )
        )
        for i, module in enumerate(modules):
            await module_repo.update(module, update_dict={"drip_days": i * 7})
        if course.pacing_mode != "paced_weekly":
            await course_repo.update(
                course, update_dict={"pacing_mode": "paced_weekly"}
            )
        return modules

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

        lesson = _build_lesson(create_schema)
        lesson.module_id = module.id
        return await lesson_repo.create(lesson, flush=True)

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
        repo = CourseEnrollmentRepository.from_session(session)
        statement = (
            repo.get_base_statement()
            .where(CourseEnrollment.course_id == course_id)
            .order_by(CourseEnrollment.enrolled_at.desc())
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
        from sqlalchemy import select

        repo = LessonCommentRepository.from_session(session)
        statement = repo.get_by_lesson_statement(lesson_id).order_by(
            LessonComment.created_at.asc()
        )
        visible = list(await repo.get_all(statement))

        # Find any visible reply whose parent is missing from the visible
        # set (most likely soft-deleted) and pull the deleted parent in too.
        visible_ids = {c.id for c in visible}
        orphan_parent_ids = {
            c.parent_id
            for c in visible
            if c.parent_id is not None and c.parent_id not in visible_ids
        }
        if orphan_parent_ids:
            tombstone_stmt = select(LessonComment).where(
                LessonComment.id.in_(orphan_parent_ids),
                LessonComment.lesson_id == lesson_id,
            )
            tombstones = (await session.execute(tombstone_stmt)).scalars().all()
            visible.extend(tombstones)
            visible.sort(key=lambda c: c.created_at)
        return visible

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
