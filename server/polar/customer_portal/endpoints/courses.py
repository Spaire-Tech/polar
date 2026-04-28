from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlalchemy import select

from polar.course.repository import CourseLessonRepository
from polar.course.schemas import (
    CourseLessonFlatRead,
    CourseLandingPageRead,
    CourseProgressRead,
    LessonCommentAuthor,
    LessonCommentCreate,
    LessonCommentRead,
    QuizAnswerResult,
    QuizAttemptResult,
    QuizAttemptSubmission,
)
from polar.course.service import course_service
from polar.models import Customer
from polar.models.course_enrollment import CourseEnrollment
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..utils import get_customer_id

router = APIRouter(prefix="/courses", tags=["customer_portal_courses", APITag.public])


def _serialize_lesson(lesson, completed_ids: set[str]) -> dict:
    return {
        "id": str(lesson.id),
        "title": lesson.title,
        "content_type": lesson.content_type,
        "content": lesson.content,
        "position": lesson.position,
        "duration_seconds": lesson.duration_seconds,
        "is_free_preview": lesson.is_free_preview,
        "mux_playback_id": getattr(lesson, "mux_playback_id", None),
        "mux_status": getattr(lesson, "mux_status", None),
        "thumbnail_url": getattr(lesson, "thumbnail_url", None),
        "completed": str(lesson.id) in completed_ids,
    }


def _build_module_list(course, paywall_position, enrolled_at, now, completed_ids):
    """Build module list with paywall/drip locks and only published lessons.

    Returns (modules, accessible_lesson_ids) where accessible_lesson_ids is the
    set of lesson IDs included in the response (used as the progress denominator).
    """
    modules = []
    accessible_ids: set[str] = set()
    for idx, m in enumerate(course.modules):
        # Paywall: modules at index >= paywall_position are locked.
        paywall_locked = (
            course.paywall_enabled
            and paywall_position is not None
            and idx >= paywall_position
        )

        # Drip: unlock based on release_at or drip_days since enrollment.
        drip_locked = False
        locked_until = None
        if not paywall_locked:
            if m.release_at and now < m.release_at:
                drip_locked = True
                locked_until = m.release_at.isoformat()
            elif m.drip_days is not None:
                unlock_at = enrolled_at + timedelta(days=m.drip_days)
                if now < unlock_at:
                    drip_locked = True
                    locked_until = unlock_at.isoformat()

        locked = paywall_locked or drip_locked

        # Only published lessons are visible to students.
        published_lessons = [lesson for lesson in m.lessons if lesson.published]

        if not locked:
            visible = published_lessons
        else:
            # Locked module: surface free-preview lessons only.
            visible = [lesson for lesson in published_lessons if lesson.is_free_preview]

        lessons = [_serialize_lesson(lesson, completed_ids) for lesson in visible]
        for lesson in visible:
            accessible_ids.add(str(lesson.id))

        modules.append(
            {
                "id": str(m.id),
                "title": m.title,
                "description": m.description,
                "position": m.position,
                "locked": locked,
                "locked_until": locked_until,
                "lessons": lessons,
            }
        )
    return modules, accessible_ids


def _build_flat_lesson_list(course, paywall_position, enrolled_at, now, completed_ids):
    """Build flat lesson list with paywall/drip locks and only published lessons.

    Returns (lessons, accessible_lesson_ids) where accessible_lesson_ids is the
    set of lesson IDs included in the response (used as the progress denominator).
    """
    flat_lessons = []
    accessible_ids: set[str] = set()

    # Flatten all lessons from all modules into one ordered list
    all_lessons = []
    for module in course.modules:
        all_lessons.extend(module.lessons)
    all_lessons.sort(key=lambda l: l.position)

    for lesson in all_lessons:
        # Only published lessons are visible
        if not lesson.published:
            continue

        # Calculate accessibility
        is_accessible, locked_until = course_service.calculate_lesson_accessibility(
            lesson, paywall_position, enrolled_at, now
        )

        locked = not is_accessible
        locked_until_str = locked_until.isoformat() if locked_until else None

        lesson_data = _serialize_lesson(lesson, completed_ids)
        lesson_data["locked"] = locked
        lesson_data["locked_until"] = locked_until_str
        lesson_data["description"] = lesson.description

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
    result = []
    for enrollment in enrollments:
        course = enrollment.course
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
                },
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
            "course_type": course.course_type,
            "paywall_enabled": course.paywall_enabled,
            "paywall_position": course.paywall_position,
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
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(status_code=404, detail="Course not found or not enrolled")

    # Verify the lesson is published and belongs to this course before recording progress.
    lesson_repo = CourseLessonRepository.from_session(session)
    lesson = await lesson_repo.get_by_id(lesson_id)
    if lesson is None or not lesson.published:
        raise HTTPException(status_code=404, detail="Lesson not found")

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
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get course landing page data with public lesson list.

    This endpoint is used for both authenticated and unauthenticated users.
    For enrolled users, includes all lessons (with gating status).
    For non-enrolled users, includes only free preview lessons.
    """
    customer_id = get_customer_id(auth_subject)
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
        # Not enrolled: show only free preview lessons
        flat_lessons = []
        for module in course.modules:
            for lesson in module.lessons:
                if lesson.published and lesson.is_free_preview:
                    lesson_data = _serialize_lesson(lesson, set())
                    lesson_data["locked"] = False
                    lesson_data["locked_until"] = None
                    lesson_data["description"] = lesson.description
                    flat_lessons.append(lesson_data)
        flat_lessons.sort(key=lambda l: l["position"])
        has_access = False

    # Calculate total duration
    total_duration = sum(l.get("duration_seconds") or 0 for l in flat_lessons)

    return {
        "id": str(course.id),
        "title": course.title,
        "description": course.description,
        "thumbnail_url": course.thumbnail_url,
        "course_type": course.course_type,
        "lesson_count": len(flat_lessons),
        "total_duration_seconds": total_duration,
        "lessons": flat_lessons,
        "has_access": has_access,
    }


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


async def _load_authors(
    session: AsyncSession, enrollment_ids: set[UUID]
) -> dict[UUID, LessonCommentAuthor]:
    if not enrollment_ids:
        return {}
    stmt = select(CourseEnrollment.id, Customer.name).join(
        Customer, Customer.id == CourseEnrollment.customer_id
    ).where(CourseEnrollment.id.in_(enrollment_ids))
    result = await session.execute(stmt)
    return {
        row.id: LessonCommentAuthor(enrollment_id=row.id, name=row.name)
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
    enrollment, _ = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
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
            content=c.content,
            created_at=c.created_at,
            is_own=c.enrollment_id == enrollment.id,
            author=authors.get(
                c.enrollment_id,
                LessonCommentAuthor(enrollment_id=c.enrollment_id, name=None),
            ),
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
    enrollment, _ = await _verify_lesson_in_enrolled_course(
        session, customer_id, course_id, lesson_id
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
