"""Tests for the per-recipient template variable substitution."""
from __future__ import annotations

from types import SimpleNamespace

from polar.email.personalize import build_variables, render


def _sub(name: str | None = "Ada Lovelace", email: str = "ada@example.com") -> object:
    return SimpleNamespace(name=name, email=email)


def test_first_last_split() -> None:
    vs = build_variables(subscriber=_sub("Ada Lovelace"))
    assert vs["first_name"] == "Ada"
    assert vs["last_name"] == "Lovelace"
    assert vs["full_name"] == "Ada Lovelace"


def test_single_name_has_empty_last() -> None:
    vs = build_variables(subscriber=_sub("Cher"))
    assert vs["first_name"] == "Cher"
    assert vs["last_name"] == ""


def test_missing_name_falls_back_to_empty() -> None:
    vs = build_variables(subscriber=_sub(None))
    assert vs["first_name"] == ""
    assert vs["last_name"] == ""
    assert vs["name"] == ""


def test_renders_known_tokens() -> None:
    vs = build_variables(subscriber=_sub("Ada Lovelace", "ada@x.com"))
    out = render("Hi {{first_name}} <{{email}}>", vs, html=False)
    assert out == "Hi Ada <ada@x.com>"


def test_html_escapes_values() -> None:
    """Subscriber-provided values flow into HTML; escape to block XSS."""
    vs = build_variables(subscriber=_sub("<script>alert(1)</script>"))
    out = render("Hello {{first_name}}", vs, html=True)
    assert "<script>" not in out
    assert "&lt;script&gt;" in out


def test_subject_does_not_escape() -> None:
    vs = build_variables(subscriber=_sub("Tom & Jerry"))
    out = render("Welcome, {{first_name}}!", vs, html=False)
    # Ampersand stays as-is in the subject; headers aren't HTML.
    assert out == "Welcome, Tom & Jerry!"


def test_unknown_token_renders_empty() -> None:
    vs = build_variables(subscriber=_sub("Ada"))
    out = render("Howdy {{unknown_thing}}", vs, html=False)
    assert out == "Howdy "


def test_case_insensitive_lookup() -> None:
    vs = build_variables(subscriber=_sub("Ada"))
    out = render("{{First_Name}} {{FIRST_NAME}}", vs, html=False)
    assert out == "Ada Ada"


def test_custom_fields() -> None:
    vs = build_variables(
        subscriber=_sub("Ada"),
        custom_fields={"plan": "Pro", "city": None},
    )
    out = render("plan={{custom.plan}} city={{custom.city}}", vs, html=False)
    assert out == "plan=Pro city="


def test_no_braces_returns_unchanged() -> None:
    vs = build_variables(subscriber=_sub("Ada"))
    out = render("no tokens at all", vs, html=False)
    assert out == "no tokens at all"
