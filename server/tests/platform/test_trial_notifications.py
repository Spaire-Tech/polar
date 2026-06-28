"""Unit tests for the platform trial-reminder scheduling logic.

The marker selection (`_due_marker`) had a bug where iterating the reminder
days in descending order made every run resolve to the 7-day marker, so the
T-2 and T-0 reminders never fired. These tests lock in the corrected
ascending behavior.
"""

from polar.platform.trial_notifications import _REMINDER_DAYS, _due_marker


class TestDueMarker:
    def test_more_than_seven_days_out_is_not_due(self) -> None:
        assert _due_marker(14) is None
        assert _due_marker(8) is None

    def test_seven_day_window_fires_seven(self) -> None:
        assert _due_marker(7) == 7
        assert _due_marker(6) == 7
        assert _due_marker(3) == 7

    def test_two_day_window_fires_two(self) -> None:
        assert _due_marker(2) == 2
        assert _due_marker(1) == 2

    def test_last_day_fires_zero(self) -> None:
        assert _due_marker(0) == 0

    def test_expired_is_not_due(self) -> None:
        assert _due_marker(-1) is None
        assert _due_marker(-5) is None

    def test_every_reminder_day_is_reachable(self) -> None:
        # Regression guard: each configured reminder threshold must be the
        # resolved marker for at least its own days-remaining value. The
        # original descending-iteration bug made 2 and 0 unreachable.
        for marker in _REMINDER_DAYS:
            assert _due_marker(marker) == marker

    def test_reminder_days_are_ascending(self) -> None:
        # _due_marker relies on ascending order to return the most-urgent
        # (smallest) reached threshold.
        assert list(_REMINDER_DAYS) == sorted(_REMINDER_DAYS)
