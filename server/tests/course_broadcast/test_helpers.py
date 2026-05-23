"""Pure-logic tests for the BroadcastService validation helper.

`_ensure_future` is the single guardrail for past-time scheduled_at
values; it's wired into three call paths (create, update, schedule)
so getting it wrong leaks into all of them. Tested here without the
DB stack because the helper operates on a datetime + a field name —
no session needed.
"""

from datetime import datetime, timedelta, timezone

import pytest

from polar.course_broadcast.service import _ensure_future
from polar.exceptions import SpaireRequestValidationError


class TestEnsureFuture:
    def test_accepts_future_aware(self) -> None:
        target = datetime.now(timezone.utc) + timedelta(hours=1)
        out = _ensure_future(target, "scheduled_at")
        assert out == target
        assert out.tzinfo is timezone.utc

    def test_accepts_future_naive_treats_as_utc(self) -> None:
        # Pydantic accepts naive datetimes on a `datetime` field; the
        # helper has to coerce them to UTC so the future-time check is
        # meaningful regardless of the client's payload shape.
        naive = (
            datetime.now(timezone.utc) + timedelta(hours=1)
        ).replace(tzinfo=None)
        out = _ensure_future(naive, "scheduled_at")
        assert out.tzinfo is timezone.utc

    def test_rejects_past(self) -> None:
        target = datetime.now(timezone.utc) - timedelta(minutes=1)
        with pytest.raises(SpaireRequestValidationError) as excinfo:
            _ensure_future(target, "scheduled_at")
        # The error carries the field name so the client UI can
        # surface it inline — checked here so a refactor that drops
        # the field name doesn't silently regress the error shape.
        assert any(
            "scheduled_at" in (e.get("loc") or ()) for e in excinfo.value.errors
        )

    def test_rejects_now_exact(self) -> None:
        # "now" is not strictly future — we want strict > so a cron
        # tick can't race a same-millisecond schedule and double-fire.
        # Use a small backdate to keep this deterministic across the
        # tiny gap between `now` capture and the helper call.
        target = datetime.now(timezone.utc)
        with pytest.raises(SpaireRequestValidationError):
            _ensure_future(target, "scheduled_at")

    def test_rejects_far_past(self) -> None:
        target = datetime(2020, 1, 1, tzinfo=timezone.utc)
        with pytest.raises(SpaireRequestValidationError):
            _ensure_future(target, "scheduled_at")

    def test_error_field_name_threaded(self) -> None:
        # Two call sites pass different field names (BroadcastCreate
        # passes "scheduled_at"; a future caller might re-use this for
        # another field). The helper has to put the name into the
        # error loc rather than hardcoding it.
        target = datetime.now(timezone.utc) - timedelta(seconds=1)
        with pytest.raises(SpaireRequestValidationError) as excinfo:
            _ensure_future(target, "my_custom_field")
        assert any(
            "my_custom_field" in (e.get("loc") or ())
            for e in excinfo.value.errors
        )
