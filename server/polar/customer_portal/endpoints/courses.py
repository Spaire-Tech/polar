import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

log = logging.getLogger(__name__)

from polar.auth.models import is_customer, is_member
from polar.course import mux as mux_client
from polar.course.repository import CourseLessonRepository
from polar.organization.repository import OrganizationRepository
from polar.quotas.definitions import QuotaKey
from polar.quotas.exceptions import QuotaExceededError
from polar.quotas.producers import emit_video_viewed, enforce
from polar.course.schemas import (
    CourseLessonFlatRead,
    CourseLandingPageRead,
    CourseNoteRead,
    CourseNoteUpsert,
    CourseProgressRead,
    LessonCommentAuthor,
    LessonCommentCreate,
    LessonCommentRead,
    QuizAnswerResult,
    QuizAttemptResult,
    QuizAttemptSubmission,
)
from polar.course.service import course_service
from polar.file.s3 import S3_SERVICES
from polar.models import Customer
from polar.models.course_enrollment import CourseEnrollment
from polar.models.course_lesson_progress import CourseLessonProgress
from polar.models.product import Product
from polar.models.product_media import ProductMedia
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..utils import get_customer_id

router = APIRouter(prefix="/courses", tags=["customer_portal_courses", APITag.public])


def _serialize_lesson(
    lesson, completed_ids: set[str], *, accessible: bool = True
) -> dict:
    """Serialize a lesson for the customer portal.

    When ``accessible`` is False (paywall- or drip-locked), strip body fields
    that would let a client bypass the lock (content, mux playback id,
    description, attachments).
    """
    base = {
        "id": str(lesson.id),
        "module_id": str(lesson.module_id),
        "title": lesson.title,
        "content_type": lesson.content_type,
        "position": lesson.position,
        "duration_seconds": lesson.duration_seconds,
        "is_free_preview": lesson.is_free_preview,
        "thumbnail_url": getattr(lesson, "thumbnail_url", None),
        "thumbnail_object_position": getattr(
            lesson, "thumbnail_object_position", None
        ),
        "comments_mode": getattr(lesson, "comments_mode", "visible"),
        "completed": str(lesson.id) in completed_ids,
    }
    if accessible:
        base["description"] = getattr(lesson, "description", None)
        base["content"] = lesson.content
        playback_id = getattr(lesson, "mux_playback_id", None)
        base["mux_playback_id"] = playback_id
        base["mux_playback_url"] = mux_client.playback_url(playback_id)
        base["mux_status"] = getattr(lesson, "mux_status", None)
    else:
        base["description"] = None
        base["content"] = None
        base["mux_playback_id"] = None
        base["mux_playback_url"] = None
        base["mux_status"] = None
    return base


def _build_module_list(course, paywall_position, enrolled_at, now, completed_ids):
    """Build module list for an enrolled customer.

    Returns (modules, accessible_lesson_ids) where accessible_lesson_ids is the
    set of lesson IDs included in the response (used as the progress denominator).

    Enrolled customers see every published lesson — the paywall only gates
    *non-enrolled* visitors and is enforced in the landing endpoint. Drip
    locking still applies: a module under drip release only exposes its
    free-preview lessons until the unlock date.
    """
    del paywall_position  # paywall is irrelevant for enrolled customers
    modules = []
    accessible_ids: set[str] = set()
    for m in course.modules:
        drip_locked = False
        locked_until = None
        if m.release_at and now < m.release_at:
            drip_locked = True
            locked_until = m.release_at.isoformat()
        elif m.drip_days is not None:
            unlock_at = enrolled_at + timedelta(days=m.drip_days)
            if now < unlock_at:
                drip_locked = True
                locked_until = unlock_at.isoformat()

        published_lessons = [lesson for lesson in m.lessons if lesson.published]

        if drip_locked:
            visible = [
                lesson for lesson in published_lessons if lesson.is_free_preview
            ]
        else:
            visible = published_lessons

        lessons = [
            _serialize_lesson(lesson, completed_ids, accessible=True)
            for lesson in visible
        ]
        for lesson in visible:
            accessible_ids.add(str(lesson.id))

        modules.append(
            {
                "id": str(m.id),
                "title": m.title,
                "description": m.description,
                "position": m.position,
                "locked": drip_locked,
                "locked_until": locked_until,
                "lessons": lessons,
            }
        )
    return modules, accessible_ids


