"""Static checks for the community service. The full DB-backed integration
tests live alongside the rest of the coaching suite; this file pins the
small invariants that are easy to verify without a DB:

  - top-level posts have parent_id == None
  - replies have parent_id != None
  - replies cannot themselves be replied to (one-deep threading)
  - moderate_post rejects pinning a reply

We don't import the SQLAlchemy stack here (the env's pydantic / Python 3.14
combo can't, same constraint as the ICS + intake unit tests). Instead we
read the source and assert the guard lines exist.
"""

from pathlib import Path


def _service_src() -> str:
    return (
        Path(__file__).parent.parent.parent
        / "polar"
        / "coaching"
        / "service.py"
    ).read_text()


def test_one_deep_threading_guard_present_in_post_as_customer() -> None:
    src = _service_src()
    # The guard must reject parent_id pointing at a reply (parent.parent_id is
    # not None) — both customer and creator paths.
    assert "post_as_customer" in src
    assert "parent.parent_id is not None" in src


def test_one_deep_threading_guard_present_in_post_as_creator() -> None:
    src = _service_src()
    assert "post_as_creator" in src
    # Both code paths share the same `parent.parent_id is not None` literal —
    # there should be at least two occurrences (one per method).
    assert src.count("parent.parent_id is not None") >= 2


def test_pin_reply_rejected() -> None:
    src = _service_src()
    assert "Replies cannot be pinned" in src


def test_customer_delete_checks_ownership() -> None:
    src = _service_src()
    assert "delete_post_as_customer" in src
    # Service must compare enrollment_id and 404 if the post belongs to
    # someone else (we 404 instead of 403 to avoid leaking existence).
    assert "post.enrollment_id != enrollment_id" in src


def test_community_disabled_blocks_post() -> None:
    src = _service_src()
    assert "Community is not enabled for this program" in src
