from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, HTTPException

from polar.course.repository import CourseLessonRepository
from polar.course.schemas import CourseProgressRead
from polar.course.service import course_service
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

    modules, accessible_ids = _build_module_list(
        course, course.paywall_position, enrolled_at, now, completed_ids
    )

    # Progress only counts lessons the student can actually access.
    total_lessons = len(accessible_ids)
    completed_count = len(completed_ids & accessible_ids)

    return {
        "enrollment_id": str(enrollment.id),
        "enrolled_at": enrolled_at.isoformat(),
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
            "course_type": course.course_type,
            "paywall_enabled": course.paywall_enabled,
            "paywall_position": course.paywall_position,
            "modules": modules,
        },
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

    # Use the same accessible-set logic so progress matches the lesson list.
    _, accessible_ids = _build_module_list(
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
