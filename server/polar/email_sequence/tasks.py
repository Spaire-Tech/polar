from datetime import timedelta
from uuid import UUID

import structlog

from polar.config import settings
from polar.email.react import render_email_template
from polar.email.schemas import MarketingEmail, MarketingEmailProps
from polar.email.sender import email_sender
from polar.kit.utils import utc_now
from polar.models.email_sequence import EmailSequenceStatus
from polar.models.email_sequence_enrollment import (
    EmailSequenceEnrollment,
    EmailSequenceEnrollmentStatus,
)
from polar.models.email_sequence_step_send import EmailSequenceStepSend, EmailSequenceStepSendStatus
from polar.models.email_subscriber import EmailSubscriber, EmailSubscriberStatus
from polar.models.organization import Organization
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor, enqueue_job

log = structlog.get_logger()


@actor(actor_name="email_sequence.enroll_subscriber", priority=TaskPriority.MEDIUM)
async def enroll_subscriber(sequence_id: UUID, subscriber_id: UUID) -> None:
    """Create an enrollment for a subscriber in a sequence."""
    from .service import AlreadyEnrolled, email_sequence as sequence_service
    from polar.models.email_sequence import EmailSequence

    async with AsyncSessionMaker() as session:
        sequence = await session.get(EmailSequence, sequence_id)
        if sequence is None or sequence.status != EmailSequenceStatus.active:
            return

        subscriber = await session.get(EmailSubscriber, subscriber_id)
        if subscriber is None or subscriber.status != EmailSubscriberStatus.active:
            return

        try:
            await sequence_service.enroll(session, sequence, subscriber_id)
        except AlreadyEnrolled:
            log.debug(
                "email_sequence.already_enrolled",
                sequence_id=str(sequence_id),
                subscriber_id=str(subscriber_id),
            )


@actor(
    actor_name="email_sequence.process_due",
    cron_trigger=CronTrigger(minute="*/5"),
    priority=TaskPriority.MEDIUM,
)
async def process_due_enrollments() -> None:
    """Advance all enrollments whose next_step_at has passed."""
    from .repository import EmailSequenceRepository

    async with AsyncSessionMaker() as session:
        repository = EmailSequenceRepository.from_session(session)
        due = await repository.list_due_enrollments(utc_now())

    for enrollment in due:
        enqueue_job(
            "email_sequence.send_step",
            enrollment_id=enrollment.id,
        )


@actor(actor_name="email_sequence.send_step", priority=TaskPriority.MEDIUM)
async def send_sequence_step(enrollment_id: UUID) -> None:
    """Send the current step for an enrollment and advance it."""
    from .repository import EmailSequenceRepository

    async with AsyncSessionMaker() as session:
        repository = EmailSequenceRepository.from_session(session)

        enrollment = await session.get(EmailSequenceEnrollment, enrollment_id)
        if enrollment is None or enrollment.status != EmailSequenceEnrollmentStatus.active:
            return

        # Re-check next_step_at to avoid double-send on rapid retries
        if enrollment.next_step_at is None or enrollment.next_step_at > utc_now():
            return

        step = await repository.get_step_by_position(
            enrollment.sequence_id, enrollment.current_step_position
        )
        if step is None:
            # No more steps — sequence complete
            enrollment.status = EmailSequenceEnrollmentStatus.completed
            enrollment.completed_at = utc_now()
            enrollment.next_step_at = None
            return

        subscriber = await session.get(EmailSubscriber, enrollment.subscriber_id)
        if subscriber is None or subscriber.status != EmailSubscriberStatus.active:
            enrollment.status = EmailSequenceEnrollmentStatus.cancelled
            return

        from polar.models.email_sequence import EmailSequence

        sequence = await session.get(EmailSequence, enrollment.sequence_id)
        organization = await session.get(Organization, sequence.organization_id) if sequence else None

        unsubscribe_url = (
            f"{settings.FRONTEND_BASE_URL}/email/unsubscribe?sid={enrollment.subscriber_id}"
        )

        try:
            wrapped_html = render_email_template(
                MarketingEmail(
                    props=MarketingEmailProps(
                        organization_name=organization.name if organization else step.sender_name,
                        organization_logo_url=organization.avatar_url if organization else None,
                        organization_website=organization.website if organization else None,
                        html_content=step.content_html or "<p>No content</p>",
                        unsubscribe_url=unsubscribe_url,
                    )
                )
            )

            resend_email_id = await email_sender.send(
                to_email_addr=subscriber.email,
                subject=step.subject,
                html_content=wrapped_html,
                from_name=step.sender_name,
                from_email_addr=step.sender_email or f"noreply@notifications.spairehq.com",
                email_headers={
                    "List-Unsubscribe": f"<{unsubscribe_url}>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
                reply_to_name=step.sender_name if step.reply_to_email else None,
                reply_to_email_addr=step.reply_to_email,
            )

            step_send = EmailSequenceStepSend(
                enrollment_id=enrollment.id,
                step_id=step.id,
                subscriber_id=enrollment.subscriber_id,
                resend_email_id=resend_email_id,
                status=EmailSequenceStepSendStatus.sent,
                sent_at=utc_now(),
            )
            session.add(step_send)

        except Exception:
            log.exception(
                "email_sequence.send_step_failed",
                enrollment_id=str(enrollment_id),
                step_id=str(step.id),
            )
            step_send = EmailSequenceStepSend(
                enrollment_id=enrollment.id,
                step_id=step.id,
                subscriber_id=enrollment.subscriber_id,
                status=EmailSequenceStepSendStatus.failed,
            )
            session.add(step_send)
            return

        # Advance enrollment to next step
        next_position = enrollment.current_step_position + 1
        next_step = await repository.get_step_by_position(
            enrollment.sequence_id, next_position
        )

        if next_step is None:
            enrollment.status = EmailSequenceEnrollmentStatus.completed
            enrollment.completed_at = utc_now()
            enrollment.next_step_at = None
        else:
            enrollment.current_step_position = next_position
            enrollment.next_step_at = utc_now() + timedelta(hours=next_step.delay_hours)
