"""Pure-function tests for the ICS generator. No DB / pydantic — just string
formatting, so this passes regardless of the env's pydantic compat issues."""

from datetime import UTC, datetime
from uuid import UUID

from polar.coaching.ics import event_to_ics, filename_for


class _FakeEvent:
    """Duck-typed CoachingEvent stand-in. The ICS generator only reads
    attributes, never DB state, so this is sufficient for the unit test."""

    def __init__(
        self,
        *,
        id: UUID,
        title: str,
        description: str | None = None,
        starts_at: datetime,
        duration_minutes: int = 60,
        meeting_url: str | None = None,
        status: str = "scheduled",
    ) -> None:
        self.id = id
        self.title = title
        self.description = description
        self.starts_at = starts_at
        self.duration_minutes = duration_minutes
        self.meeting_url = meeting_url
        self.status = status


def test_minimal_event() -> None:
    event = _FakeEvent(
        id=UUID("00000000-0000-0000-0000-000000000001"),
        title="Week 1 Live Call",
        starts_at=datetime(2026, 6, 1, 17, 0, tzinfo=UTC),
    )
    body = event_to_ics(event, organization_slug="acme", program_title="Coaching")
    assert body.startswith("BEGIN:VCALENDAR\r\n")
    assert body.rstrip().endswith("END:VCALENDAR")
    assert "DTSTART:20260601T170000Z" in body
    assert "DTEND:20260601T180000Z" in body
    assert "SUMMARY:Week 1 Live Call" in body
    assert "STATUS:CONFIRMED" in body
    assert "UID:coaching-event-00000000-0000-0000-0000-000000000001@polar.sh" in body


def test_escaping_and_meeting_url() -> None:
    event = _FakeEvent(
        id=UUID("00000000-0000-0000-0000-000000000002"),
        title="Q&A; session, week 2",
        description="Bring questions.\nWe'll cover pricing, packaging.",
        starts_at=datetime(2026, 6, 8, 18, 30, tzinfo=UTC),
        duration_minutes=45,
        meeting_url="https://zoom.us/j/123",
    )
    body = event_to_ics(event, organization_slug="acme", program_title="Coaching")
    # Comma and semicolon must be backslash-escaped, newlines become \n.
    assert "SUMMARY:Q&A\\; session\\, week 2" in body
    assert "DESCRIPTION:" in body
    assert "Bring questions.\\nWe'll cover pricing\\, packaging." in body
    assert "URL:https://zoom.us/j/123" in body


def test_cancelled() -> None:
    event = _FakeEvent(
        id=UUID("00000000-0000-0000-0000-000000000003"),
        title="Cancelled call",
        starts_at=datetime(2026, 6, 15, 17, 0, tzinfo=UTC),
        status="cancelled",
    )
    body = event_to_ics(event, organization_slug="acme", program_title=None)
    assert "STATUS:CANCELLED" in body


def test_filename() -> None:
    event_id = UUID("00000000-0000-0000-0000-000000000004")
    assert filename_for(event_id) == "coaching-event-00000000-0000-0000-0000-000000000004.ics"


def test_naive_datetime_treated_as_utc() -> None:
    """Naive datetimes are interpreted as UTC. Important for the customer
    portal's "Add to calendar" download to behave consistently regardless of
    how the row was originally stored."""
    event = _FakeEvent(
        id=UUID("00000000-0000-0000-0000-000000000005"),
        title="Naive",
        starts_at=datetime(2026, 6, 22, 12, 0),  # no tzinfo
    )
    body = event_to_ics(event, organization_slug="acme", program_title=None)
    assert "DTSTART:20260622T120000Z" in body
