"""Newsletter theme tokens.

A theme is the source of truth for the email + web-archive render
appearance: brand colours, font families, base sizes, and the spacing
scale. Stored as JSONB on `Newsletter.theme`, with sparse per-post
overrides in `NewsletterPost.theme_overrides`. Both are shallow-merged
at render time (see `resolve_theme`).

The DEFAULT_THEME values mirror the hard-coded styles in
`email_broadcast/render.py` exactly. When the renderer is called
without a theme override (existing broadcasts), it produces the same
HTML it always has. New themes only take effect when explicitly
supplied — backwards-compatible by construction.

V1 scope:
  - colours (7 tokens that map 1:1 to the Style view's Basic tab)
  - typography (heading / body font family, base size, line height,
    masthead size)
  - spacing (section padding, block gap, border radius)

Deferred to V2: per-element overrides (title / subtitle / image /
byline / topline / alignment / padding / code with their own
font/weight/size/colour/letterSpacing). The shape leaves a
`"elements"` slot for them, so they can land without a migration.
"""

from __future__ import annotations

from typing import Any


# These are the same literal values currently hard-coded across
# render.py's per-block functions. Keep them in lock-step — if the
# default heading colour changes here it MUST change in the renderer's
# fallback, or the parity test (which still runs without a theme arg)
# will fail.
DEFAULT_THEME: dict[str, Any] = {
    "colors": {
        # Page / canvas surrounding the email body.
        "outsideBg": "#ffffff",
        # Email content container background.
        "postBg": "#ffffff",
        # Primary text colour (headings and inline text).
        "textBg": "#1d1d1f",
        # Slightly muted body-text colour. Distinct from textBg so the
        # existing "headings darker than paragraphs" hierarchy survives
        # a no-theme render. When a user picks `textBg` in the style
        # editor, both collapse to one value (see _safe_text_subtle).
        "textSubtle": "#424245",
        # Brand accent — button backgrounds, callout labels, quote bar.
        # When a per-block accent override is present on a block (e.g.
        # the old broadcasts pass a top-level accent), that wins.
        "primary": "#1d1d1f",
        # Text colour drawn ON the primary surface (e.g. button label).
        "textPrimary": "#ffffff",
        # Secondary, muted-but-readable colour (captions, meta).
        "secondary": "#86868b",
        # Anchor colour. Defaults to text colour (current behaviour).
        "links": "#1d1d1f",
        # Hairline rule used by dividers, card outlines.
        "hairline": "#e8e8ed",
    },
    "typography": {
        # Font family hints; the renderer resolves each to an
        # email-safe CSS stack (see FONT_STACKS). "default" preserves
        # today's system-font behaviour.
        "headingFont": "default",
        "bodyFont": "default",
        # Base body-text size in px. Headings scale relative to this
        # via the renderer's per-level multipliers (kept intact for V1
        # so the heading hierarchy is preserved across themes).
        "baseSize": 14,
        # Unitless multiplier applied to body / paragraph blocks.
        "lineHeight": 1.65,
        # Masthead wordmark size in px.
        "headerSize": 28,
    },
    "spacing": {
        # Outer padding of the email content container, px.
        "sectionPadding": 32,
        # Vertical gap between blocks, px. Today's renderer bakes
        # gaps into per-block margins; this token is the canonical
        # value the editor can tune in Phase 4b.
        "blockGap": 16,
        # Default radius for images, buttons, callouts, cards, px.
        "borderRadius": 8,
    },
}

# Curated, email-safe font stacks. Email clients won't load Google
# Fonts — the *name* on the left is the editor's display label and
# the stack on the right is what we emit. When the user picks a name
# that isn't in this map (a typo or a stale theme), we fall back to
# `default`. Phase 5 (web archive) can load the original Google Font
# at the same URL since the browser CAN render webfonts.
FONT_STACKS: dict[str, str] = {
    "default": (
        '-apple-system, BlinkMacSystemFont, "Segoe UI", '
        "Helvetica, Arial, sans-serif"
    ),
    "Inter": (
        '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", '
        "Helvetica, Arial, sans-serif"
    ),
    "SF Pro Display": (
        '-apple-system, "SF Pro Display", BlinkMacSystemFont, '
        '"Segoe UI", Helvetica, Arial, sans-serif'
    ),
    "Newsreader": (
        '"Newsreader", Georgia, "New York", "Iowan Old Style", '
        "Charter, serif"
    ),
    "Georgia": 'Georgia, "Times New Roman", Times, serif',
    "Anton": '"Anton", Helvetica, Arial, sans-serif',
    "Charter": 'Charter, Georgia, "New York", serif',
    "New York": '"New York", Georgia, "Iowan Old Style", serif',
    "Iowan": '"Iowan Old Style", Georgia, "New York", serif',
}


def font_stack(name: str | None) -> str:
    """Resolve a font name into an email-safe CSS font-family stack.

    Unknown names fall back to the default system stack rather than
    erroring — a stale theme stored before a font was removed should
    keep rendering, just without the bespoke face.
    """
    if not name:
        return FONT_STACKS["default"]
    return FONT_STACKS.get(name, FONT_STACKS["default"])


