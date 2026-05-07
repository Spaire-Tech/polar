"""Static checks for the public coaching landing block.

Pins what the storefront preview must / must not contain. The
DB-backed integration test covers the actual SQL; this file ensures the
serializer doesn't accidentally leak meeting URLs or recording playback
ids into the public response.
"""

from pathlib import Path


def _src() -> str:
    return (
        Path(__file__).parent.parent.parent
        / "polar"
        / "customer_portal"
        / "endpoints"
        / "courses.py"
    ).read_text()


def test_helper_exists() -> None:
    src = _src()
    assert "_build_coaching_landing_block" in src


def test_upcoming_events_dont_include_meeting_url() -> None:
    src = _src()
    block = src[src.index("_build_coaching_landing_block") :]
    block = block[: block.index("PYEOF" if "PYEOF" in block else "ENDMARKER") if False else len(block)]
    # Inside the upcoming-events list comprehension, only id/title/starts_at/
    # duration_minutes are surfaced — meeting_url / meeting_provider must
    # not appear in that comprehension.
    upcoming_section = block[block.index("upcoming_events") :]
    list_comp_end = upcoming_section.index("],")
    upcoming_lc = upcoming_section[: list_comp_end]
    assert "meeting_url" not in upcoming_lc
    assert "meeting_provider" not in upcoming_lc
    assert "recording" not in upcoming_lc


def test_response_carries_program_format_and_community_flag() -> None:
    """The frontend keys the coaching preview off these fields."""
    src = _src()
    assert '"program_format": course.program_format' in src
    assert '"community_enabled": course.community_enabled' in src
    assert '"coaching": coaching_block' in src


def test_cohort_block_exposes_only_safe_fields() -> None:
    src = _src()
    block = src[src.index("_build_coaching_landing_block") :]
    cohort_section = block[block.index("cohort_block = {")  :]
    cohort_section = cohort_section[: cohort_section.index("}") + 1]
    # Public-safe fields only:
    for field in (
        "name",
        "starts_at",
        "ends_at",
        "capacity",
        "member_count",
        "enrollment_open",
        "is_full",
    ):
        assert f'"{field}":' in cohort_section, field
    # No internal / sensitive fields:
    for field in ("intake_required", "default_meeting", "deleted_at"):
        assert f'"{field}":' not in cohort_section, field