def _build_flat_lesson_list(course, paywall_position, enrolled_at, now, completed_ids):
    """Build flat lesson list with paywall/drip locks and only published lessons.

    Returns (lessons, accessible_lesson_ids) where accessible_lesson_ids is the
    set of lesson IDs included in the response (used as the progress denominator).

    ``paywall_position`` is interpreted as a global lesson count.
    """
    flat_lessons = []
    accessible_ids: set[str] = set()

    # Flatten lessons in module order, then by within-module position so the
    # global index matches what the studio outline shows.
    ordered_lessons: list[tuple[int, object]] = []
    for module in course.modules:
        for lesson in sorted(module.lessons, key=lambda x: x.position):
            ordered_lessons.append((module.position, lesson))
    ordered_lessons.sort(key=lambda pair: (pair[0], pair[1].position))

    global_idx = -1
    for _module_pos, lesson in ordered_lessons:
        # Only published lessons are visible
        if not lesson.published:
            continue
        global_idx += 1

        # Calculate accessibility
        is_accessible, locked_until = course_service.calculate_lesson_accessibility(
            lesson,
            paywall_position,
            enrolled_at,
            now,
            global_lesson_index=global_idx,
        )

        locked = not is_accessible
        locked_until_str = locked_until.isoformat() if locked_until else None

        # Free-preview lessons inside locked modules stay fully accessible.
        accessible = is_accessible or lesson.is_free_preview
        lesson_data = _serialize_lesson(
            lesson, completed_ids, accessible=accessible
        )
        lesson_data["locked"] = locked
        lesson_data["locked_until"] = locked_until_str

        flat_lessons.append(lesson_data)

        if is_accessible:
            accessible_ids.add(str(lesson.id))

    return flat_lessons, accessible_ids


