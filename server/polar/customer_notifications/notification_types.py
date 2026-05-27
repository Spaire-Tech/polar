"""Customer-portal notification type registry.

Each `NotificationType.render(...)` returns (subject, html_body) for the
email channel. The same payload is also stored on the customer_notifications
row so the bell dropdown can render a richer in-portal card from it.

v1 keeps this simple — string keys + Pydantic payload classes + a render
function. If the catalog grows, swap in a discriminated-union registry
like server/polar/notifications/notification.py does for org-side."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

# ----------------------------------------------------------------------
# Type identifiers — string column on customer_notifications.type
# ----------------------------------------------------------------------

EVENT_PUBLISHED = "community.event.published"
EVENT_RSVP_CONFIRMED = "community.event.rsvp_confirmed"
EVENT_STARTING_SOON_24H = "community.event.starting_soon_24h"
EVENT_STARTING_SOON_15M = "community.event.starting_soon_15m"
EVENT_LIVE = "community.event.live"
EVENT_REPLAY_NAG_T2H = "community.event.replay_nag_t2h"
EVENT_REPLAY_NAG_T24H = "community.event.replay_nag_t24h"

ACTIVITY_PUBLISHED = "community.activity.published"
ACTIVITY_SUBMISSION_RECEIVED = "community.activity.submission_received"

ALL_TYPES = (
    EVENT_PUBLISHED,
    EVENT_RSVP_CONFIRMED,
    EVENT_STARTING_SOON_24H,
    EVENT_STARTING_SOON_15M,
    EVENT_LIVE,
    EVENT_REPLAY_NAG_T2H,
    EVENT_REPLAY_NAG_T24H,
    ACTIVITY_PUBLISHED,
    ACTIVITY_SUBMISSION_RECEIVED,
)

# Per-type channel policy. Notifications always create a bell row; this
# governs whether the same notification also sends an email.
#
# 15-minute reminders stay bell-only on purpose — by the time the email
# arrives in the inbox the window has often already started, and the
# notification arrives every event so the volume would be noisy.
#
# RSVP confirmations are intentionally NOT in this set even though they
# do send an email — the confirmation email carries an `.ics` attachment
# and so flows through a dedicated send path (community.events_tasks.
# rsvp_confirmed) rather than the generic customer_notification.send_email
# actor, which doesn't take attachments.
#
# REPLAY_NAG_* types stay defined above (so any in-flight queued jobs
# render rather than crash) but the cron that enqueued them is gone —
# see community/events_tasks.py. They never appear in EMAIL_TYPES now.
#
# Activity submission notifications go to the host only (bell, no email
# — high volume).
EMAIL_TYPES: frozenset[str] = frozenset(
    {
        EVENT_PUBLISHED,
        EVENT_STARTING_SOON_24H,
        EVENT_LIVE,
        ACTIVITY_PUBLISHED,
    }
)


# ----------------------------------------------------------------------
# Payloads
# ----------------------------------------------------------------------


class ActivityNotificationPayload(BaseModel):
    """Payload for community.activity.* notifications."""

    activity_id: str
    course_id: str
    title: str
    host_name: str
    course_name: str
    submission_type: str = "photo"
    channel_label: str | None = None
    # Set on submission_received so the host can see who just posted.
    submitter_name: str | None = None


class EventNotificationPayload(BaseModel):
    """Payload shared by every community.event.* notification — enough
    context for both the email body and the bell dropdown card."""

    event_id: str
    course_id: str
    title: str
    start_at: datetime
    host_name: str
    course_name: str
    meeting_url: str | None = None


# ----------------------------------------------------------------------
# Rendering
# ----------------------------------------------------------------------


def _fmt_when(dt: datetime) -> str:
    return dt.strftime("%a %b %-d at %H:%M UTC")


def render(notification_type: str, payload: dict[str, Any]) -> tuple[str, str]:
    """Return (subject, html_body) for the email channel.

    Falls back to a generic subject/body if the type isn't recognized —
    we never want a missing render to break the dramatiq actor."""
    # Activity-type renders first so the EventNotificationPayload parse
    # below doesn't reject activity payloads (different shape).
    if notification_type in (ACTIVITY_PUBLISHED, ACTIVITY_SUBMISSION_RECEIVED):
        try:
            ap = ActivityNotificationPayload.model_validate(payload)
        except Exception:
            return (
                "New activity in your community",
                "<p>You have a new community notification.</p>",
            )
        if notification_type == ACTIVITY_PUBLISHED:
            subject = f"New activity: {ap.title}"
            channel = f" — {ap.channel_label}" if ap.channel_label else ""
            body = (
                f"<p><strong>{ap.host_name}</strong> opened a new activity in "
                f"<em>{ap.course_name}</em>{channel}: "
                f"<strong>{ap.title}</strong>.</p>"
                f'<p><a href="#">Open in portal</a></p>'
            )
            return subject, body
        # submission_received
        subject = f"New submission to {ap.title}"
        who = ap.submitter_name or "Someone"
        body = (
            f"<p><strong>{who}</strong> just submitted to your activity "
            f"<strong>{ap.title}</strong>.</p>"
        )
        return subject, body

    try:
        ep = EventNotificationPayload.model_validate(payload)
    except Exception:
        return (
            "New activity in your community",
            "<p>You have a new community notification.</p>",
        )

    when = _fmt_when(ep.start_at)
    title = ep.title
    course = ep.course_name
    host = ep.host_name

    if notification_type == EVENT_PUBLISHED:
        subject = f"New event: {title}"
        body = (
            f"<p><strong>{host}</strong> just scheduled <strong>{title}</strong> "
            f"in <em>{course}</em>.</p>"
            f"<p>{when}</p>"
            f'<p><a href="#">Open in portal</a></p>'
        )
    elif notification_type == EVENT_RSVP_CONFIRMED:
        subject = f"You're going: {title}"
        join_line = (
            f'<p><a href="{ep.meeting_url}">Join link</a></p>'
            if ep.meeting_url
            else ""
        )
        body = (
            f"<p>You're confirmed for <strong>{title}</strong> "
            f"in <em>{course}</em>.</p>"
            f"<p>{when}</p>"
            f"{join_line}"
            "<p>We've attached a calendar invite so you can add it to "
            "Google Calendar, Apple Calendar, or Outlook in one click.</p>"
        )
    elif notification_type == EVENT_STARTING_SOON_24H:
        subject = f"Tomorrow: {title}"
        body = (
            f"<p>Reminder — <strong>{title}</strong> starts tomorrow ({when}).</p>"
        )
    elif notification_type == EVENT_STARTING_SOON_15M:
        subject = f"Starting soon: {title}"
        body = f"<p><strong>{title}</strong> starts in 15 minutes.</p>"
    elif notification_type == EVENT_LIVE:
        subject = f"Live now: {title}"
        body = (
            f"<p><strong>{title}</strong> is live now. "
            f'<a href="{ep.meeting_url or "#"}">Join</a></p>'
        )
    elif notification_type == EVENT_REPLAY_NAG_T2H:
        subject = f"Add a replay for {title}?"
        body = (
            f"<p>Your event <strong>{title}</strong> ended a couple of hours ago. "
            "Paste a replay URL so attendees who missed it can catch up.</p>"
        )
    elif notification_type == EVENT_REPLAY_NAG_T24H:
        subject = f"Replay reminder: {title}"
        body = (
            f"<p>It's been a day since <strong>{title}</strong> ended. "
            "Adding a replay URL takes a few seconds and brings the event back to "
            "the top of the Replays section.</p>"
        )
    else:
        subject = "New community notification"
        body = "<p>You have a new community notification.</p>"

    return subject, body