def _shallow_merge(base: dict[str, Any], override: dict[str, Any] | None) -> dict[str, Any]:
    """One-level deep merge: top-level dict keys merge their values.

    Example:
        base = {"colors": {"a": 1, "b": 2}, "typography": {"x": 10}}
        override = {"colors": {"b": 20}}
        → {"colors": {"a": 1, "b": 20}, "typography": {"x": 10}}

    Anything outside the known shape passes through. Deeper merging
    (per-element overrides) lands in Phase 4b alongside the V2 UI.
    """
    if not override:
        return base
    out = dict(base)
    for key, value in override.items():
        if (
            isinstance(value, dict)
            and isinstance(out.get(key), dict)
        ):
            out[key] = {**out[key], **value}
        else:
            out[key] = value
    return out


def resolve_theme(
    newsletter_theme: dict[str, Any] | None,
    post_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Layer the global default ← newsletter theme ← post override.

    The renderer always works against the fully-resolved theme so it
    never has to think about which layer a value came from. Callers
    should compute this once per render and pass the result straight
    in.
    """
    resolved = _shallow_merge(DEFAULT_THEME, newsletter_theme)
    resolved = _shallow_merge(resolved, post_overrides)
    return resolved


def theme_color(theme: dict[str, Any], key: str, fallback: str | None = None) -> str:
    """Safe colour lookup. Falls back to the DEFAULT_THEME value when
    the resolved theme is missing or carries a non-string value (e.g.
    a malformed payload from a stale draft)."""
    colors = theme.get("colors") if isinstance(theme.get("colors"), dict) else {}
    raw = colors.get(key)
    if isinstance(raw, str) and raw:
        return raw
    if fallback is not None:
        return fallback
    return str(DEFAULT_THEME["colors"][key])


def theme_typography(theme: dict[str, Any], key: str) -> Any:
    typo = theme.get("typography") if isinstance(theme.get("typography"), dict) else {}
    if key in typo:
        return typo[key]
    return DEFAULT_THEME["typography"][key]


def theme_spacing(theme: dict[str, Any], key: str) -> int:
    sp = theme.get("spacing") if isinstance(theme.get("spacing"), dict) else {}
    if key in sp and isinstance(sp[key], (int, float)):
        return int(sp[key])
    return int(DEFAULT_THEME["spacing"][key])


# Four canned presets that the Style view exposes as one-click chips.
# Each is a complete theme document — picking one wholly replaces the
# user's current theme. Names match the design.
THEME_PRESETS: dict[str, dict[str, Any]] = {
    "Editorial": {
        "colors": {
            "outsideBg": "#ffffff",
            "postBg": "#ffffff",
            "textBg": "#0a0a0c",
            "textSubtle": "#3a3a3c",
            "primary": "#0a0a0c",
            "textPrimary": "#ffffff",
            "secondary": "#86868b",
            "links": "#0a0a0c",
            "hairline": "#e8e8ed",
        },
        "typography": {
            "headingFont": "Newsreader",
            "bodyFont": "Newsreader",
            "baseSize": 17,
            "lineHeight": 1.7,
            "headerSize": 32,
        },
        "spacing": {"sectionPadding": 36, "blockGap": 18, "borderRadius": 4},
    },
    "Mocha": {
        "colors": {
            "outsideBg": "#f5efe6",
            "postBg": "#f5efe6",
            "textBg": "#3d2e1f",
            "textSubtle": "#5b4632",
            "primary": "#7a4e2b",
            "textPrimary": "#fff8ef",
            "secondary": "#9a7a55",
            "links": "#7a4e2b",
            "hairline": "#e0d4c0",
        },
        "typography": {
            "headingFont": "Newsreader",
            "bodyFont": "Charter",
            "baseSize": 16,
            "lineHeight": 1.65,
            "headerSize": 30,
        },
        "spacing": {"sectionPadding": 32, "blockGap": 16, "borderRadius": 10},
    },
    "Night": {
        "colors": {
            "outsideBg": "#1a1a1d",
            "postBg": "#1a1a1d",
            "textBg": "#f6f4ef",
            "textSubtle": "#c8c8cc",
            "primary": "#f6f4ef",
            "textPrimary": "#1a1a1d",
            "secondary": "#8e8e93",
            "links": "#f6f4ef",
            "hairline": "#2f2f33",
        },
        "typography": {
            "headingFont": "Inter",
            "bodyFont": "Inter",
            "baseSize": 15,
            "lineHeight": 1.65,
            "headerSize": 30,
        },
        "spacing": {"sectionPadding": 32, "blockGap": 18, "borderRadius": 12},
    },
    "Sage": {
        "colors": {
            "outsideBg": "#eef0e8",
            "postBg": "#eef0e8",
            "textBg": "#2f3a2a",
            "textSubtle": "#4a5644",
            "primary": "#4a6041",
            "textPrimary": "#f6f6f0",
            "secondary": "#7e8a72",
            "links": "#4a6041",
            "hairline": "#d6dccb",
        },
        "typography": {
            "headingFont": "Newsreader",
            "bodyFont": "Charter",
            "baseSize": 16,
            "lineHeight": 1.7,
            "headerSize": 30,
        },
        "spacing": {"sectionPadding": 32, "blockGap": 16, "borderRadius": 10},
    },
}
