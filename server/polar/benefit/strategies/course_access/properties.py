from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitCourseAccessProperties(BenefitProperties):
    course_id: str


class BenefitGrantCourseAccessProperties(BenefitGrantProperties):
    enrollment_id: str | None
