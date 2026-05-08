from datetime import timedelta
from uuid import UUID

import structlog

from polar.email.react import render_email_template
from polar.email.schemas import MarketingEmail, MarketingEmailProps
from polar.email.sender import email_sender
from polar.kit.utils import utc_now
from polar.models.email_sequence import EmailSequence, EmailSequenceStatus
from polar.models.email_sequence_enrollment import (
    EmailSequenceEnrollment,
    EmailSequenceEnrollmentStatus,
)
from polar.models.email_sequence_step import EmailSequenceStep
from polar.models.email_sequence_step_send import (
    EmailSequenceStepSend,
    EmailSequenceStepSendStatus,
)
from polar.models.email_subscriber import EmailSubscriber, EmailSubscriberStatus
from polar.models.organization import Organization
from polar.postgres import AsyncSession
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

log = structlog.get_logger()


@actor(actor_name="email_sequence.send_test_step", priority=TaskPriority.MEDIUM)
async def send_test_step(step_id: UUID, to_email: str) -> None:
    """Render and deliver a single test send of a sequence step.

    Wired from `EmailSequenceService.send_test_step`. Runs in the worker
    rather than on the API request thread (audit issue #50) so we don't
    block callers on the Resend roundtrip and gain retry-on-failure.
    """
    from polar.email_subscriber.unsubscribe_token import (
        build_test_unsubscribe_url,
    )

    async with AsyncSessionMaker() as session:
        step = await session.get(EmailSequenceStep, step_id)
        if step is None:
            return
        sequence = await session.get(EmailSequence, step.sequence_id)
        organization = (
            await session.get(Organization, sequence.organization_id)
            if sequence is not None
            else None
        )

        unsubscribe_url = build_test_unsubscribe_url()
        wrapped_html = render_email_template(
            MarketingEmail(
                props=MarketingEmailProps(
                    organization_name=(
                        organization.name if organization else step.sender_name
                    ),
                    organization_logo_url=(
                        organization.avatar_url if organization else None
                    ),
                    organization_website=(
                        organization.website if organization else None
                    ),
                    html_content=step.content_html or "<p>No content</p>",
                    unsubscribe_url=unsubscribe_url,
                )
            )
        )
        try:
            await email_sender.send(
                to_email_addr=to_email,
                subject=f"[TEST] {step.subject}",
                html_content=wrapped_html,
                from_name=step.sender_name,
                from_email_addr=step.sender_email
                or "noreply@notifications.spairehq.com",
                email_headers={
                    "List-Unsubscribe": f"<{unsubscribe_url}>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                },
                reply_to_name=step.sender_name if step.reply_to_email else None,
                reply_to_email_addr=step.reply_to_email,
            )
        except Exception:
            log.exception(
                "email_sequence.send_test_step_failed",
                step_id=str(step_id),
                to_email=to_email,
            )
            raise


@actor(actor_name="email_sequence.enroll_subscriber", priority=TaskPriority.MEDIUM)
async def enroll_subscriber(sequence_id: UUID, subscriber_id: UUID) -> None:
    """Create an enrollment for a subscriber in a sequence."""
    from .service import AlreadyEnrolled
    from .service import email_sequence as sequence_service

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
    """Advance an enrolment by one node.

    Sequences with an authored flow_doc are walked by the flow_engine
    (handles wait / branch / action / goal nodes too). Sequences without
    one fall through to the legacy email-step walker so existing data
    keeps working.
    """
    async with AsyncSessionMaker() as session:
        enrollment = await session.get(EmailSequenceEnrollment, enrollment_id)
        if enrollment is None or enrollment.status != EmailSequenceEnrollmentStatus.active:
            return

        # Re-check next_step_at to avoid double-send on rapid retries
        if enrollment.next_step_at is None or enrollment.next_step_at > utc_now():
            return

        sequence = await session.get(EmailSequence, enrollment.sequence_id)
        if sequence is None:
            return

        subscriber = await session.get(EmailSubscriber, enrollment.subscriber_id)
        if subscriber is None or subscriber.status != EmailSubscriberStatus.active:
            enrollment.status = EmailSequenceEnrollmentStatus.cancelled
            return

        from .flow_engine import get_flow_doc, process_one_step

        flow = get_flow_doc(sequence)
        if flow is not None:
            await _process_with_flow_engine(
                session,
                enrollment,
                sequence,
                subscriber,
                process_one_step=process_one_step,
            )
            return

        # — Legacy path: walk EmailSequenceStep rows in order —
        await _process_legacy(session, enrollment, sequence, subscriber)


async def _process_with_flow_engine(
    session: AsyncSession,
    enrollment: EmailSequenceEnrollment,
    sequence: EmailSequence,
    subscriber: EmailSubscriber,
    *,
    process_one_step,
) -> None:
    organization = await session.get(Organization, sequence.organization_id)

    async def _send(
        _seq: EmailSequence,
        enr: EmailSequenceEnrollment,
        value: dict,
    ) -> dict | None:
        return await _send_email_node(
            session,
            sequence=sequence,
            enrollment=enr,
            subscriber=subscriber,
            organization=organization,
            email_value=value,
        )

    await process_one_step(
        session,
        enrollment,
        sequence,
        send_email_node=_send,
    )


async def _process_legacy(
    session: AsyncSession,
    enrollment: EmailSequenceEnrollment,
    sequence: EmailSequence,
    subscriber: EmailSubscriber,
) -> None:
    from .repository import EmailSequenceRepository
    from .service import apply_send_window, check_frequency_cap

    repository = EmailSequenceRepository.from_session(session)

    step = await repository.get_step_by_position(
        enrollment.sequence_id, enrollment.current_step_position
    )
    if step is None:
        enrollment.status = EmailSequenceEnrollmentStatus.completed
        enrollment.completed_at = utc_now()
        enrollment.next_step_at = None
        return

    # Frequency-cap for the legacy walker: defer if the subscriber has hit
    # their workspace quota in the last 7 days. Because the legacy doc
    # doesn't carry a frequencyCap toggle we always honour the default cap.
    if not await check_frequency_cap(session, enrollment.subscriber_id):
        base = utc_now() + timedelta(hours=24)
        enrollment.next_step_at = apply_send_window(
            base,
            sequence.trigger_config,
            subscriber_timezone=subscriber.timezone,
        )
        log.info(
            "email_sequence.legacy.cap_deferred",
            enrollment_id=str(enrollment.id),
            deferred_until=enrollment.next_step_at.isoformat()
            if enrollment.next_step_at
            else None,
        )
        return

    organization = await session.get(Organization, sequence.organization_id)
    await _send_email_step(
        session,
        sequence=sequence,
        enrollment=enrollment,
        subscriber=subscriber,
        organization=organization,
        step=step,
    )

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
        candidate = utc_now() + timedelta(hours=next_step.delay_hours)
        enrollment.next_step_at = apply_send_window(
            candidate,
            sequence.trigger_config,
            subscriber_timezone=subscriber.timezone,
        )


# ── Email send helpers ────────────────────────────────────────────────────────


def _email_ordinal_for_flow_index(flow: dict, index: int) -> int:
    """Number of email nodes appearing at indices < `index`."""
    steps = flow.get("steps") or []
    count = 0
    for i in range(min(index, len(steps))):
        node = steps[i]
        if isinstance(node, dict) and node.get("type") == "email":
            count += 1
    return count


async def _send_email_node(
    session: AsyncSession,
    *,
    sequence: EmailSequence,
    enrollment: EmailSequenceEnrollment,
    subscriber: EmailSubscriber,
    organization: Organization | None,
    email_value: dict,
) -> dict | None:
    """Send an email node from the flow_doc.

    Looks up the corresponding EmailSequenceStep row by email-ordinal so
    analytics, send-test and step-send rows continue to tie back to the
    same step ids the editor already manages.

    Returns `{"deferred_until": datetime}` when the frequency cap throttles
    the send so the flow engine can park the enrolment without advancing
    flow_index. Returns None on a successful send.
    """
    from .flow_engine import get_flow_doc
    from .repository import EmailSequenceRepository
    from .service import apply_send_window, check_frequency_cap

    flow = get_flow_doc(sequence)
    send_cfg = (
        (flow or {}).get("send") if isinstance(flow, dict) else None
    ) or {}
    if send_cfg.get("frequencyCap"):
        if not await check_frequency_cap(session, enrollment.subscriber_id):
            # Defer to the next eligible window slot (or just 24h out if
            # no window is configured).
            base = utc_now() + timedelta(hours=24)
            deferred = apply_send_window(
                base,
                sequence.trigger_config,
                subscriber_timezone=subscriber.timezone,
            )
            log.info(
                "email_sequence.flow.cap_deferred",
                enrollment_id=str(enrollment.id),
                deferred_until=deferred.isoformat(),
            )
            return {"deferred_until": deferred}

    repository = EmailSequenceRepository.from_session(session)
    cursor = enrollment.flow_index if enrollment.flow_index is not None else 0
    ordinal = (
        _email_ordinal_for_flow_index(flow, cursor) if flow is not None else 0
    )
    step = await repository.get_step_by_position(sequence.id, ordinal)
    if step is None:
        # Materialized step row missing — synthesise a best-effort send from
        # the flow node so authors can still ship even if syncEmailSteps
        # hasn't run. step_id is required for step_send rows so we skip the
        # send analytics row in this case and just deliver the email.
        await _send_inline(
            sequence=sequence,
            enrollment=enrollment,
            subscriber=subscriber,
            organization=organization,
            subject=email_value.get("subject") or "(no subject)",
            sender_name=email_value.get("fromName") or (organization.name if organization else "Spaire"),
            sender_email=email_value.get("fromEmail"),
            content_html=email_value.get("content_html") or _fallback_html(email_value),
        )
        # Bump current_step_position so legacy analytics keep marching forward.
        enrollment.current_step_position = ordinal + 1
        return None

    await _send_email_step(
        session,
        sequence=sequence,
        enrollment=enrollment,
        subscriber=subscriber,
        organization=organization,
        step=step,
    )
    enrollment.current_step_position = ordinal + 1
    return None


async def _send_email_step(
    session: AsyncSession,
    *,
    sequence: EmailSequence,
    enrollment: EmailSequenceEnrollment,
    subscriber: EmailSubscriber,
    organization: Organization | None,
    step: EmailSequenceStep,
) -> None:
    from polar.email_subscriber.unsubscribe_token import build_unsubscribe_url

    unsubscribe_url = build_unsubscribe_url(enrollment.subscriber_id)
    try:
        wrapped_html = render_email_template(
            MarketingEmail(
                props=MarketingEmailProps(
                    organization_name=organization.name
                    if organization
                    else step.sender_name,
                    organization_logo_url=organization.avatar_url
                    if organization
                    else None,
                    organization_website=organization.website
                    if organization
                    else None,
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
            from_email_addr=step.sender_email
            or "noreply@notifications.spairehq.com",
            email_headers={
                "List-Unsubscribe": f"<{unsubscribe_url}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            reply_to_name=step.sender_name if step.reply_to_email else None,
            reply_to_email_addr=step.reply_to_email,
        )
        session.add(
            EmailSequenceStepSend(
                enrollment_id=enrollment.id,
                step_id=step.id,
                subscriber_id=enrollment.subscriber_id,
                resend_email_id=resend_email_id,
                status=EmailSequenceStepSendStatus.sent,
                sent_at=utc_now(),
            )
        )
    except Exception:
        log.exception(
            "email_sequence.send_step_failed",
            enrollment_id=str(enrollment.id),
            step_id=str(step.id),
        )
        session.add(
            EmailSequenceStepSend(
                enrollment_id=enrollment.id,
                step_id=step.id,
                subscriber_id=enrollment.subscriber_id,
                status=EmailSequenceStepSendStatus.failed,
            )
        )


async def _send_inline(
    *,
    sequence: EmailSequence,
    enrollment: EmailSequenceEnrollment,
    subscriber: EmailSubscriber,
    organization: Organization | None,
    subject: str,
    sender_name: str,
    sender_email: str | None,
    content_html: str,
) -> None:
    from polar.email_subscriber.unsubscribe_token import build_unsubscribe_url

    unsubscribe_url = build_unsubscribe_url(enrollment.subscriber_id)
    try:
        wrapped_html = render_email_template(
            MarketingEmail(
                props=MarketingEmailProps(
                    organization_name=organization.name if organization else sender_name,
                    organization_logo_url=organization.avatar_url
                    if organization
                    else None,
                    organization_website=organization.website
                    if organization
                    else None,
                    html_content=content_html,
                    unsubscribe_url=unsubscribe_url,
                )
            )
        )
        await email_sender.send(
            to_email_addr=subscriber.email,
            subject=subject,
            html_content=wrapped_html,
            from_name=sender_name,
            from_email_addr=sender_email or "noreply@notifications.spairehq.com",
            email_headers={
                "List-Unsubscribe": f"<{unsubscribe_url}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        )
    except Exception:
        log.exception(
            "email_sequence.send_flow_node_failed",
            enrollment_id=str(enrollment.id),
            sequence_id=str(sequence.id),
        )


def _fallback_html(email_value: dict) -> str:
    subject = (email_value.get("subject") or "").replace("<", "&lt;")
    preview = (email_value.get("preview") or "").replace("<", "&lt;")
    return f"<h2>{subject}</h2><p>{preview}</p>"
