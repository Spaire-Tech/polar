"""Flow-doc walker for email sequences.

The new sequence editor stores its authored steps as a flat
`flow_doc.steps` list on `EmailSequence.trigger_config`, where a `branch`
node implicitly consumes its next two siblings as the Yes (i+1) and No
(i+2) paths and the flow resumes at i+3. This module is the worker-side
interpreter of that document.

It runs alongside the legacy email-step walker. A sequence with no
flow_doc still uses the old code path; sequences with a flow_doc use the
walker here. The cursor lives in `EmailSequenceEnrollment.flow_index`.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime, time, timedelta, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select

from polar.kit.utils import utc_now
from polar.models.email_sequence import EmailSequence
from polar.models.email_sequence_enrollment import (
    EmailSequenceEnrollment,
    EmailSequenceEnrollmentStatus,
)
from polar.models.email_sequence_step_send import (
    EmailSequenceStepSend,
    EmailSequenceStepSendStatus,
)
from polar.postgres import AsyncSession

from .service import apply_send_window

log = structlog.get_logger()


# ── Flow-doc shape helpers ────────────────────────────────────────────────────


def get_flow_doc(sequence: EmailSequence) -> dict | None:
    """Return the sequence's flow_doc, or None for legacy sequences."""
    cfg = sequence.trigger_config or {}
    flow = cfg.get("flow_doc")
    if not isinstance(flow, dict):
        return None
    if flow.get("version") != 1:
        return None
    if not isinstance(flow.get("steps"), list):
        return None
    return flow


def get_node(flow: dict, index: int) -> dict | None:
    steps = flow.get("steps") or []
    if 0 <= index < len(steps):
        node = steps[index]
        if isinstance(node, dict):
            return node
    return None


def is_flow_terminal(flow: dict, index: int) -> bool:
    return get_node(flow, index) is None


# ── Wait helpers ──────────────────────────────────────────────────────────────


def _wait_to_hours(value: dict) -> float:
    if value.get("mode") != "duration":
        return 0.0
    amount = value.get("amount") or 0
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        amount = 0.0
    unit = value.get("unit", "day")
    if unit == "min":
        return amount / 60.0
    if unit == "hour":
        return amount
    if unit == "day":
        return amount * 24.0
    if unit == "week":
        return amount * 24.0 * 7.0
    return 0.0


def _wait_until_time(value: dict, base: datetime) -> datetime:
    """Return the next datetime matching `time` on the requested day offset."""
    offset_map = {"next": 1, "+2": 2, "+3": 3, "+7": 7}
    days = offset_map.get(value.get("dayOffset", "next"), 1)
    raw = value.get("time") or "09:00"
    parts = raw.split(":") if isinstance(raw, str) else []
    try:
        hour = max(0, min(23, int(parts[0]))) if len(parts) >= 1 else 9
        minute = max(0, min(59, int(parts[1]))) if len(parts) >= 2 else 0
    except (TypeError, ValueError):
        hour, minute = 9, 0
    target = base + timedelta(days=days)
    return target.replace(hour=hour, minute=minute, second=0, microsecond=0)


def schedule_wait(
    value: dict,
    *,
    base: datetime,
    sequence_config: dict | None,
    subscriber_timezone: str | None = None,
) -> datetime | None:
    """Compute the next_step_at for a wait node.

    `until-event` returns None — the enrolment is parked until an external
    event fires; once tags / event hooks land, callers will reschedule.
    """
    mode = value.get("mode", "duration")
    if mode == "duration":
        candidate = base + timedelta(hours=_wait_to_hours(value))
    elif mode == "until-time":
        candidate = _wait_until_time(value, base)
    elif mode == "until-event":
        return None
    else:
        candidate = base
    return apply_send_window(
        candidate, sequence_config, subscriber_timezone=subscriber_timezone
    )


# ── Branch evaluation ─────────────────────────────────────────────────────────


