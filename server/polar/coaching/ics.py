"""Tiny RFC 5545 (iCalendar) builder.

We render ICS by hand instead of pulling in `ics` / `icalendar` because the
surface we need is small (one VEVENT per file) and adding a dep for ~20
lines of string formatting isn't worth it.
"""

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from polar.models.coaching_event import CoachingEvent


def _fmt_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    else:
        dt = dt.astimezone(UTC)
    return dt.strftime("%Y%m%dT%H%M%SZ")


def _escape(text: str) -> str:
    """RFC 5545 §3.3.11 — backslash, semicolon, comma, newline."""
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def _fold(line: str) -> str:
    """RFC 5545 §3.1 — lines longer than 75 octets must be folded."""
    if len(line.encode("utf-8")) <= 75:
        return line
    out = []
    s = line
    while len(s.encode("utf-8")) > 75:
        # Cheap split at 73 chars — close enough for ASCII content lines.
        out.append(s[:73])
        s = " " + s[73:]
    out.append(s)
    return "\r\n".join(out)


def event_to_ics(
    event: "CoachingEvent",
    *,
    organization_slug: str,
    program_title: str | None,
) -> str:
    end = event.starts_at + timedelta(minutes=event.duration_minutes)
    uid = f"coaching-event-{event.id}@polar.sh"

    summary = _escape(event.title)
    description_parts: list[str] = []
    if program_title:
        description_parts.append(f"Program: {program_title}")
    if event.description:
        description_parts.append(event.description)
    if event.meeting_url:
        description_parts.append(f"Join: {event.meeting_url}")
    description = _escape("\n\n".join(description_parts))

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:-//Polar//Coaching {organization_slug}//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{_fmt_utc(datetime.now(UTC))}",
        f"DTSTART:{_fmt_utc(event.starts_at)}",
        f"DTEND:{_fmt_utc(end)}",
        f"SUMMARY:{summary}",
    ]
    if description:
        lines.append(f"DESCRIPTION:{description}")
    if event.meeting_url:
        lines.append(f"URL:{_escape(event.meeting_url)}")
    if event.status == "cancelled":
        lines.append("STATUS:CANCELLED")
    else:
        lines.append("STATUS:CONFIRMED")
    lines += [
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(_fold(ln) for ln in lines) + "\r\n"


def filename_for(event_id: UUID) -> str:
    return f"coaching-event-{event_id}.ics"
