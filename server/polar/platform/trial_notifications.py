"""Send creator-facing reminders before a Starter/Studio/Scale trial ends.

Three reminders per trial — at T-7, T-2, and T-0 days before
`trial_end`. Each one is sent at most once per (subscription, marker)
pair; we record the marker in the subscription's `user_metadata` to
keep the implementation table-less. The trial is card-required, so at
`trial_end` Stripe charges the card on file and the subscription
converts to `active` automatically (or to `past_due` -> dunning if the
charge fails). These reminders just warn the creator before that charge.

Runs as a daily cron actor (`platform.notify_trial_reminders`).
"""

import logging
from datetime import datetime, timedelta
from uuid import UUID

import structlog

from polar.email.sender import enqueue_email
from polar.entitlements.tiers import TierKey
from polar.kit.utils import utc_now
from polar.models import Organization, Subscription
from polar.organization.repository import OrganizationRepository
from polar.platform.repository import platform_subscription_repository
from polar.platform.service import platform as platform_service
from polar.postgres import AsyncSession

log: structlog.stdlib.BoundLogger = structlog.get_logger()
logging.getLogger(__name__)


# Markers stored on subscription.user_metadata["trial_reminders_sent"].
# Numbers are days-remaining-when-sent so the cron can decide which
# reminder is due based on (trial_end - now).days. Kept in ASCENDING order
# so _due_marker returns the most-urgent (smallest) threshold the trial has
# reached — iterating descending was the original bug that made every run
# resolve to 7, so the T-2 and T-0 reminders never fired.
_REMINDER_DAYS = (0, 2, 7)
_METADATA_KEY = "trial_reminders_sent"


def _days_remaining(trial_end: datetime, now: datetime) -> int:
    """Whole days between `now` and `trial_end`. Negative when expired."""
    delta = trial_end - now
    return delta.days


def _due_marker(days_remaining: int) -> int | None:
    """Map a days-remaining value to the reminder marker that should fire.

    Returns the smallest marker M such that ``days_remaining <= M`` — i.e.
    the most-urgent threshold the trial has already reached. Examples
    (markers 0, 2, 7):

      - days_remaining == 7  -> 7  (halfway reminder)
      - days_remaining == 5  -> 7  (still in the T-7 window)
      - days_remaining == 2  -> 2  (two days left)
      - days_remaining == 0  -> 0  (last day)
      - days_remaining == 9  -> None (T-7 not reached yet)

    Per-marker idempotency (``_already_sent``) prevents a delayed cron from
    re-firing a threshold it skipped past.
    """
    if days_remaining < 0:
        return None
    for marker in _REMINDER_DAYS:
        if days_remaining <= marker:
            return marker
    return None


def _already_sent(subscription: Subscription, marker: int) -> bool:
    metadata = subscription.user_metadata or {}
    sent = metadata.get(_METADATA_KEY)
    if not isinstance(sent, list):
        return False
    return marker in sent


def _mark_sent(subscription: Subscription, marker: int) -> None:
    metadata = dict(subscription.user_metadata or {})
    sent_raw = metadata.get(_METADATA_KEY)
    sent: list[int] = list(sent_raw) if isinstance(sent_raw, list) else []
    if marker not in sent:
        sent.append(marker)
    metadata[_METADATA_KEY] = sent
    subscription.user_metadata = metadata


def _tier_label(subscription: Subscription) -> str:
    if subscription.product is None:
        return "Spaire"
    tier_value = (subscription.product.user_metadata or {}).get("tier")
    if not isinstance(tier_value, str):
        return "Spaire"
    try:
        tier = TierKey(tier_value)
    except ValueError:
        return "Spaire"
    return f"Spaire {tier.value.capitalize()}"


