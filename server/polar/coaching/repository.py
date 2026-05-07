from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import UserOrganization
from polar.models.coaching_cohort import CoachingCohort
from polar.models.coaching_cohort_enrollment import CoachingCohortEnrollment
from polar.models.coaching_event import CoachingEvent
from polar.models.coaching_intake_form import CoachingIntakeForm
from polar.models.coaching_intake_response import CoachingIntakeResponse
from polar.models.coaching_post import CoachingPost
from polar.models.course import Course


class CoachingEventRepository(
    RepositorySoftDeletionIDMixin[CoachingEvent, UUID],
    RepositorySoftDeletionMixin[CoachingEvent],
    RepositoryBase[CoachingEvent],
):
    model = CoachingEvent

    def get_by_course_statement(
        self, course_id: UUID
    ) -> Select[tuple[CoachingEvent]]:
        return (
            self.get_base_statement()
            .where(CoachingEvent.course_id == course_id)
            .order_by(CoachingEvent.starts_at.asc())
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CoachingEvent]]:
        statement = self.get_base_statement().join(
            Course, Course.id == CoachingEvent.course_id
        )
        if is_user(auth_subject):
            statement = statement.where(
                Course.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Course.organization_id == auth_subject.subject.id
            )
        return statement

    async def get_readable_by_id(
        self,
        event_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> CoachingEvent | None:
        statement = self.get_readable_statement(auth_subject).where(
            CoachingEvent.id == event_id
        )
        return await self.get_one_or_none(statement)

    def get_pending_reminders_statement(
        self,
        *,
        threshold_24h_lower: datetime,
        threshold_24h_upper: datetime,
        threshold_1h_lower: datetime,
        threshold_1h_upper: datetime,
    ) -> Select[tuple[CoachingEvent]]:
        """Events whose start time falls inside one of the reminder windows
        and whose corresponding reminder flag is still null. The worker uses
        this to enqueue the email jobs."""
        return self.get_base_statement().where(
            CoachingEvent.status == "scheduled",
            (
                (
                    (CoachingEvent.reminder_24h_sent_at.is_(None))
                    & CoachingEvent.starts_at.between(
                        threshold_24h_lower, threshold_24h_upper
                    )
                )
                | (
                    (CoachingEvent.reminder_1h_sent_at.is_(None))
                    & CoachingEvent.starts_at.between(
                        threshold_1h_lower, threshold_1h_upper
                    )
                )
            ),
        )

    def get_by_recording_upload_id(
        self, upload_id: str
    ) -> Select[tuple[CoachingEvent]]:
        return self.get_base_statement().where(
            CoachingEvent.recording_mux_upload_id == upload_id
        )


class CoachingCohortRepository(
    RepositorySoftDeletionIDMixin[CoachingCohort, UUID],
    RepositorySoftDeletionMixin[CoachingCohort],
    RepositoryBase[CoachingCohort],
):
    model = CoachingCohort

    def get_by_course_statement(
        self, course_id: UUID
    ) -> Select[tuple[CoachingCohort]]:
        return (
            self.get_base_statement()
            .where(CoachingCohort.course_id == course_id)
            .order_by(
                CoachingCohort.is_default.desc(),
                CoachingCohort.created_at.asc(),
            )
        )

    def get_default_for_course_statement(
        self, course_id: UUID
    ) -> Select[tuple[CoachingCohort]]:
        return self.get_base_statement().where(
            CoachingCohort.course_id == course_id,
            CoachingCohort.is_default.is_(True),
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CoachingCohort]]:
        statement = self.get_base_statement().join(
            Course, Course.id == CoachingCohort.course_id
        )
        if is_user(auth_subject):
            statement = statement.where(
                Course.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Course.organization_id == auth_subject.subject.id
            )
        return statement

    async def get_readable_by_id(
        self,
        cohort_id: UUID,
        auth_subject: AuthSubject[User | Organization],
    ) -> CoachingCohort | None:
        statement = self.get_readable_statement(auth_subject).where(
            CoachingCohort.id == cohort_id
        )
        return await self.get_one_or_none(statement)


