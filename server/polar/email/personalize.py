"""Per-recipient template variable substitution for marketing email.

Both broadcasts and sequence steps may contain ``{{first_name}}`` style
placeholders in either the subject or the HTML body. We substitute them
at send time against the subscriber row plus any custom fields. Without
this, the editor's preview shows ``{{first_name}}`` rendered literally
in the sent email — which was the pre-fix behaviour for every recipient
of every broadcast (audit issue #45).

Supported tokens (case-insensitive on the variable name, surrounding
whitespace tolerated):

  {{email}}                 → subscriber.email
  {{name}} / {{full_name}}  → subscriber.name
  {{first_name}}            → first whitespace-delimited token of name
  {{last_name}}             → remainder after the first token
  {{custom.<key>}}          → custom field value, empty if unset

Unknown variables resolve to the empty string (loud rendering — the
sender doesn't ship ``{{unknown_field}}`` to recipients).
"""

from __future__ import annotations

import re
from html import escape
from typing import Any

# Anchored on ``{{`` to avoid matching inside HTML attribute braces.
# Non-greedy body so two placeholders on one line don't merge.
_TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")


def _split_first_last(full_name: str | None) -> tuple[str, str]:
    if not full_name:
        return "", ""
    parts = full_name.strip().split(None, 1)
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def build_variables(
    *,
    subscriber: Any,
    custom_fields: dict[str, str | None] | None = None,
) -> dict[str, str]:
    """Build the substitution map for a single recipient.

    The subscriber argument is duck-typed (only ``.email`` and ``.name``
    are read) so this works with both ORM rows and lightweight test
    doubles.
    """
    name = getattr(subscriber, "name", None) or ""
    email = getattr(subscriber, "email", None) or ""
    first, last = _split_first_last(name)
    out: dict[str, str] = {
        "email": email,
        "name": name,
        "full_name": name,
        "first_name": first,
        "last_name": last,
    }
    for key, value in (custom_fields or {}).items():
        # Custom-field keys are normalised at write time but defensive
        # normalisation here keeps the substitution case-insensitive
        # for the ``{{custom.X}}`` form.
        out[f"custom.{key.strip()}"] = (value or "") if value is not None else ""
    return out


def render(text: str, variables: dict[str, str], *, html: bool) -> str:
    """Replace every ``{{var}}`` in ``text`` with ``variables[var]``.

    When ``html`` is true, replacement values are HTML-escaped — both
    broadcast HTML and step content_html flow through here, and an
    unescaped subscriber name like ``<script>`` would otherwise be an
    XSS vector inside the rendered body. Subject lines pass ``html=False``.
    """
    if not text or "{{" not in text:
        return text

    def _sub(match: re.Match[str]) -> str:
        raw_key = match.group(1)
        # Direct hit first, then case-insensitive fallback so authors
        # can write ``{{First_Name}}`` and still match.
        if raw_key in variables:
            value = variables[raw_key]
        else:
            lower = raw_key.lower()
            value = next(
                (v for k, v in variables.items() if k.lower() == lower),
                "",
            )
        return escape(value, quote=True) if html else value

    return _TOKEN_RE.sub(_sub, text)