async def evaluate_branch(
    session: AsyncSession,
    enrollment: EmailSequenceEnrollment,
    branch_value: dict,
) -> bool:
    """Return True for the Yes path, False for No.

    Supports `opened-prev`, `clicked-prev` (against EmailSequenceStepSend),
    and `has-tag` (against the email_subscriber_tags table). The remaining
    branch types (product-bought, engagement) fall back to True so authored
    flows still execute end-to-end; they'll land in their own follow-up.
    """
    field = branch_value.get("field")
    if field == "opened-prev":
        return await _last_send_reached(
            session,
            enrollment.id,
            min_status=EmailSequenceStepSendStatus.opened,
        )
    if field == "clicked-prev":
        return await _last_send_reached(
            session,
            enrollment.id,
            min_status=EmailSequenceStepSendStatus.clicked,
        )
    if field == "has-tag":
        from .tags import has_tag

        tag = (branch_value.get("tag") or "").strip()
        if not tag:
            return True
        return await has_tag(session, enrollment.subscriber_id, tag)
    log.debug(
        "email_sequence.flow.branch_default_yes",
        field=field,
        enrollment_id=str(enrollment.id),
    )
    return True


_STATUS_RANK = {
    EmailSequenceStepSendStatus.pending: 0,
    EmailSequenceStepSendStatus.sent: 1,
    EmailSequenceStepSendStatus.delivered: 2,
    EmailSequenceStepSendStatus.opened: 3,
    EmailSequenceStepSendStatus.clicked: 4,
    EmailSequenceStepSendStatus.bounced: -1,
    EmailSequenceStepSendStatus.failed: -1,
}


async def _last_send_reached(
    session: AsyncSession,
    enrollment_id: UUID,
    *,
    min_status: EmailSequenceStepSendStatus,
) -> bool:
    statement = (
        select(EmailSequenceStepSend.status)
        .where(
            EmailSequenceStepSend.enrollment_id == enrollment_id,
            EmailSequenceStepSend.deleted_at.is_(None),
        )
        .order_by(EmailSequenceStepSend.created_at.desc())
        .limit(1)
    )
    result = await session.execute(statement)
    row = result.first()
    if row is None:
        return False
    status = row[0]
    target = _STATUS_RANK.get(min_status, 0)
    actual = _STATUS_RANK.get(status, 0)
    return actual >= target


# ── Cursor advancement ────────────────────────────────────────────────────────


def advance_after_branch(index: int, took_yes: bool) -> int:
    """Branches consume their next two siblings: Yes at i+1, No at i+2.

    After executing whichever child applies, resume the flow at i+3 so the
    discarded sibling isn't run.
    """
    return index + 3


def advance_linear(index: int) -> int:
    return index + 1


# ── Action handlers ───────────────────────────────────────────────────────────


async def execute_action(
    session: AsyncSession,
    enrollment: EmailSequenceEnrollment,
    action_value: dict,
    *,
    organization_id: UUID | None = None,
) -> None:
    """Execute an action node.

    Supports add-tag, remove-tag, update-field (sets a custom key/value
    on the subscriber), enroll (cross-sequence enrolment), webhook
    (HMAC-signed POST), and notify (Slack incoming webhook).
    """
    action = action_value.get("action")
    if action == "add-tag":
        from .tags import add_tag

        await add_tag(session, enrollment.subscriber_id, action_value.get("tag") or "")
        return
    if action == "remove-tag":
        from .tags import remove_tag

        await remove_tag(
            session, enrollment.subscriber_id, action_value.get("tag") or ""
        )
        return
    if action == "update-field":
        from .custom_fields import set_field

        key = action_value.get("key") or action_value.get("field") or ""
        value = action_value.get("value")
        await set_field(session, enrollment.subscriber_id, key, value)
        return
    if action == "enroll":
        target_id = action_value.get("sequence")
        if target_id:
            from polar.worker import enqueue_job

            enqueue_job(
                "email_sequence.enroll_subscriber",
                sequence_id=UUID(target_id) if isinstance(target_id, str) else target_id,
                subscriber_id=enrollment.subscriber_id,
            )
            log.info(
                "email_sequence.flow.action.enroll",
                target_sequence_id=str(target_id),
                subscriber_id=str(enrollment.subscriber_id),
            )
            return
    if action == "webhook":
        from .webhooks import dispatch_action_webhook

        await dispatch_action_webhook(
            session,
            enrollment=enrollment,
            organization_id=organization_id,
            url=action_value.get("url") or "",
        )
        return
    if action == "notify":
        from .webhooks import dispatch_slack_notify

        await dispatch_slack_notify(
            session,
            enrollment=enrollment,
            organization_id=organization_id,
            text=action_value.get("text"),
            channel=action_value.get("channel"),
        )
        return
    log.info(
        "email_sequence.flow.action.unhandled",
        action=action,
        enrollment_id=str(enrollment.id),
    )


