"""Customer-portal endpoint for cohort broadcasts.

Student-side surface for Phase 3 — read-only feed of published
broadcasts for an enrolled course. Drafts and soft-deleted rows are
filtered out at the repository statement so the student never sees them.

Auth shape mirrors the rest of the customer portal: CustomerPortalUnionRead
+ enrollment guard. There is no public/non-enrolled preview of broadcasts —
the creator's cohort voice is enrollment-gated by design.
"""

from uuid import UUID

from fastapi import Depends, HTTPException

from polar.course.service import course_service
from polar.course_broadcast.repository import BroadcastRepository
from polar.course_broadcast.schemas import BroadcastStudentRead
from polar.models.course_broadcast import CourseBroadcast
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..utils import get_customer_id

router = APIRouter(
    prefix="/courses",
    tags=["customer_portal_courses", APITag.public],
)


def _to_student_read(b: CourseBroadcast) -> BroadcastStudentRead:
    # `published_at` is guaranteed non-NULL here because the repository
    # statement filters on `published_at IS NOT NULL`. Type-safe cast
    # because BroadcastStudentRead declares it non-optional.
    assert b.published_at is not None
    return BroadcastStudentRead(
        id=b.id,
        title=b.title,
        body=b.body,
        image_url=b.image_url,
        week_number=b.week_number,
        published_at=b.published_at,
    )


@router.get(
    "/{course_id}/broadcasts",
    response_model=list[BroadcastStudentRead],
    summary="List Course Broadcasts (enrolled student)",
)
async def list_enrolled_broadcasts(
    course_id: UUID,
    auth_subject: auth.CustomerPortalUnionRead,
    session: AsyncSession = Depends(get_db_session),
) -> list[BroadcastStudentRead]:
    customer_id = get_customer_id(auth_subject)
    enrollment = await course_service.get_enrollment_for_customer(
        session, customer_id, course_id
    )
    if enrollment is None:
        raise HTTPException(
            status_code=403, detail="Not enrolled in this course."
        )

    repo = BroadcastRepository.from_session(session)
    broadcasts = list(
        await repo.get_all(
            repo.get_by_course_statement(course_id, only_published=True)
        )
    )
    return [_to_student_read(b) for b in broadcasts]
