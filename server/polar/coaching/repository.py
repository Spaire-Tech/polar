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
from polar.models.coaching_event import CoachingEvent
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