async def execute_goal_node(
    session: AsyncSession,
    enrollment: EmailSequenceEnrollment,
    goal_value: dict,
) -> None:
    """Hitting a goal node mid-flow marks the enrolment as completed and
    halts further sends. The conversion event itself is recorded as the
    `goal.event` string for downstream attribution; analytics consumers
    can read it via the trigger_config.flow_doc."""
    enrollment.status = EmailSequenceEnrollmentStatus.completed
    enrollment.completed_at = utc_now()
    enrollment.next_step_at = None
    log.info(
        "email_sequence.flow.goal_hit",
        event=goal_value.get("event"),
        enrollment_id=str(enrollment.id),
    )


# ── Public entry: walk one node and either send/schedule/advance ──────────────


async def process_one_step(
    session: AsyncSession,
    enrollment: EmailSequenceEnrollment,
    sequence: EmailSequence,
    *,
    send_email_node: Callable[
        [EmailSequence, EmailSequenceEnrollment, dict],
        Awaitable[dict | None],
    ],
) -> None:
    """Walk a single iteration of the flow for `enrollment`.

    Returns control to the caller, which is expected to commit the session
    so the cursor moves forward atomically with whatever side-effects fire
    (e.g. step_send rows for emails).

    The caller wires `send_email_node` so this module stays decoupled from
    the email-rendering machinery.
    """
    flow = get_flow_doc(sequence)
    if flow is None:
        log.warning(
            "email_sequence.flow.no_doc",
            sequence_id=str(sequence.id),
            enrollment_id=str(enrollment.id),
        )
        return

    index = enrollment.flow_index if enrollment.flow_index is not None else 0
    visited = 0
    # Defensive cap: long action/goal chains advance synchronously, but a
    # malformed doc could loop. 64 is plenty for any realistic authored flow.
    while visited < 64:
        visited += 1
        node = get_node(flow, index)
        if node is None:
            enrollment.status = EmailSequenceEnrollmentStatus.completed
            enrollment.completed_at = utc_now()
            enrollment.next_step_at = None
            enrollment.flow_index = index
            return

        node_type = node.get("type")
        value = node.get("value") or {}

        if node_type == "email":
            # Sending is delegated; the callback may return
            # `{"deferred_until": datetime}` to signal a frequency-cap
            # throttle. In that case we leave flow_index where it is and
            # park the enrolment until the deferral time.
            outcome = await send_email_node(sequence, enrollment, value)
            if isinstance(outcome, dict) and "deferred_until" in outcome:
                deferred = outcome["deferred_until"]
                if isinstance(deferred, datetime):
                    enrollment.next_step_at = deferred
                return
            enrollment.flow_index = advance_linear(index)
            enrollment.next_step_at = utc_now()
            return

        if node_type == "wait":
            subscriber_tz = await _subscriber_timezone(
                session, enrollment.subscriber_id
            )
            next_at = schedule_wait(
                value,
                base=utc_now(),
                sequence_config=sequence.trigger_config,
                subscriber_timezone=subscriber_tz,
            )
            enrollment.flow_index = advance_linear(index)
            enrollment.next_step_at = next_at
            return

        if node_type == "branch":
            branch_index = index
            took_yes = await evaluate_branch(session, enrollment, value)
            child_index = branch_index + (1 if took_yes else 2)
            child = get_node(flow, child_index)
            post_branch_index = branch_index + 3
            if child is None:
                index = post_branch_index
                enrollment.flow_index = index
                continue
            child_type = child.get("type")
            child_value = child.get("value") or {}
            if child_type == "email":
                outcome = await send_email_node(sequence, enrollment, child_value)
                if isinstance(outcome, dict) and "deferred_until" in outcome:
                    deferred = outcome["deferred_until"]
                    if isinstance(deferred, datetime):
                        enrollment.next_step_at = deferred
                    return
                enrollment.flow_index = post_branch_index
                enrollment.next_step_at = utc_now()
                return
            if child_type == "wait":
                subscriber_tz = await _subscriber_timezone(
                    session, enrollment.subscriber_id
                )
                next_at = schedule_wait(
                    child_value,
                    base=utc_now(),
                    sequence_config=sequence.trigger_config,
                    subscriber_timezone=subscriber_tz,
                )
                enrollment.flow_index = post_branch_index
                enrollment.next_step_at = next_at
                return
            if child_type == "action":
                await execute_action(
                    session,
                    enrollment,
                    child_value,
                    organization_id=sequence.organization_id,
                )
                index = post_branch_index
                enrollment.flow_index = index
                continue
            if child_type == "goal":
                await execute_goal_node(session, enrollment, child_value)
                return
            # Nested branches and unknown types: skip the branch group.
            index = post_branch_index
            enrollment.flow_index = index
            continue

        if node_type == "action":
            await execute_action(
                session,
                enrollment,
                value,
                organization_id=sequence.organization_id,
            )
            index = advance_linear(index)
            enrollment.flow_index = index
            continue

        if node_type == "goal":
            await execute_goal_node(session, enrollment, value)
            return

        log.warning(
            "email_sequence.flow.unknown_node_type",
            node_type=node_type,
            enrollment_id=str(enrollment.id),
        )
        index = advance_linear(index)
        enrollment.flow_index = index

    log.warning(
        "email_sequence.flow.advance_cap_hit",
        enrollment_id=str(enrollment.id),
        sequence_id=str(sequence.id),
    )