class CoachingCohortEnrollmentRepository(
    RepositorySoftDeletionIDMixin[CoachingCohortEnrollment, UUID],
    RepositorySoftDeletionMixin[CoachingCohortEnrollment],
    RepositoryBase[CoachingCohortEnrollment],
):
    model = CoachingCohortEnrollment

    def get_by_enrollment_statement(
        self, enrollment_id: UUID
    ) -> Select[tuple[CoachingCohortEnrollment]]:
        return self.get_base_statement().where(
            CoachingCohortEnrollment.enrollment_id == enrollment_id
        )

    def get_by_cohort_statement(
        self, cohort_id: UUID
    ) -> Select[tuple[CoachingCohortEnrollment]]:
        return self.get_base_statement().where(
            CoachingCohortEnrollment.cohort_id == cohort_id
        )


class CoachingIntakeFormRepository(
    RepositorySoftDeletionIDMixin[CoachingIntakeForm, UUID],
    RepositorySoftDeletionMixin[CoachingIntakeForm],
    RepositoryBase[CoachingIntakeForm],
):
    model = CoachingIntakeForm

    def get_by_course_statement(
        self, course_id: UUID
    ) -> Select[tuple[CoachingIntakeForm]]:
        return self.get_base_statement().where(
            CoachingIntakeForm.course_id == course_id
        )

    async def get_by_course(
        self, course_id: UUID
    ) -> CoachingIntakeForm | None:
        return await self.get_one_or_none(
            self.get_by_course_statement(course_id)
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CoachingIntakeForm]]:
        statement = self.get_base_statement().join(
            Course, Course.id == CoachingIntakeForm.course_id
        )
        if is_user(auth_subject):
            statement = statement.where(
                Course.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Course.organization_id == auth_subject.subject.id
            )
        return statement


class CoachingIntakeResponseRepository(
    RepositorySoftDeletionIDMixin[CoachingIntakeResponse, UUID],
    RepositorySoftDeletionMixin[CoachingIntakeResponse],
    RepositoryBase[CoachingIntakeResponse],
):
    model = CoachingIntakeResponse

    def get_by_form_statement(
        self, form_id: UUID
    ) -> Select[tuple[CoachingIntakeResponse]]:
        return (
            self.get_base_statement()
            .where(CoachingIntakeResponse.form_id == form_id)
            .order_by(CoachingIntakeResponse.submitted_at.desc())
        )

    def get_by_form_and_customer_statement(
        self, form_id: UUID, customer_id: UUID
    ) -> Select[tuple[CoachingIntakeResponse]]:
        return self.get_base_statement().where(
            CoachingIntakeResponse.form_id == form_id,
            CoachingIntakeResponse.customer_id == customer_id,
        )


class CoachingPostRepository(
    RepositorySoftDeletionIDMixin[CoachingPost, UUID],
    RepositorySoftDeletionMixin[CoachingPost],
    RepositoryBase[CoachingPost],
):
    model = CoachingPost

    def get_top_level_for_course_statement(
        self, course_id: UUID, *, include_hidden: bool = False
    ) -> Select[tuple[CoachingPost]]:
        statement = self.get_base_statement().where(
            CoachingPost.course_id == course_id,
            CoachingPost.parent_id.is_(None),
        )
        if not include_hidden:
            statement = statement.where(CoachingPost.hidden.is_(False))
        # Pinned threads first, then newest-first.
        return statement.order_by(
            CoachingPost.pinned.desc(),
            CoachingPost.created_at.desc(),
        )

    def get_replies_for_parents_statement(
        self, parent_ids: list[UUID], *, include_hidden: bool = False
    ) -> Select[tuple[CoachingPost]]:
        statement = self.get_base_statement().where(
            CoachingPost.parent_id.in_(parent_ids),
        )
        if not include_hidden:
            statement = statement.where(CoachingPost.hidden.is_(False))
        return statement.order_by(CoachingPost.created_at.asc())

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CoachingPost]]:
        statement = self.get_base_statement().join(
            Course, Course.id == CoachingPost.course_id
        )
        if is_user(auth_subject):
            statement = statement.where(
                Course.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Course.organization_id == auth_subject.subject.id
            )
        return statement