@router.get(
    "/",
    summary="List Enrolled Courses",
)
async def list_enrolled_courses(
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    customer_id = get_customer_id(auth_subject)
    enrollments = await course_service.list_enrollments_for_customer(
        session, customer_id
    )

    # Eager-load products + product_medias for thumbnail fallback. Course's
    # `product` relationship is lazy="raise" so we explicitly fetch.
    course_product_ids = {
        e.course.product_id for e in enrollments if e.course.product_id is not None
    }
    products_by_id: dict[UUID, Product] = {}
    if course_product_ids:
        prod_stmt = (
            select(Product)
            .where(Product.id.in_(course_product_ids))
            .options(
                selectinload(Product.product_medias).joinedload(ProductMedia.file)
            )
        )
        prod_result = await session.execute(prod_stmt)
        for product in prod_result.scalars().unique().all():
            products_by_id[product.id] = product

    # Bulk-load progress for all enrollments in this list.
    enrollment_ids = [e.id for e in enrollments]
    progress_by_enrollment: dict[UUID, list[CourseLessonProgress]] = {
        eid: [] for eid in enrollment_ids
    }
    if enrollment_ids:
        prog_stmt = select(CourseLessonProgress).where(
            CourseLessonProgress.enrollment_id.in_(enrollment_ids)
        )
        prog_result = await session.execute(prog_stmt)
        for progress in prog_result.scalars():
            progress_by_enrollment.setdefault(
                progress.enrollment_id, []
            ).append(progress)

    result = []
    now = datetime.now(tz=UTC)
    for enrollment in enrollments:
        course = enrollment.course
        progress_items = progress_by_enrollment.get(enrollment.id, [])
        completed_ids = {str(p.lesson_id) for p in progress_items}

        # Use the same accessibility logic as the detail endpoint so progress
        # lines up between list and detail views.
        _, accessible_ids = _build_flat_lesson_list(
            course,
            course.paywall_position,
            enrollment.enrolled_at,
            now,
            completed_ids,
        )
        total_lessons = len(accessible_ids)
        completed_count = len(completed_ids & accessible_ids)
        completion_percent = (
            round(completed_count / total_lessons * 100, 1)
            if total_lessons
            else 0.0
        )

        # Total duration across published lessons (in seconds).
        total_duration_seconds = sum(
            (lesson.duration_seconds or 0)
            for module in course.modules
            for lesson in module.lessons
            if lesson.published
        )

        # When the course is fully completed, surface the most recent
        # completion date so the UI can render "Completed Mar 14, 2025".
        completed_at: str | None = None
        if total_lessons > 0 and completed_count == total_lessons:
            relevant = [
                p for p in progress_items if str(p.lesson_id) in accessible_ids
            ]
            if relevant:
                completed_at = max(p.completed_at for p in relevant).isoformat()

        # Thumbnail: prefer course's own thumbnail, else fall back to the
        # first uploaded product media so the customer portal always shows
        # imagery the merchant provided on the product.
        thumbnail_url = course.thumbnail_url
        if not thumbnail_url and course.product_id:
            owning_product = products_by_id.get(course.product_id)
            if owning_product is not None:
                for media in owning_product.product_medias:
                    file = media.file
                    if file is None or not file.is_uploaded:
                        continue
                    s3 = S3_SERVICES.get(file.service)
                    if s3 is None:
                        continue
                    thumbnail_url = s3.get_public_url(file.path)
                    break

        published_lesson_count = sum(
            sum(1 for lesson in m.lessons if lesson.published)
            for m in course.modules
        )
        result.append(
            {
                "enrollment_id": str(enrollment.id),
                "enrolled_at": enrollment.enrolled_at.isoformat(),
                "course": {
                    "id": str(course.id),
                    "title": course.title,
                    "course_type": course.course_type,
                    "module_count": len(course.modules),
                    "lesson_count": published_lesson_count,
                    "thumbnail_url": thumbnail_url,
                    "thumbnail_object_position": course.thumbnail_object_position,
                    "total_duration_seconds": total_duration_seconds,
                },
                "progress": {
                    "total_lessons": total_lessons,
                    "completed_lessons": completed_count,
                    "completion_percent": completion_percent,
                },
                "completed_at": completed_at,
            }
        )
    return result


@router.get(
    "/{course_id}",
    summary="Get Enrolled Course",
)
async def get_enrolled_course(
    course_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    customer_id = get_customer_id(auth_subject)
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Course not found or not enrolled")

    progress_items = await course_service.get_progress_for_enrollment(
        session, enrollment_id=enrollment.id
    )
    completed_ids = {str(p.lesson_id) for p in progress_items}

    course = enrollment.course
    now = datetime.now(tz=UTC)
    enrolled_at = enrollment.enrolled_at

    customer = await session.get(Customer, customer_id)
    customer_name = customer.name if customer else None

    modules, accessible_ids = _build_module_list(
        course, course.paywall_position, enrolled_at, now, completed_ids
    )
    flat_lessons, flat_accessible_ids = _build_flat_lesson_list(
        course, course.paywall_position, enrolled_at, now, completed_ids
    )

    # Progress only counts lessons the student can actually access.
    total_lessons = len(flat_accessible_ids)
    completed_count = len(completed_ids & flat_accessible_ids)

    return {
        "enrollment_id": str(enrollment.id),
        "enrolled_at": enrolled_at.isoformat(),
        "customer_name": customer_name,
        "progress": {
            "total_lessons": total_lessons,
            "completed_lessons": completed_count,
            "completion_percent": (
                round(completed_count / total_lessons * 100, 1)
                if total_lessons
                else 0.0
            ),
        },
        "course": {
            "id": str(course.id),
            "title": course.title,
            "description": course.description,
            "thumbnail_url": course.thumbnail_url,
            "thumbnail_object_position": course.thumbnail_object_position,
            "instructor_name": course.instructor_name,
            "instructor_bio": course.instructor_bio,
            "trailer_url": course.trailer_url,
            "instructor_name_italic": course.instructor_name_italic,
            "instructor_name_bold": course.instructor_name_bold,
            "instructor_name_uppercase": course.instructor_name_uppercase,
            "course_type": course.course_type,
            "paywall_enabled": course.paywall_enabled,
            "paywall_position": course.paywall_position,
            "landing_overrides": course.landing_overrides,
            "modules": modules,
            "lessons": flat_lessons,
        },
    }


@router.post(
    "/{course_id}/lessons/{lesson_id}/quiz-attempt",
    response_model=QuizAttemptResult,
    summary="Submit Quiz Attempt",
)
async def submit_quiz_attempt(
    course_id: UUID,
    lesson_id: UUID,
    submission: QuizAttemptSubmission,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> QuizAttemptResult:
    customer_id = get_customer_id(auth_subject)
    enrollment, lesson = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
    )

    if lesson.content_type != "quiz":
        raise HTTPException(status_code=400, detail="Lesson is not a quiz")

    config = lesson.content or {}
    questions = list(config.get("questions") or [])
    if not questions:
        raise HTTPException(status_code=400, detail="Quiz has no questions")

    passing_grade = int(config.get("passing_grade", 70))
    prevent_complete_without_passing = bool(
        config.get("prevent_complete_without_passing", False)
    )

    submitted_by_qid = {a.question_id: set(a.selected_option_ids) for a in submission.answers}

    answer_results: list[QuizAnswerResult] = []
    graded_count = 0
    correct_count = 0
    for question in questions:
        qid = question.get("id")
        if not qid:
            continue
        graded = bool(question.get("graded", True))
        options = question.get("options") or []
        correct_ids = {o["id"] for o in options if o.get("is_correct") and o.get("id")}
        explanations = {
            o["id"]: o["explanation"]
            for o in options
            if o.get("id") and o.get("explanation")
        }
        selected = submitted_by_qid.get(qid, set())
        is_correct = bool(graded) and selected == correct_ids and len(correct_ids) > 0
        if graded:
            graded_count += 1
            if is_correct:
                correct_count += 1
        answer_results.append(
            QuizAnswerResult(
                question_id=qid,
                correct=is_correct,
                correct_option_ids=list(correct_ids),
                explanations=explanations,
            )
        )

    score = (correct_count / graded_count * 100) if graded_count else 100.0
    passed = score >= passing_grade if graded_count else True

    if passed or not prevent_complete_without_passing:
        await course_service.mark_lesson_complete(
            session, enrollment_id=enrollment.id, lesson_id=lesson_id
        )

    return QuizAttemptResult(
        score=round(score, 1),
        passed=passed,
        passing_grade=passing_grade,
        total_questions=graded_count,
        correct_count=correct_count,
        answers=answer_results,
    )


@router.post(
    "/{course_id}/lessons/{lesson_id}/playback-url",
    summary="Mint Lesson Playback URL",
)
async def mint_lesson_playback_url(
    course_id: UUID,
    lesson_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str | None]:
    """Authorize and mint a signed Mux playback URL for the lesson.

    The client should call this endpoint each time it starts video
    playback. Doing so records one view against the course owner's
    monthly video-view quota. When the org has exhausted its quota,
    this endpoint returns 402 and no playback URL is issued — the
    customer sees an explanatory message instead of the video.
    """
    customer_id = get_customer_id(auth_subject)
    enrollment, lesson = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
    )
    if lesson.content_type != "video":
        raise HTTPException(
            status_code=400, detail="Lesson is not a video lesson"
        )
    playback_id = getattr(lesson, "mux_playback_id", None)
    if not playback_id:
        raise HTTPException(
            status_code=404, detail="Lesson video is not available yet"
        )

    lesson_repo = CourseLessonRepository.from_session(session)
    organization_id = await lesson_repo.get_organization_id_for_lesson(lesson.id)
    if organization_id is not None:
        org_repo = OrganizationRepository.from_session(session)
        organization = await org_repo.get_by_id(organization_id)
        if organization is not None:
            try:
                await enforce(
                    session,
                    organization,
                    QuotaKey.video_views_monthly,
                    requested_storage_units=1,
                )
            except QuotaExceededError as exc:
                raise HTTPException(
                    status_code=402, detail=exc.message
                ) from exc
            emit_video_viewed(session, organization_id=organization.id)
    _ = enrollment

    return {
        "mux_playback_id": playback_id,
        "mux_playback_url": mux_client.playback_url(playback_id),
    }


@router.post(
    "/{course_id}/lessons/{lesson_id}/complete",
    status_code=204,
    summary="Mark Lesson Complete",
)
async def mark_lesson_complete(
    course_id: UUID,
    lesson_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    customer_id = get_customer_id(auth_subject)
    enrollment, lesson = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
    )
    # Quiz lessons must be completed via the quiz-attempt endpoint so the
    # passing-grade rule (prevent_complete_without_passing) is enforced.
    if lesson.content_type == "quiz":
        raise HTTPException(
            status_code=400,
            detail=(
                "Quiz lessons can only be completed by submitting a quiz attempt"
            ),
        )
    await course_service.mark_lesson_complete(
        session, enrollment_id=enrollment.id, lesson_id=lesson_id
    )


@router.get(
    "/{course_id}/progress",
    summary="Get Course Progress",
)
async def get_course_progress(
    course_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> CourseProgressRead:
    customer_id = get_customer_id(auth_subject)
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Course not found or not enrolled")

    progress_items = await course_service.get_progress_for_enrollment(
        session, enrollment_id=enrollment.id
    )
    course = enrollment.course
    now = datetime.now(tz=UTC)
    completed_ids = {str(p.lesson_id) for p in progress_items}

    # Use the flat lesson list logic so progress matches the flat lesson list response
    _, accessible_ids = _build_flat_lesson_list(
        course,
        course.paywall_position,
        enrollment.enrolled_at,
        now,
        completed_ids,
    )
    total = len(accessible_ids)
    completed = len(completed_ids & accessible_ids)

    return CourseProgressRead(
        total_lessons=total,
        completed_lessons=completed,
        completion_percent=round(completed / total * 100, 1) if total else 0.0,
        completed={
            str(p.lesson_id): p.completed_at.isoformat() for p in progress_items
        },
    )


@router.get(
    "/{course_id}/landing",
    summary="Get Course Landing Page",
)
async def get_course_landing(
    course_id: UUID,
    auth_subject: auth.CustomerPortalLandingRead,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get course landing page data with public lesson list.

    This endpoint is used for both authenticated and unauthenticated users.
    For enrolled users, includes all lessons (with gating status).
    For non-enrolled users (or anonymous visitors), includes only free
    preview lessons.
    """
    # Anonymous visitors have no customer; only resolve a customer id when
    # the auth subject is actually a Customer or Member.
    customer_id = (
        get_customer_id(auth_subject)
        if is_customer(auth_subject) or is_member(auth_subject)
        else None
    )
    now = datetime.now(tz=UTC)

    # Load the course
    course = await course_service.get_by_id(session, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check if customer is enrolled
    enrollment = None
    if customer_id:
        enrollment = await course_service.get_enrollment_for_customer(
            session, customer_id, course_id
        )

    # Build lesson list based on enrollment
    if enrollment:
        # Enrolled: show all accessible lessons with gating info
        progress_items = await course_service.get_progress_for_enrollment(
            session, enrollment_id=enrollment.id
        )
        completed_ids = {str(p.lesson_id) for p in progress_items}
        flat_lessons, _ = _build_flat_lesson_list(
            course, course.paywall_position, enrollment.enrolled_at, now, completed_ids
        )
        has_access = True
    else:
        # Not enrolled: return every published lesson so the public landing
        # can render both the free preview grid and the paywall CTA (with
        # locked-lesson previews). Sensitive fields are stripped from
        # locked lessons.
        flat_lessons = []
        # Flatten in (module.position, lesson.position) order so the global
        # index used by the paywall slice matches what the studio outline
        # shows. Sorting by `lesson.position` alone scrambled cross-module
        # ordering because lesson positions reset per module — that meant
        # paywall_position=3 could pick the wrong three lessons.
        published_lessons = []
        for module in sorted(course.modules, key=lambda m: m.position):
            for lesson in sorted(module.lessons, key=lambda l: l.position):
                if lesson.published:
                    published_lessons.append(lesson)

        # Paywall always drives the free-preview slice for the storefront,
        # even when an individual lesson has `is_free_preview=True`. The
        # previous behaviour was: if *any* lesson had the flag set, paywall
        # was ignored entirely and only flagged lessons appeared as free.
        # That made setting paywall_position=3 silently regress to "only
        # the trailer lesson is free" once a single lesson somewhere on the
        # course had the explicit flag — confusing in the studio because
        # the customize tab kept showing all three free-preview cards.
        paywall_at = (
            course.paywall_position
            if course.paywall_position is not None and course.paywall_position > 0
            else None
        )

        for idx, lesson in enumerate(published_lessons):
            if paywall_at is not None:
                is_free = idx < paywall_at
            else:
                is_free = bool(lesson.is_free_preview)

            lesson_data = _serialize_lesson(lesson, set(), accessible=is_free)
            lesson_data["is_free_preview"] = is_free
            lesson_data["locked"] = not is_free
            lesson_data["locked_until"] = None
            flat_lessons.append(lesson_data)
        has_access = False

    # Calculate total duration
    total_duration = sum(l.get("duration_seconds") or 0 for l in flat_lessons)

    media = (course.landing_overrides or {}).get("media") or {}
    log.info(
        "course.landing served",
        extra={
            "course_id": str(course.id),
            "thumbnail_url": course.thumbnail_url,
            "trailer_url": course.trailer_url,
            "media_slot_ids": sorted(media.keys()),
            "lesson_ids": [l.get("id") for l in flat_lessons],
        },
    )
    # Modules (id + title + position) so the public landing's "Sections"
    # roadmap can render the same one-card-per-module layout the dashboard
    # customize tab shows. We don't include lessons here — `flat_lessons`
    # already covers what the public page needs.
    modules_public = [
        {
            "id": str(m.id),
            "title": m.title,
            "description": m.description,
            "position": m.position,
        }
        for m in sorted(course.modules, key=lambda m: m.position)
    ]
    return {
        "id": str(course.id),
        "title": course.title,
        "description": course.description,
        "thumbnail_url": course.thumbnail_url,
        "thumbnail_object_position": course.thumbnail_object_position,
        "instructor_name": course.instructor_name,
        "instructor_bio": course.instructor_bio,
        "trailer_url": course.trailer_url,
        "instructor_name_italic": course.instructor_name_italic,
        "instructor_name_bold": course.instructor_name_bold,
        "instructor_name_uppercase": course.instructor_name_uppercase,
        "course_type": course.course_type,
        "lesson_count": len(flat_lessons),
        "total_duration_seconds": total_duration,
        "landing_overrides": course.landing_overrides,
        "lessons": flat_lessons,
        "modules": modules_public,
        "paywall_enabled": bool(course.paywall_enabled),
        "paywall_position": course.paywall_position,
        "has_access": has_access,
    }


@router.get(
    "/by-product/{product_id}/landing",
    summary="Get Course Landing Page by Product",
)
async def get_course_landing_by_product(
    product_id: UUID,
    auth_subject: auth.CustomerPortalLandingRead,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Public landing data for a course, looked up by its product id.

    Mirrors `/courses/{course_id}/landing` but lets the public storefront
    page resolve the course without first needing the course id.
    """
    course = await course_service.get_by_product(session, product_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return await get_course_landing(
        course_id=course.id, auth_subject=auth_subject, session=session
    )


@router.post(
    "/{course_id}/lessons/{lesson_id}/can-access",
    summary="Check Lesson Access",
)
async def check_lesson_access(
    course_id: UUID,
    lesson_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Check if the current user can access a lesson.

    Returns { "can_access": bool, "reason": str, "locked_until": timestamp | null }
    Reasons: "free" (is_free_preview), "enrolled" (has product), "paywall", "drip", "unpublished"
    """
    customer_id = get_customer_id(auth_subject)
    now = datetime.now(tz=UTC)

    # Load lesson
    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_by_id(lesson_id)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Verify lesson is in this course
    course = await course_service.get_by_id(session, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    # Reject if the lesson belongs to a different course (prevents probing
    # other courses' lesson ids through this endpoint).
    module_course_id = getattr(getattr(lesson, "module", None), "course_id", None)
    if module_course_id is None or module_course_id != course.id:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Check if lesson is published
    if not lesson.published:
        return {"can_access": False, "reason": "unpublished", "locked_until": None}

    # Check if free preview
    if lesson.is_free_preview:
        return {"can_access": True, "reason": "free", "locked_until": None}

    # Check enrollment
    enrollment = None
    if customer_id:
        enrollment = await course_service.get_enrollment_for_customer(
            session, customer_id, course_id
        )

    if not enrollment:
        return {"can_access": False, "reason": "paywall", "locked_until": None}

    # User is enrolled, check drip/paywall gating
    is_accessible, locked_until = course_service.calculate_lesson_accessibility(
        lesson, course.paywall_position, enrollment.enrolled_at, now
    )

    if is_accessible:
        return {"can_access": True, "reason": "enrolled", "locked_until": None}
    elif locked_until:
        if lesson.drip_days is not None:
            reason = "drip"
        else:
            reason = "paywall"
        return {
            "can_access": False,
            "reason": reason,
            "locked_until": locked_until.isoformat(),
        }
    else:
        return {"can_access": False, "reason": "paywall", "locked_until": None}


# --- Lesson comments ---


async def _verify_lesson_in_enrolled_course(
    session: AsyncSession,
    customer_id: UUID,
    course_id: UUID,
    lesson_id: UUID,
):
    """Return (enrollment, lesson) or raise 404. Also rejects unpublished lessons
    and lessons that aren't in modules currently accessible to the student
    (paywall/drip)."""
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Course not found or not enrolled")

    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_by_id(lesson_id)
    if lesson is None or not lesson.published:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Walk the course tree to confirm the lesson is in this course AND accessible.
    course = enrollment.course
    now = datetime.now(tz=UTC)
    _, accessible_ids = _build_module_list(
        course, course.paywall_position, enrollment.enrolled_at, now, set()
    )
    if str(lesson.id) not in accessible_ids:
        raise HTTPException(status_code=403, detail="Lesson is not accessible")

    return enrollment, lesson


def _resolve_author_name(name: str | None, email: str | None) -> str | None:
    if name:
        stripped = name.strip()
        if stripped:
            return stripped
    if email:
        local_part = email.split("@", 1)[0].strip()
        if local_part:
            return local_part
    return None


async def _load_authors(
    session: AsyncSession, enrollment_ids: set[UUID]
) -> dict[UUID, LessonCommentAuthor]:
    if not enrollment_ids:
        return {}
    stmt = select(CourseEnrollment.id, Customer.name, Customer.email).join(
        Customer, Customer.id == CourseEnrollment.customer_id
    ).where(CourseEnrollment.id.in_(enrollment_ids))
    result = await session.execute(stmt)
    return {
        row.id: LessonCommentAuthor(
            enrollment_id=row.id,
            name=_resolve_author_name(row.name, row.email),
        )
        for row in result
    }


@router.get(
    "/{course_id}/lessons/{lesson_id}/comments",
    response_model=list[LessonCommentRead],
    summary="List Lesson Comments",
)
async def list_lesson_comments(
    course_id: UUID,
    lesson_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[LessonCommentRead]:
    customer_id = get_customer_id(auth_subject)
    enrollment, lesson = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
    )
    if getattr(lesson, "comments_mode", "visible") == "hidden":
        raise HTTPException(
            status_code=403, detail="Comments are disabled for this lesson"
        )
    comments = await course_service.list_lesson_comments(
        session, lesson_id=lesson_id
    )
    authors = await _load_authors(session, {c.enrollment_id for c in comments})
    return [
        LessonCommentRead(
            id=c.id,
            lesson_id=c.lesson_id,
            parent_id=c.parent_id,
            # Soft-deleted comments come back as tombstones so their
            # replies remain in the tree — strip the body so the deleted
            # message itself is not surfaced.
            content="" if c.deleted_at is not None else c.content,
            created_at=c.created_at,
            is_own=c.enrollment_id == enrollment.id and c.deleted_at is None,
            author=authors.get(
                c.enrollment_id,
                LessonCommentAuthor(enrollment_id=c.enrollment_id, name=None),
            ),
            deleted=c.deleted_at is not None,
        )
        for c in comments
    ]


@router.post(
    "/{course_id}/lessons/{lesson_id}/comments",
    response_model=LessonCommentRead,
    status_code=201,
    summary="Create Lesson Comment",
)
async def create_lesson_comment(
    course_id: UUID,
    lesson_id: UUID,
    payload: LessonCommentCreate,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> LessonCommentRead:
    customer_id = get_customer_id(auth_subject)
    enrollment, lesson = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
    )
    mode = getattr(lesson, "comments_mode", "visible")
    if mode != "visible":
        raise HTTPException(
            status_code=403,
            detail=(
                "Comments are disabled for this lesson"
                if mode == "hidden"
                else "Comments are locked for this lesson"
            ),
        )
    try:
        comment = await course_service.create_lesson_comment(
            session,
            enrollment_id=enrollment.id,
            lesson_id=lesson_id,
            content=payload.content,
            parent_id=payload.parent_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    authors = await _load_authors(session, {enrollment.id})
    return LessonCommentRead(
        id=comment.id,
        lesson_id=comment.lesson_id,
        parent_id=comment.parent_id,
        content=comment.content,
        created_at=comment.created_at,
        is_own=True,
        author=authors.get(
            enrollment.id,
            LessonCommentAuthor(enrollment_id=enrollment.id, name=None),
        ),
    )


@router.delete(
    "/{course_id}/lessons/{lesson_id}/comments/{comment_id}",
    status_code=204,
    summary="Delete Lesson Comment",
)
async def delete_lesson_comment(
    course_id: UUID,
    lesson_id: UUID,
    comment_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    customer_id = get_customer_id(auth_subject)
    enrollment, _ = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
    )
    comment = await course_service.get_lesson_comment(session, comment_id)
    if comment is None or comment.lesson_id != lesson_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.enrollment_id != enrollment.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    await course_service.delete_lesson_comment(session, comment)


# ── Notes ──────────────────────────────────────────────────────────────────


@router.get(
    "/{course_id}/notes",
    response_model=list[CourseNoteRead],
    summary="List All Notes for Course",
)
async def list_course_notes(
    course_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[CourseNoteRead]:
    customer_id = get_customer_id(auth_subject)
    enrollment = await course_service.get_enrollment_for_customer(session, customer_id, course_id)
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Course not found or not enrolled")
    notes = await course_service.list_course_notes(session, enrollment.id)
    return [
        CourseNoteRead(id=n.id, lesson_id=n.lesson_id, content=n.content, created_at=n.created_at, modified_at=n.modified_at)
        for n in notes
    ]


@router.put(
    "/{course_id}/lessons/{lesson_id}/notes",
    response_model=CourseNoteRead,
    summary="Upsert Lesson Note",
)
async def upsert_lesson_note(
    course_id: UUID,
    lesson_id: UUID,
    payload: CourseNoteUpsert,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> CourseNoteRead:
    customer_id = get_customer_id(auth_subject)
    enrollment, _ = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
    )
    note = await course_service.upsert_lesson_note(
        session,
        enrollment_id=enrollment.id,
        lesson_id=lesson_id,
        content=payload.content,
    )
    return CourseNoteRead(id=note.id, lesson_id=note.lesson_id, content=note.content, created_at=note.created_at, modified_at=note.modified_at)


@router.delete(
    "/{course_id}/lessons/{lesson_id}/notes",
    status_code=204,
    summary="Delete Lesson Note",
)
async def delete_lesson_note(
    course_id: UUID,
    lesson_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    customer_id = get_customer_id(auth_subject)
    enrollment, _ = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
    )
    note = await course_service.get_lesson_note(session, enrollment.id, lesson_id)
    if note is None:
        return
    await course_service.delete_lesson_note(session, note)