def _render(
    organization: Organization,
    subscription: Subscription,
    marker: int,
) -> tuple[str, str]:
    tier_label = _tier_label(subscription)
    trial_end = subscription.trial_end

    when = trial_end.strftime("%A, %B %-d") if trial_end is not None else "soon"

    if marker == 7:
        subject = f"You're halfway through your {tier_label} trial"
        body = (
            f"Hi {organization.name},<br><br>"
            f"You've been on the {tier_label} trial for a week — another "
            f"week to go. When it ends on {when}, the card on file is "
            "charged and your plan continues automatically. If you'd rather "
            "not continue, you can cancel any time from "
            "<strong>Settings → Plan</strong>."
        )
    elif marker == 2:
        subject = f"Your {tier_label} trial ends in 2 days"
        body = (
            f"Hi {organization.name},<br><br>"
            f"Your {tier_label} trial ends on {when}, when the card on file "
            "is charged and your plan continues. Nothing to do to keep your "
            "access. If you don't want to continue, cancel before then from "
            "<strong>Settings → Plan</strong>."
        )
    else:  # marker == 0 — last day
        subject = f"Last day of your {tier_label} trial"
        body = (
            f"Hi {organization.name},<br><br>"
            f"This is the last day of your {tier_label} trial. The card on "
            "file will be charged and your plan continues. If you don't want "
            "to continue, cancel today from <strong>Settings → Plan</strong>."
        )

    html_content = (
        "<!DOCTYPE html>"
        "<html><body style=\"font-family:sans-serif;line-height:1.5;\">"
        f"<h2>{subject}</h2>"
        f"<p>{body}</p>"
        "<p>— Spaire</p>"
        "</body></html>"
    )
    return subject, html_content


def _resolve_creator_org_id(subscription: Subscription) -> UUID | None:
    customer = subscription.customer
    if customer is None:
        return None
    raw = (customer.user_metadata or {}).get("creator_org_id")
    if not isinstance(raw, str):
        return None
    try:
        return UUID(raw)
    except ValueError:
        return None


async def _notify(
    session: AsyncSession,
    subscription: Subscription,
    marker: int,
) -> bool:
    """Render + enqueue the reminder, then stamp the marker. Returns
    True if the email was actually enqueued (org/admin resolved)."""
    creator_org_id = _resolve_creator_org_id(subscription)
    if creator_org_id is None:
        log.warning(
            "platform.trial_reminder.missing_creator_org_id",
            subscription_id=str(subscription.id),
        )
        _mark_sent(subscription, marker)
        return False

    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_by_id(creator_org_id)
    if organization is None:
        log.warning(
            "platform.trial_reminder.org_missing",
            subscription_id=str(subscription.id),
            creator_org_id=str(creator_org_id),
        )
        _mark_sent(subscription, marker)
        return False

    admin_user = await organization_repository.get_admin_user(
        session, organization
    )
    if admin_user is None:
        log.info(
            "platform.trial_reminder.no_admin",
            subscription_id=str(subscription.id),
            creator_org_id=str(creator_org_id),
            marker=marker,
        )
        _mark_sent(subscription, marker)
        return False

    subject, html_content = _render(organization, subscription, marker)
    enqueue_email(
        to_email_addr=admin_user.email,
        subject=subject,
        html_content=html_content,
    )
    _mark_sent(subscription, marker)
    log.info(
        "platform.trial_reminder.sent",
        subscription_id=str(subscription.id),
        creator_org_id=str(creator_org_id),
        marker=marker,
    )
    return True


async def check_pending_trial_reminders(
    session: AsyncSession, *, now: datetime | None = None
) -> dict[str, int]:
    """Scan every trialing platform-org subscription and send the next
    due reminder (T-7 / T-2 / T-0). Idempotent — markers stamped on
    subscription.user_metadata prevent re-sending across cron runs.
    """
    counters = {"checked": 0, "sent": 0, "already_sent": 0, "not_due": 0}
    if not platform_service.is_configured():
        return counters

    platform_org_id = platform_service.get_id()
    current = now or utc_now()

    subscription_repo = platform_subscription_repository(session)
    # Reuse list_expired_trials with a far-future cutoff to get every
    # trialing platform sub — then filter to "not yet expired" inline.
    candidates = await subscription_repo.list_expired_trials(
        platform_org_id, before=current + timedelta(days=365)
    )

    for subscription in candidates:
        counters["checked"] += 1
        if subscription.trial_end is None or subscription.trial_end < current:
            # Already past trial_end — Stripe handles the charge/conversion;
            # there's nothing left to remind about.
            continue

        marker = _due_marker(_days_remaining(subscription.trial_end, current))
        if marker is None:
            counters["not_due"] += 1
            continue

        if _already_sent(subscription, marker):
            counters["already_sent"] += 1
            continue

        sent = await _notify(session, subscription, marker)
        if sent:
            counters["sent"] += 1

    await session.flush()
    return counters
