"""Pure-function tests for the intake-form validation helper. No DB; just
exercises the schema vs. answers logic shared by the customer-portal
endpoint."""

from polar.coaching.service import validate_intake_answers


class _FakeForm:
    def __init__(self, fields: list[dict]) -> None:
        self.schema_json = {"fields": fields}


def test_required_field_missing() -> None:
    form = _FakeForm(
        [{"id": "name", "type": "short_text", "label": "Name", "required": True}]
    )
    assert validate_intake_answers(form, {}) == ["name: required"]


def test_required_field_blank_string() -> None:
    form = _FakeForm(
        [{"id": "name", "type": "short_text", "label": "Name", "required": True}]
    )
    assert validate_intake_answers(form, {"name": "   "}) == ["name: required"]


def test_optional_field_empty_is_ok() -> None:
    form = _FakeForm(
        [{"id": "bio", "type": "long_text", "label": "Bio", "required": False}]
    )
    assert validate_intake_answers(form, {}) == []
    assert validate_intake_answers(form, {"bio": ""}) == []


def test_email_format() -> None:
    form = _FakeForm(
        [{"id": "e", "type": "email", "label": "Email", "required": True}]
    )
    assert validate_intake_answers(form, {"e": "not-email"}) == [
        "e: invalid email"
    ]
    assert validate_intake_answers(form, {"e": "ok@example.com"}) == []


def test_select_options() -> None:
    form = _FakeForm(
        [
            {
                "id": "level",
                "type": "select",
                "label": "Level",
                "required": True,
                "options": ["beginner", "advanced"],
            }
        ]
    )
    assert validate_intake_answers(form, {"level": "expert"}) == [
        "level: not a valid option"
    ]
    assert validate_intake_answers(form, {"level": "advanced"}) == []


def test_multiselect_must_be_list_of_strings() -> None:
    form = _FakeForm(
        [
            {
                "id": "tags",
                "type": "multiselect",
                "label": "Tags",
                "required": False,
                "options": ["a", "b", "c"],
            }
        ]
    )
    assert validate_intake_answers(form, {"tags": "a"}) == [
        "tags: expected list of strings"
    ]
    assert validate_intake_answers(form, {"tags": ["a", "z"]}) == [
        "tags: contains invalid option"
    ]
    assert validate_intake_answers(form, {"tags": ["a", "b"]}) == []


def test_multiple_errors_accumulate() -> None:
    form = _FakeForm(
        [
            {"id": "n", "type": "short_text", "label": "N", "required": True},
            {"id": "e", "type": "email", "label": "E", "required": True},
        ]
    )
    errors = validate_intake_answers(form, {"e": "bad"})
    assert "n: required" in errors
    assert "e: invalid email" in errors
