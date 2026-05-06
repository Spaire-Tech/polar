from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, select, update as sa_update

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models import UserOrganization
from polar.models.email_sequence import EmailSequence, EmailSequenceStatus, EmailSequenceTriggerType
from polar.models.email_sequence_enrollment import (
    EmailSequenceEnrollment,
    EmailSequenceEnrollmentStatus,
)
from polar.models.email_sequence_step import EmailSequenceStep
from polar.models.email_sequence_step_send import EmailSequenceStepSend


class EmailSequenceRepository(
    RepositorySoftDeletionMixin[EmailSequence],
    RepositoryBase[EmailSequence],
):
    model = EmailSequence

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[EmailSequence]]:
        statement = self.get_base_statement()
        if is_user(auth_subject):
            statement = statement.where(
                EmailSequence.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                EmailSequence.organization_id == auth_subject.subject.id
            )
        return statement

    async def get_active_for_org_by_trigger(
        self,
        organization_id: UUID,
        trigger_type: EmailSequenceTriggerType,
    ) -> list[EmailSequence]:
        statement = self.get_base_statement().where(
            EmailSequence.organization_id == organization_id,
            EmailSequence.status == EmailSequenceStatus.active,
            EmailSequence.trigger_type == trigger_type,
        )
        return list(await self.get_all(statement))

    async def get_enrollment(
        self,
        sequence_id: UUID,
        subscriber_id: UUID,
    ) -> EmailSequenceEnrollment | None:
        statement = (
            select(EmailSequenceEnrollment)
            .where(
                EmailSequenceEnrollment.sequence_id == sequence_id,
                EmailSequenceEnrollment.subscriber_id == subscriber_id,
                EmailSequenceEnrollment.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def list_enrollments(
        self,
        sequence_id: UUID,
    ) -> list[EmailSequenceEnrollment]:
        statement = (
            select(EmailSequenceEnrollment)
            .where(
                EmailSequenceEnrollment.sequence_id == sequence_id,
                EmailSequenceEnrollment.deleted_at.is_(None),
            )
            .order_by(EmailSequenceEnrollment.enrolled_at.desc())
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def list_due_enrollments(self, now: datetime) -> list[EmailSequenceEnrollment]:
        """All active enrollments where next_step_at has passed."""
        statement = (
            select(EmailSequenceEnrollment)
            .where(
                EmailSequenceEnrollment.status == EmailSequenceEnrollmentStatus.active,
                EmailSequenceEnrollment.next_step_at <= now,
                EmailSequenceEnrollment.next_step_at.isnot(None),
                EmailSequenceEnrollment.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def list_steps(self, sequence_id: UUID) -> list[EmailSequenceStep]:
        statement = (
            select(EmailSequenceStep)
            .where(
                EmailSequenceStep.sequence_id == sequence_id,
                EmailSequenceStep.deleted_at.is_(None),
            )
            .order_by(EmailSequenceStep.position.asc())
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_step(self, step_id: UUID) -> EmailSequenceStep | None:
        statement = select(EmailSequenceStep).where(
            EmailSequenceStep.id == step_id,
            EmailSequenceStep.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_step_by_position(
        self, sequence_id: UUID, position: int
    ) -> EmailSequenceStep | None:
        statement = (
            select(EmailSequenceStep)
            .where(
                EmailSequenceStep.sequence_id == sequence_id,
                EmailSequenceStep.position == position,
                EmailSequenceStep.deleted_at.is_(None),
            )
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def max_position(self, sequence_id: UUID) -> int:
        statement = select(
            func.coalesce(func.max(EmailSequenceStep.position), -1)
        ).where(
            EmailSequenceStep.sequence_id == sequence_id,
            EmailSequenceStep.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def reorder_steps(self, items: list[dict]) -> None:
        """Bulk update step positions. items: [{ "id": UUID, "position": int }]"""
        for item in items:
            await self.session.execute(
                sa_update(EmailSequenceStep)
                .where(EmailSequenceStep.id == item["id"])
                .values(position=item["position"])
            )
        await self.session.flush()

    async def get_analytics_counts(self, sequence_id: UUID) -> dict:
        statement = (
            select(
                EmailSequenceStepSend.status,
                func.count(EmailSequenceStepSend.id),
            )
            .join(
                EmailSequenceEnrollment,
                EmailSequenceStepSend.enrollment_id == EmailSequenceEnrollment.id,
            )
            .where(
                EmailSequenceEnrollment.sequence_id == sequence_id,
                EmailSequenceStepSend.deleted_at.is_(None),
            )
            .group_by(EmailSequenceStepSend.status)
        )
        result = await self.session.execute(statement)
        return {row[0]: row[1] for row in result.all()}

    async def get_step_analytics_counts(
        self, sequence_id: UUID
    ) -> dict[UUID, dict[str, int]]:
        """Per-step send counts grouped by status. Returned as
        {step_id: {status: count}} so callers can derive open/click rate."""
        statement = (
            select(
                EmailSequenceStepSend.step_id,
                EmailSequenceStepSend.status,
                func.count(EmailSequenceStepSend.id),
            )
            .join(
                EmailSequenceEnrollment,
                EmailSequenceStepSend.enrollment_id == EmailSequenceEnrollment.id,
            )
            .where(
                EmailSequenceEnrollment.sequence_id == sequence_id,
                EmailSequenceStepSend.deleted_at.is_(None),
            )
            .group_by(
                EmailSequenceStepSend.step_id,
                EmailSequenceStepSend.status,
            )
        )
        result = await self.session.execute(statement)
        bucket: dict[UUID, dict[str, int]] = {}
        for step_id, status, count in result.all():
            bucket.setdefault(step_id, {})[status] = count
        return bucket

    async def get_enrollment_counts(self, sequence_id: UUID) -> dict:
        statement = (
            select(
                EmailSequenceEnrollment.status,
                func.count(EmailSequenceEnrollment.id),
            )
            .where(
                EmailSequenceEnrollment.sequence_id == sequence_id,
                EmailSequenceEnrollment.deleted_at.is_(None),
            )
            .group_by(EmailSequenceEnrollment.status)
        )
        result = await self.session.execute(statement)
        return {row[0]: row[1] for row in result.all()}