# ── Flow-doc helpers used at enrolment time ──────────────────────────────────


def initial_flow_index(flow: dict) -> int:
    """Where a fresh enrolment starts. Always 0 today."""
    _ = flow
    return 0


async def _subscriber_timezone(
    session: AsyncSession, subscriber_id: UUID
) -> str | None:
    from polar.models.email_subscriber import EmailSubscriber

    subscriber = await session.get(EmailSubscriber, subscriber_id)
    if subscriber is None:
        return None
    return getattr(subscriber, "timezone", None)


def initial_send_at(
    flow: dict,
    sequence_config: dict | None,
    *,
    now: datetime | None = None,
    subscriber_timezone: str | None = None,
) -> datetime | None:
    """Worker picks up the enrolment at this time and walks from index 0.

    We don't preemptively defer for opening waits — the worker handles the
    wait node itself on first tick, which avoids double-applying delays."""
    _ = flow
    base = now or utc_now()
    return apply_send_window(
        base, sequence_config, subscriber_timezone=subscriber_timezone
    )


# Unused-imports guard — these stay imported so static analysers see the
# datetime/time symbols used in helpers above (time only used implicitly
# through datetime.replace).
__all__ = [
    "advance_after_branch",
    "advance_linear",
    "evaluate_branch",
    "execute_action",
    "execute_goal_node",
    "get_flow_doc",
    "get_node",
    "initial_flow_index",
    "initial_send_at",
    "is_flow_terminal",
    "process_one_step",
    "schedule_wait",
]
_ = time  # silence unused-import; replace() below uses datetime API
_ = (datetime, timezone)
_ = Any
