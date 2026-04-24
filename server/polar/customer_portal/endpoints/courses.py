from uuid import UUID

from fastapi import Depends, HTTPException

from polar.course.service import course_service
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..utils import get_customer_id

router = APIRouter(prefix="/courses", tags=["customer_portal_courses", APITag.public])


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

    course = enrollment.course
    return {
        "enrollment_id": str(enrollment.id),
        "enrolled_at": enrollment.enrolled_at.isoformat(),
        "course": {
            "id": str(course.id),
            "title": course.title,
            "course_type": course.course_type,
            "paywall_enabled": course.paywall_enabled,
            "paywall_lesson_id": (
                str(course.paywall_lesson_id) if course.paywall_lesson_id else None
            ),
            "modules": [
                {
                    "id": str(m.id),
                    "title": m.title,
                    "description": m.description,
                    "position": m.position,
                    "lessons": [
                        {
                            "id": str(l.id),
                            "title": l.title,
                            "content_type": l.content_type,
                            "content": l.content,
                            "position": l.position,
                            "duration_seconds": l.duration_seconds,
                            "is_free_preview": l.is_free_preview,
                        }
                        for l in m.lessons
                    ],
                }
                for m in course.modules
            ],
        },
    }
