from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, HTTPException

from polar.course.schemas import CourseProgressRead
from polar.course.service import course_service
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..utils import get_customer_id

router = APIRouter(prefix="/courses", tags=["customer_portal_courses", APITag.public])


def _build_module_list(course, paywall_position, enrolled_at, now, completed_ids):
    modules = []
    for idx, m in enumerate(course.modules):
        # Paywall: modules at index >= paywall_position are locked (0-based idx, 1-based position)
        paywall_locked = (
            course.paywall_enabled
            and paywall_position is not None
            and idx >= paywall_position
        )

        # Drip: unlock based on release_at or drip_days since enrollment
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

        lessons = []
        if not locked:
            for l in m.lessons:
                lessons.append(
                    {
                        "id": str(l.id),
                        "title": l.title,
                        "content_type": l.content_type,
                        "content": l.content,
                        "position": l.position,
                        "duration_seconds": l.duration_seconds,
                        "is_free_preview": l.is_free_preview,
                        "mux_playback_id": getattr(l, "mux_playback_id", None),
                        "mux_status": getattr(l, "mux_status", None),
                        "completed": str(l.id) in completed_ids,
                    }
                )
        else:
            # For preview lessons, still surface them even past paywall
            for l in m.lessons:
                if l.is_free_preview:
                    lessons.append(
                        {
                            "id": str(l.id),
                            "title": l.title,
                            "content_type": l.content_type,
                            "content": l.content,
                            "position": l.position,
                            "duration_seconds": l.duration_seconds,
                            "is_free_preview": True,
                            "mux_playback_id": getattr(l, "mux_playback_id", None),
                            "mux_status": getattr(l, "mux_status", None),
                            "completed": str(l.id) in completed_ids,
                        }
                    )

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
    return modules


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
        result.append(
            {
                "enrollment_id": str(enrollment.id),
                "enrolled_at": enrollment.enrolled_at.isoformat(),
                "course": {
                    "id": str(course.id),
                    "title": course.title,
                    "course_type": course.course_type,
                    "module_count": len(course.modules),
                    "lesson_count": sum(len(m.lessons) for m in course.modules),
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
    now = datetime.now(tz=timezone.utc)
    enrolled_at = enrollment.enrolled_at

    modules = _build_module_list(
        course, course.paywall_position, enrolled_at, now, completed_ids
    )

    total_lessons = sum(len(m.lessons) for m in course.modules)
    completed_count = len(completed_ids)

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
    total = sum(len(m.lessons) for m in course.modules)
    completed = len(progress_items)

    return CourseProgressRead(
        total_lessons=total,
        completed_lessons=completed,
        completion_percent=round(completed / total * 100, 1) if total else 0.0,
        completed={
            str(p.lesson_id): p.completed_at.isoformat() for p in progress_items
        },
    )
