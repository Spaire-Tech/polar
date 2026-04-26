from typing import Any, cast
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.models import Benefit, Customer, Member, Organization, User

from ..base.service import BenefitServiceProtocol
from .properties import BenefitCourseAccessProperties, BenefitGrantCourseAccessProperties


class BenefitCourseAccessService(
    BenefitServiceProtocol[
        BenefitCourseAccessProperties, BenefitGrantCourseAccessProperties
    ]
):
    async def grant(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantCourseAccessProperties,
        *,
        update: bool = False,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantCourseAccessProperties:
        from polar.course.service import course_service

        properties = self._get_properties(benefit)
        course_id = UUID(properties["course_id"])

        if update and grant_properties.get("enrollment_id"):
            return grant_properties

        enrollment = await course_service.enroll_customer(
            self.session,
            course_id=course_id,
            customer=customer,
        )
        return {"enrollment_id": str(enrollment.id)}

    async def cycle(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantCourseAccessProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantCourseAccessProperties:
        return grant_properties

    async def revoke(
        self,
        benefit: Benefit,
        customer: Customer,
        grant_properties: BenefitGrantCourseAccessProperties,
        *,
        attempt: int = 1,
        member: Member | None = None,
    ) -> BenefitGrantCourseAccessProperties:
        from polar.course.service import course_service

        enrollment_id_str = grant_properties.get("enrollment_id")
        if enrollment_id_str:
            await course_service.revoke_enrollment(
                self.session, UUID(enrollment_id_str)
            )
        return {}

    async def requires_update(
        self,
        benefit: Benefit,
        previous_properties: BenefitCourseAccessProperties,
    ) -> bool:
        properties = self._get_properties(benefit)
        return properties.get("course_id") != previous_properties.get("course_id")

    async def validate_properties(
        self,
        auth_subject: AuthSubject[User | Organization],
        properties: dict[str, Any],
    ) -> BenefitCourseAccessProperties:
        return cast(BenefitCourseAccessProperties, properties)
