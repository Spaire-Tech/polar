"""Render block-based broadcast content to email-safe HTML.

The frontend block editor produces a JSON document of the form:

    {
      "version": 1,
      "blocks": [
        {"id": "...", "type": "heading", "level": 1, "text": "..."},
        {"id": "...", "type": "paragraph", "text": "..."},
        {"id": "...", "type": "image", "src": "...", "alt": "...", "href": "..."},
        {"id": "...", "type": "button", "text": "...", "url": "..."},
        {"id": "...", "type": "divider"},
        {"id": "...", "type": "video", "thumbnail": "...", "url": "..."}
      ]
    }

This module produces the HTML the worker sends. We render the same shape
client-side for the live preview, but the server is the source of truth —
whenever a broadcast is saved with `content_json`, we regenerate
`content_html` so the eventual send always matches the stored JSON.

Theming
-------

Pass a resolved theme dict (see `polar.newsletter.theme.resolve_theme`)
as the second argument to `render_blocks_to_html` to override the
default colours, typography, and spacing. When `theme` is None the
renderer falls back to the constants below, which match the original
hard-coded styles exactly — so existing broadcasts (which never knew
about themes) keep producing the same HTML they always have.
"""

from __future__ import annotations

import html
from typing import Any

# Default colour/typography/spacing values used when the renderer is
# called without a theme. These MUST match polar.newsletter.theme's
# DEFAULT_THEME — the two structures are mirrors and a drift here
# breaks the parity test.
_DEFAULT_TEXT_HEADING = "#1d1d1f"
_DEFAULT_TEXT_BODY = "#424245"
_DEFAULT_TEXT_MUTED = "#86868b"
_DEFAULT_PRIMARY = "#1d1d1f"
_DEFAULT_TEXT_PRIMARY = "#ffffff"
_DEFAULT_HAIRLINE = "#e8e8ed"
_DEFAULT_CARD_BG = "#fafafa"
_DEFAULT_FONT_STACK = (
    '-apple-system, BlinkMacSystemFont, "Segoe UI", '
    "Helvetica, Arial, sans-serif"
)


def _t_color(theme: dict[str, Any] | None, key: str, fallback: str) -> str:
    """Theme-aware colour lookup with a string fallback.

    Validates that the resolved value is a non-empty string so a
    malformed theme (boolean, null, etc.) doesn't leak into the inline
    style and break the email render.
    """
    if not theme:
        return fallback
    colors = theme.get("colors") if isinstance(theme.get("colors"), dict) else {}
    raw = colors.get(key)
    if isinstance(raw, str) and raw:
        return raw
    return fallback


def _t_font(theme: dict[str, Any] | None, key: str) -> str:
    """Resolve a theme-supplied font-family hint to an email-safe CSS
    stack. Unknown names fall back to the system default — same path
    as `polar.newsletter.theme.font_stack` (kept in sync; this module
    can't import from newsletter to avoid a circular dep at the email
    pipeline level)."""
    if not theme:
        return _DEFAULT_FONT_STACK
    typo = theme.get("typography") if isinstance(theme.get("typography"), dict) else {}
    raw = typo.get(key) if isinstance(typo, dict) else None
    if not isinstance(raw, str) or not raw or raw == "default":
        return _DEFAULT_FONT_STACK
    return _FONT_STACKS.get(raw, _DEFAULT_FONT_STACK)


def _t_int(theme: dict[str, Any] | None, scope: str, key: str, fallback: int) -> int:
    if not theme:
        return fallback
    section = theme.get(scope) if isinstance(theme.get(scope), dict) else {}
    raw = section.get(key) if isinstance(section, dict) else None
    if isinstance(raw, (int, float)):
        return int(raw)
    return fallback


def _t_num(theme: dict[str, Any] | None, scope: str, key: str, fallback: float) -> float:
    if not theme:
        return fallback
    section = theme.get(scope) if isinstance(theme.get(scope), dict) else {}
    raw = section.get(key) if isinstance(section, dict) else None
    if isinstance(raw, (int, float)):
        return float(raw)
    return fallback


# Curated, email-safe font stacks. Mirrors polar.newsletter.theme's
# FONT_STACKS — kept duplicated rather than imported to avoid a
# cross-package dep from email_broadcast → newsletter at the rendering
# layer (the renderer is meant to be a leaf).
_FONT_STACKS: dict[str, str] = {
    "default": _DEFAULT_FONT_STACK,
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


_HEADING_STYLES = {
    1: "font-size:28px;font-weight:600;letter-spacing:-0.02em;line-height:1.2;color:#1d1d1f;margin:0 0 16px",
    2: "font-size:22px;font-weight:600;letter-spacing:-0.015em;line-height:1.25;color:#1d1d1f;margin:0 0 14px",
    3: "font-size:17px;font-weight:600;letter-spacing:-0.01em;line-height:1.3;color:#1d1d1f;margin:0 0 12px",
}

_PARAGRAPH_STYLE = (
    "font-size:14px;line-height:1.65;color:#424245;margin:0 0 16px"
)
_BUTTON_WRAPPER_STYLE = "margin:24px 0"
_BUTTON_STYLE = (
    "display:inline-block;background:#1d1d1f;color:#ffffff;"
    "padding:10px 20px;border-radius:8px;font-size:13px;"
    "font-weight:500;text-decoration:none"
)
_IMAGE_STYLE = "max-width:100%;height:auto;display:block;border-radius:8px"
_DIVIDER_STYLE = "border:none;border-top:1px solid #e8e8ed;margin:28px 0"
_VIDEO_THUMB_STYLE = (
    "max-width:100%;height:auto;display:block;border-radius:10px;"
    "border:1px solid #e8e8ed"
)


def _esc(value: Any) -> str:
    return html.escape(str(value or ""), quote=True)


def _attr(value: Any) -> str:
    return html.escape(str(value or ""), quote=True)


def _safe_url(url: Any) -> str | None:
    """Allow http(s) and mailto only — drop anything that smells like javascript:."""
    if not url:
        return None
    s = str(url).strip()
    lower = s.lower()
    if lower.startswith(("http://", "https://", "mailto:")):
        return s
    return None


def _paragraph_text(text: str) -> str:
    """Escape paragraph text and convert single newlines to <br>."""
    parts = [_esc(line) for line in (text or "").split("\n")]
    return "<br>".join(parts)


def _render_heading(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    level = block.get("level") or 1
    if level not in (1, 2, 3):
        level = 1
    text_color = _t_color(theme, "textBg", _DEFAULT_TEXT_HEADING)
    heading_font = _t_font(theme, "headingFont")
    # Font-family is only injected when the user picked a non-default
    # stack so existing renders stay byte-identical when no theme is
    # supplied (the parity fixture depends on this).
    font_decl = (
        f"font-family:{heading_font};"
        if theme and heading_font != _DEFAULT_FONT_STACK
        else ""
    )
    if block.get("huge"):
        # The TS renderer swaps to a 32px hero variant when `huge` is set;
        # the email needs to match the on-screen preview the author saw.
        style = (
            f"{font_decl}"
            f"font-size:32px;font-weight:600;letter-spacing:-0.02em;"
            f"line-height:1.15;color:{text_color};margin:8px 0 16px"
        )
    elif theme is None:
        style = _HEADING_STYLES[level]
    else:
        # Theme path: same sizing scale as the constants above, but with
        # the resolved text colour + optional font family. Keeping the
        # sizes scale-locked preserves the visual hierarchy when only a
        # colour or font is overridden.
        sizes = {1: 28, 2: 22, 3: 17}
        letter = {1: "-0.02em", 2: "-0.015em", 3: "-0.01em"}
        lh = {1: 1.2, 2: 1.25, 3: 1.3}
        margins = {1: "0 0 16px", 2: "0 0 14px", 3: "0 0 12px"}
        style = (
            f"{font_decl}"
            f"font-size:{sizes[level]}px;font-weight:600;"
            f"letter-spacing:{letter[level]};line-height:{lh[level]};"
            f"color:{text_color};margin:{margins[level]}"
        )
    text = _esc(block.get("text") or "")
    return f'<h{level} style="{style}">{text}</h{level}>'


def _render_paragraph(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    text = _paragraph_text(block.get("text") or "")
    if theme is None:
        return f'<p style="{_PARAGRAPH_STYLE}">{text}</p>'
    # When the user picks a `textBg` colour, body text gets that
    # explicit value (no longer the slightly-muted default). Theme
    # users typically want one colour for all text — the design's
    # palette has a single textBg token to express this.
    color = _t_color(theme, "textBg", _DEFAULT_TEXT_BODY)
    body_font = _t_font(theme, "bodyFont")
    font_decl = (
        f"font-family:{body_font};"
        if body_font != _DEFAULT_FONT_STACK
        else ""
    )
    base_size = _t_int(theme, "typography", "baseSize", 14)
    line_height = _t_num(theme, "typography", "lineHeight", 1.65)
    return (
        f'<p style="{font_decl}font-size:{base_size}px;'
        f"line-height:{line_height};color:{color};"
        f'margin:0 0 16px">{text}</p>'
    )


def _render_image(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    src = _safe_url(block.get("src"))
    if not src:
        return ""
    alt = _attr(block.get("alt") or "")
    radius = _t_int(theme, "spacing", "borderRadius", 8)
    style = (
        f"max-width:100%;height:auto;display:block;border-radius:{radius}px"
    )
    img = f'<img src="{_attr(src)}" alt="{alt}" style="{style}">'
    href = _safe_url(block.get("href"))
    inner = f'<a href="{_attr(href)}" target="_blank" rel="noreferrer">{img}</a>' if href else img
    return f'<div style="margin:20px 0">{inner}</div>'


def _render_button(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    # Kept for old broadcast callers that don't supply an accent.
    # _render_button_with_accent is the theme- and accent-aware path
    # used by the main dispatcher.
    url = _safe_url(block.get("url"))
    text = _esc(block.get("text") or "Learn more")
    bg = _t_color(theme, "primary", _DEFAULT_PRIMARY)
    fg = _t_color(theme, "textPrimary", _DEFAULT_TEXT_PRIMARY)
    radius = _t_int(theme, "spacing", "borderRadius", 8)
    style = (
        f"display:inline-block;background:{bg};color:{fg};"
        f"padding:10px 20px;border-radius:{radius}px;"
        f"font-size:13px;font-weight:500;text-decoration:none"
    )
    if not url:
        return (
            f'<div style="{_BUTTON_WRAPPER_STYLE}">'
            f'<span style="{style}">{text}</span></div>'
        )
    return (
        f'<div style="{_BUTTON_WRAPPER_STYLE}">'
        f'<a href="{_attr(url)}" target="_blank" rel="noreferrer" '
        f'style="{style}">{text}</a>'
        f"</div>"
    )


def _render_divider(_block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    line = _t_color(theme, "hairline", _DEFAULT_HAIRLINE)
    return (
        f'<hr style="border:none;border-top:1px solid {line};margin:28px 0">'
    )


def _render_video(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    # Prefer the embed link; fall back to a direct file URL. Thumbnail
    # defaults to the same URL when none is given.
    target = _safe_url(block.get("embed_url")) or _safe_url(block.get("src"))
    if not target:
        return ""
    thumb = _safe_url(block.get("thumbnail")) or target
    line = _t_color(theme, "hairline", _DEFAULT_HAIRLINE)
    radius_default = _t_int(theme, "spacing", "borderRadius", 8)
    # Video thumbnail uses a slightly larger radius (10px) historically;
    # honor the theme's borderRadius when supplied, otherwise the 10px
    # value matches the existing parity golden.
    radius = radius_default if theme else 10
    style = (
        f"max-width:100%;height:auto;display:block;"
        f"border-radius:{radius}px;border:1px solid {line}"
    )
    return (
        f'<div style="margin:24px 0">'
        f'<a href="{_attr(target)}" target="_blank" rel="noreferrer">'
        f'<img src="{_attr(thumb)}" alt="Watch video" style="{style}">'
        f"</a>"
        f"</div>"
    )


def _render_eyebrow(
    block: dict[str, Any], accent: str, theme: dict[str, Any] | None = None
) -> str:
    text = _esc(block.get("text") or "")
    # Existing eyebrow uses the per-doc accent (carried over from the
    # broadcast editor). Theme path picks the primary colour unless an
    # accent override is passed explicitly by the caller.
    color = accent if accent != "#1d1d1f" else _t_color(theme, "primary", accent)
    return (
        f'<div style="font-size:11px;letter-spacing:0.18em;'
        f'text-transform:uppercase;color:{color};font-weight:600;'
        f'margin:0 0 8px">{text}</div>'
    )


def _render_subheading(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    text = _esc(block.get("text") or "")
    color = _t_color(theme, "textBg", _DEFAULT_TEXT_HEADING)
    heading_font = _t_font(theme, "headingFont")
    font_decl = (
        f"font-family:{heading_font};"
        if theme and heading_font != _DEFAULT_FONT_STACK
        else ""
    )
    return (
        f'<h3 style="{font_decl}font-size:17px;font-weight:600;'
        f"letter-spacing:-0.01em;line-height:1.3;color:{color};"
        f'margin:20px 0 8px">{text}</h3>'
    )


def _render_badge(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    text = _esc(block.get("text") or "")
    bg = _t_color(theme, "primary", _DEFAULT_PRIMARY)
    fg = _t_color(theme, "textPrimary", _DEFAULT_TEXT_PRIMARY)
    return (
        f'<span style="display:inline-block;font-size:12px;'
        f"padding:5px 11px;background:{bg};color:{fg};"
        f'border-radius:999px;font-weight:500;margin:0 0 14px">{text}</span>'
    )


def _render_list(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    tag = "ol" if block.get("ordered") else "ul"
    items = block.get("items") or []
    if not isinstance(items, list):
        return ""

    def _item_text(it: Any) -> str:
        # Tolerate the legacy `string[]` shape and the canonical
        # `{id, text}` object shape — both still round-trip through saved
        # drafts on disk pre-migration.
        if isinstance(it, str):
            return it
        if isinstance(it, dict):
            text = it.get("text")
            return text if isinstance(text, str) else ""
        return ""

    # No theme → preserve the original "#3a3a3c" lighter list colour
    # so the parity test still matches byte-for-byte.
    color = _t_color(theme, "textBg", "#3a3a3c") if theme else "#3a3a3c"
    base_size = _t_int(theme, "typography", "baseSize", 14) if theme else 14
    cells = "".join(
        f'<li style="margin-bottom:4px">{_esc(_item_text(it))}</li>'
        for it in items
    )
    return (
        f'<{tag} style="margin:0 0 14px;padding-left:20px;color:{color};'
        f'font-size:{base_size}px;line-height:1.7">{cells}</{tag}>'
    )


def _render_quote(
    block: dict[str, Any], accent: str, theme: dict[str, Any] | None = None
) -> str:
    text = _esc(block.get("text") or "")
    cite_raw = block.get("cite")
    muted = _t_color(theme, "secondary", _DEFAULT_TEXT_MUTED) if theme else "#86868b"
    cite = (
        f'<div style="font-size:11.5px;color:{muted};margin-top:8px">'
        f"— {_esc(cite_raw)}</div>"
        if cite_raw
        else ""
    )
    text_color = _t_color(theme, "textBg", _DEFAULT_TEXT_HEADING) if theme else "#1d1d1f"
    bg = _t_color(theme, "postBg", "#fafafa") if theme else "#fafafa"
    # When the theme's post background is the same as the canvas, the
    # quote's subtle background no longer reads; nudge it darker. The
    # 4% mix toward textBg approximates the original #fafafa-on-white
    # contrast.
    if theme and bg == _t_color(theme, "postBg", "#fafafa"):
        bg = "#fafafa"
    radius = _t_int(theme, "spacing", "borderRadius", 8) if theme else 8
    return (
        f'<div style="margin:20px 0;padding:18px 22px;background:{bg};'
        f"border-left:3px solid {accent};border-radius:0 {radius}px {radius}px 0\">"
        f'<div style="font-size:15px;color:{text_color};line-height:1.55;'
        f'font-style:italic;letter-spacing:-0.01em">"{text}"</div>'
        f"{cite}</div>"
    )


def _render_columns(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    cols = block.get("cols") or []
    if not isinstance(cols, list) or not cols:
        return ""
    cells: list[str] = []
    for c in cols:
        if not isinstance(c, dict):
            continue
        parts: list[str] = []
        if c.get("label"):
            parts.append(
                f'<div style="font-size:10.5px;color:#86868b;'
                f'text-transform:uppercase;letter-spacing:0.06em;'
                f'font-weight:500;margin-bottom:4px">'
                f'{_esc(c["label"])}</div>'
            )
        if c.get("title"):
            parts.append(
                f'<div style="font-size:13px;font-weight:600;color:#1d1d1f;'
                f'margin-bottom:4px;letter-spacing:-0.005em">'
                f'{_esc(c["title"])}</div>'
            )
        if c.get("value"):
            parts.append(
                f'<div style="font-size:13px;font-weight:500;color:#1d1d1f">'
                f'{_esc(c["value"])}</div>'
            )
        if c.get("body"):
            parts.append(
                f'<div style="font-size:11.5px;line-height:1.5;'
                f'color:#6e6e73">{_esc(c["body"])}</div>'
            )
        cells.append(
            f'<td style="background:#fafafa;padding:14px;border-radius:8px;'
            f'border:1px solid #efefef;vertical-align:top;width:33%">'
            f'{"".join(parts)}</td>'
        )
    return (
        '<table role="presentation" cellspacing="0" cellpadding="0" '
        'border="0" style="width:100%;margin:18px 0"><tr>'
        + '<td width="12"></td>'.join(cells)
        + "</tr></table>"
    )


def _render_checklist(
    block: dict[str, Any], accent: str, theme: dict[str, Any] | None = None
) -> str:
    items = block.get("items") or []
    if not isinstance(items, list):
        return ""
    rows: list[str] = []
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            continue
        title = _esc(it.get("title") or "")
        body_raw = it.get("body")
        body = (
            f'<div style="font-size:12px;color:#6e6e73;line-height:1.5">'
            f"{_esc(body_raw)}</div>"
            if body_raw
            else ""
        )
        rows.append(
            f"<tr>"
            f'<td valign="top" style="width:34px">'
            f'<div style="width:22px;height:22px;border-radius:50%;'
            f"background:{accent};color:#fff;display:inline-block;"
            f'text-align:center;line-height:22px;font-size:11px;'
            f'font-weight:600">{i + 1}</div></td>'
            f'<td style="padding-left:12px">'
            f'<div style="font-size:13.5px;font-weight:600;color:#1d1d1f;'
            f'margin-bottom:2px">{title}</div>{body}</td></tr>'
        )
    return (
        '<table role="presentation" cellspacing="0" cellpadding="0" '
        'border="0" style="margin:16px 0;background:#fafafa;'
        'border:1px solid #efefef;border-radius:8px;padding:14px;'
        'width:100%">'
        + '<tr><td colspan="2" height="10"></td></tr>'.join(rows)
        + "</table>"
    )


def _render_event_card(
    block: dict[str, Any], accent: str, theme: dict[str, Any] | None = None
) -> str:
    return (
        f'<table role="presentation" cellspacing="0" cellpadding="0" '
        f'border="0" style="margin:8px 0 18px;width:100%;background:{accent};'
        f'color:#fff;border-radius:10px"><tr><td style="padding:20px">'
        f'<table role="presentation" cellspacing="0" cellpadding="0" '
        f'border="0"><tr><td valign="top" style="width:80px;'
        f'padding-right:18px"><div style="background:rgba(255,255,255,0.15);'
        f'border-radius:8px;padding:10px;text-align:center">'
        f'<div style="font-size:10px;letter-spacing:0.1em;opacity:0.8">'
        f'{_esc(block.get("day"))}</div>'
        f'<div style="font-size:18px;font-weight:700;'
        f'letter-spacing:-0.02em;margin-top:2px">'
        f'{_esc(block.get("date"))}</div></div></td><td>'
        f'<div style="font-size:11px;opacity:0.7;text-transform:uppercase;'
        f'letter-spacing:0.1em;margin-bottom:6px">You\'re invited</div>'
        f'<div style="font-size:17px;font-weight:600;letter-spacing:-0.01em;'
        f'margin-bottom:6px;line-height:1.25">{_esc(block.get("title"))}</div>'
        f'<div style="font-size:12px;opacity:0.85">'
        f'{_esc(block.get("meta"))}</div></td></tr></table>'
        f"</td></tr></table>"
    )


def _render_receipt(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    items = block.get("items") or []
    if not isinstance(items, list):
        return ""
    rows: list[str] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        sub = (
            f'<div style="font-size:11.5px;color:#86868b;margin-top:2px">'
            f'{_esc(it.get("sub"))}</div>'
            if it.get("sub")
            else ""
        )
        rows.append(
            f'<tr><td style="padding:10px 0;border-bottom:1px solid #efefef">'
            f'<div style="font-size:13.5px;font-weight:500;color:#1d1d1f">'
            f'{_esc(it.get("name"))}</div>{sub}</td>'
            f'<td align="right" style="padding:10px 0;'
            f'border-bottom:1px solid #efefef;font-size:13.5px;'
            f'font-weight:600;font-family:monospace">'
            f'{_esc(it.get("price"))}</td></tr>'
        )
    total = _esc(block.get("total") or "")
    return (
        '<table role="presentation" cellspacing="0" cellpadding="0" '
        'border="0" style="margin:16px 0;background:#fafafa;'
        'border:1px solid #efefef;border-radius:10px;padding:20px;'
        'width:100%">'
        + "".join(rows)
        + f'<tr><td style="padding-top:12px;border-top:2px solid #1d1d1f;'
        f'font-size:13px;font-weight:600">Total</td>'
        f'<td align="right" style="padding-top:12px;'
        f'border-top:2px solid #1d1d1f;font-size:15px;font-weight:700;'
        f'font-family:monospace">{total}</td></tr></table>'
    )


def _render_digest_item(
    block: dict[str, Any], accent: str, theme: dict[str, Any] | None = None
) -> str:
    return (
        f'<table role="presentation" cellspacing="0" cellpadding="0" '
        f'border="0" style="margin:14px 0;width:100%"><tr>'
        f'<td valign="top" style="width:48px;font-size:20px;font-weight:700;'
        f'color:{accent};font-family:monospace;line-height:1">'
        f'{_esc(block.get("num"))}</td>'
        f'<td style="padding-left:14px">'
        f'<div style="font-size:15px;font-weight:600;color:#1d1d1f;'
        f'letter-spacing:-0.01em;margin-bottom:3px;line-height:1.3">'
        f'{_esc(block.get("title"))}</div>'
        f'<div style="font-size:11px;color:#86868b;text-transform:uppercase;'
        f'letter-spacing:0.05em;margin-bottom:5px">'
        f'{_esc(block.get("meta"))}</div>'
        f'<div style="font-size:13px;color:#3a3a3c;line-height:1.55">'
        f'{_esc(block.get("body"))}</div></td></tr></table>'
    )


def _render_pull(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    text = _esc(block.get("text") or "")
    color = _t_color(theme, "textBg", _DEFAULT_TEXT_HEADING) if theme else "#1d1d1f"
    # Pull quotes intentionally use the serif `bodyFont` when themed
    # (so the typographic break reads). Without a theme they default
    # to the historical Georgia stack so the parity test holds.
    if theme:
        font_decl = _t_font(theme, "bodyFont")
        if font_decl == _DEFAULT_FONT_STACK:
            font_decl = _FONT_STACKS["Newsreader"]
    else:
        font_decl = "Georgia,'New York','Iowan Old Style',serif"
    return (
        f'<div style="margin:36px 0;padding:0 16px;text-align:center;'
        f"font-family:{font_decl};"
        f"font-size:24px;line-height:1.35;color:{color};"
        f'font-style:italic;letter-spacing:-0.01em">'
        f"“{text}”</div>"
    )


def _render_callout(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    label_raw = block.get("label")
    body = _paragraph_text(block.get("text") or "")
    muted = _t_color(theme, "secondary", _DEFAULT_TEXT_MUTED) if theme else "#86868b"
    text_color = _t_color(theme, "textBg", _DEFAULT_TEXT_HEADING) if theme else "#1d1d1f"
    border = _t_color(theme, "hairline", _DEFAULT_HAIRLINE) if theme else "#e8e8ed"
    bg = _t_color(theme, "postBg", _DEFAULT_CARD_BG) if theme else "#fafafa"
    # Same nudge as quote: if the theme makes the card bg equal the
    # canvas, fall back to a recessed shade so the callout still reads.
    if theme:
        bg = "#fafafa"  # callouts always need a subtle lift; theme drives
        # the border colour which carries the visual weight instead.
    radius = _t_int(theme, "spacing", "borderRadius", 8) if theme else 10
    label = (
        f'<div style="font-size:11px;letter-spacing:0.1em;'
        f"text-transform:uppercase;color:{muted};font-weight:600;"
        f'margin-bottom:6px">{_esc(label_raw)}</div>'
        if label_raw
        else ""
    )
    return (
        f'<div style="margin:24px 0;padding:18px 22px;'
        f"border:1px solid {border};border-radius:{radius}px;background:{bg}\">"
        f"{label}"
        f'<div style="font-size:15px;line-height:1.6;color:{text_color}">'
        f"{body}</div></div>"
    )


def _render_gallery(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    images = block.get("images") or []
    if not isinstance(images, list):
        return ""
    cells: list[str] = []
    for img in images:
        if not isinstance(img, dict):
            continue
        src = _safe_url(img.get("src"))
        if not src:
            continue
        alt = _attr(img.get("alt") or "")
        caption_raw = img.get("caption")
        caption = (
            f'<div style="font-size:11.5px;color:#86868b;'
            f'margin-top:6px;text-align:center;line-height:1.4">'
            f"{_esc(caption_raw)}</div>"
            if caption_raw
            else ""
        )
        cells.append(
            f'<td valign="top" style="vertical-align:top;width:50%;'
            f'padding:0 4px">'
            f'<img src="{_attr(src)}" alt="{alt}" '
            f'style="max-width:100%;height:auto;display:block;'
            f'border-radius:8px">{caption}</td>'
        )
    if not cells:
        return ""
    return (
        '<table role="presentation" cellspacing="0" cellpadding="0" '
        'border="0" style="width:100%;margin:20px 0"><tr>'
        + "".join(cells)
        + "</tr></table>"
    )


def _render_embed(block: dict[str, Any], theme: dict[str, Any] | None = None) -> str:
    # Email clients won't load arbitrary iframes — fall back to a card
    # with the URL and an optional caption. Once oEmbed resolution lands
    # server-side we can swap to a preview thumbnail.
    url = _safe_url(block.get("url"))
    if not url:
        return ""
    caption_raw = block.get("caption")
    caption = (
        f'<div style="font-size:12px;color:#86868b;margin-top:8px">'
        f"{_esc(caption_raw)}</div>"
        if caption_raw
        else ""
    )
    return (
        f'<div style="margin:22px 0;padding:18px 22px;'
        f'border:1px solid #e8e8ed;border-radius:10px;background:#fafafa">'
        f'<div style="font-size:11px;letter-spacing:0.1em;'
        f'text-transform:uppercase;color:#86868b;font-weight:600;'
        f'margin-bottom:6px">Embed</div>'
        f'<a href="{_attr(url)}" target="_blank" rel="noreferrer" '
        f'style="font-size:14px;color:#1d1d1f;word-break:break-all;'
        f'text-decoration:none">{_esc(url)}</a>'
        f"{caption}</div>"
    )


def _render_poll(
    block: dict[str, Any], accent: str, theme: dict[str, Any] | None = None
) -> str:
    question = _esc(block.get("question") or "")
    options = block.get("options") or []
    if not isinstance(options, list):
        options = []
    rows: list[str] = []
    for opt in options:
        if not isinstance(opt, dict):
            continue
        text = _esc(opt.get("text") or "")
        rows.append(
            f'<tr><td style="padding:10px 14px;border:1px solid #e8e8ed;'
            f'border-radius:8px;font-size:14px;color:#1d1d1f;'
            f'background:#ffffff">{text}</td></tr>'
            f'<tr><td height="8"></td></tr>'
        )
    body = "".join(rows) if rows else (
        '<tr><td style="font-size:13px;color:#86868b">'
        "(No options yet)</td></tr>"
    )
    return (
        f'<div style="margin:24px 0;padding:20px;border:1px solid #e8e8ed;'
        f'border-radius:12px;background:#fafafa">'
        f'<div style="font-size:11px;letter-spacing:0.1em;'
        f'text-transform:uppercase;color:{accent};font-weight:600;'
        f'margin-bottom:8px">Poll</div>'
        f'<div style="font-size:16px;font-weight:600;color:#1d1d1f;'
        f'margin-bottom:14px;letter-spacing:-0.01em">{question}</div>'
        f'<table role="presentation" cellspacing="0" cellpadding="0" '
        f'border="0" style="width:100%">{body}</table></div>'
    )


def _render_paywall(
    block: dict[str, Any], accent: str, theme: dict[str, Any] | None = None
) -> str:
    # The block is a marker — at send time, per-recipient render decides
    # whether to keep showing content past this point or truncate. This
    # function renders the "subscribe to continue" card itself; the
    # truncation lives in the publish task / web archive route.
    headline = _esc(block.get("headline") or "Subscribe to keep reading")
    body_raw = block.get("body") or (
        "The rest of this post is for paying subscribers."
    )
    body = _paragraph_text(body_raw)
    cta_text = _esc(block.get("cta_text") or "Become a subscriber")
    cta_url = _safe_url(block.get("cta_url"))
    cta = (
        f'<a href="{_attr(cta_url)}" target="_blank" rel="noreferrer" '
        f'style="display:inline-block;background:{accent};color:#fff;'
        f'padding:11px 22px;border-radius:8px;font-size:14px;'
        f'font-weight:500;text-decoration:none;margin-top:14px">'
        f"{cta_text}</a>"
        if cta_url
        else (
            f'<span style="display:inline-block;background:{accent};'
            f'color:#fff;padding:11px 22px;border-radius:8px;'
            f'font-size:14px;font-weight:500;margin-top:14px">'
            f"{cta_text}</span>"
        )
    )
    return (
        f'<div style="margin:32px 0;padding:28px;border:1px solid #e8e8ed;'
        f'border-radius:14px;background:#ffffff;text-align:center">'
        f'<div style="font-size:11px;letter-spacing:0.12em;'
        f'text-transform:uppercase;color:{accent};font-weight:700;'
        f'margin-bottom:10px">✨ Members only</div>'
        f'<div style="font-size:20px;font-weight:600;color:#1d1d1f;'
        f'letter-spacing:-0.01em;margin-bottom:8px">{headline}</div>'
        f'<div style="font-size:14px;line-height:1.55;color:#6e6e73">'
        f"{body}</div>{cta}</div>"
    )


def _render_audio(
    block: dict[str, Any], accent: str, theme: dict[str, Any] | None = None
) -> str:
    # Email clients ignore <audio>. Render a styled play card linking
    # out to the hosted audio. The web archive substitutes a native
    # <audio> element using the same `src`.
    target = _safe_url(block.get("embed_url")) or _safe_url(block.get("src"))
    if not target:
        return ""
    title = _esc(block.get("title") or "Listen to this issue")
    duration = block.get("duration_seconds")
    meta = ""
    if isinstance(duration, (int, float)) and duration > 0:
        minutes = int(duration // 60)
        seconds = int(duration % 60)
        meta = (
            f'<div style="font-size:11.5px;color:#86868b;margin-top:2px">'
            f"{minutes}:{seconds:02d}</div>"
        )
    return (
        f'<a href="{_attr(target)}" target="_blank" rel="noreferrer" '
        f'style="display:block;text-decoration:none;margin:22px 0">'
        f'<table role="presentation" cellspacing="0" cellpadding="0" '
        f'border="0" style="width:100%;background:#fafafa;'
        f'border:1px solid #e8e8ed;border-radius:12px"><tr>'
        f'<td style="width:54px;padding:14px 0 14px 16px">'
        f'<div style="width:40px;height:40px;border-radius:50%;'
        f'background:{accent};color:#fff;display:inline-block;'
        f'text-align:center;line-height:40px;font-size:14px">▶</div></td>'
        f'<td style="padding:14px 16px">'
        f'<div style="font-size:14px;font-weight:600;color:#1d1d1f;'
        f'letter-spacing:-0.005em">{title}</div>{meta}</td>'
        f"</tr></table></a>"
    )


def _safe_color(color: Any) -> str:
    if not isinstance(color, str):
        return "#1d1d1f"
    s = color.strip()
    import re as _re

    if _re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", s):
        return s
    return "#1d1d1f"


def _render_button_with_accent(
    block: dict[str, Any], accent: str, theme: dict[str, Any] | None = None
) -> str:
    url = _safe_url(block.get("url"))
    text = _esc(block.get("text") or "Learn more")
    size = block.get("size")
    padding = (
        "13px 28px"
        if size == "lg"
        else "8px 16px"
        if size == "sm"
        else "10px 20px"
    )
    font_size = "14px" if size == "lg" else "13px"
    # When a theme is in play, `accent` carries the per-doc colour or
    # the theme's `primary`. The text-on-button colour comes from the
    # theme's `textPrimary` so dark / light themes stay readable.
    fg = _t_color(theme, "textPrimary", _DEFAULT_TEXT_PRIMARY) if theme else "#ffffff"
    radius = _t_int(theme, "spacing", "borderRadius", 8) if theme else 8
    style = (
        f"display:inline-block;background:{accent};color:{fg};"
        f"padding:{padding};border-radius:{radius}px;font-size:{font_size};"
        f"font-weight:500;text-decoration:none"
    )
    if not url:
        return (
            f'<div style="{_BUTTON_WRAPPER_STYLE}">'
            f'<span style="{style}">{text}</span></div>'
        )
    return (
        f'<div style="{_BUTTON_WRAPPER_STYLE}">'
        f'<a href="{_attr(url)}" target="_blank" rel="noreferrer" '
        f'style="{style}">{text}</a></div>'
    )


def render_blocks_to_html(
    content_json: dict[str, Any] | None,
    theme: dict[str, Any] | None = None,
) -> str:
    """Render the block document to a string of email-safe HTML.

    Returns an empty string if there's nothing to render — callers can
    choose to fall back to a stored `content_html` (or a placeholder)
    in that case.

    ``theme`` is a fully-resolved theme dict (see
    `polar.newsletter.theme.resolve_theme`). When omitted, the
    renderer falls back to the hard-coded constants that match the
    original output — broadcasts that predate theming render
    identically, and the existing parity fixture / golden still
    passes byte-for-byte.

    Accent precedence: when a theme is supplied, the theme's `primary`
    colour is used as the per-doc accent unless the document already
    has a top-level `accent` field (broadcasts use this; newsletters
    don't). This keeps the broadcast accent picker working and lets
    themed newsletters rely on `primary` as the brand colour.
    """
    if not content_json:
        return ""
    blocks = content_json.get("blocks") or []
    if not isinstance(blocks, list):
        return ""

    doc_accent = content_json.get("accent")
    if isinstance(doc_accent, str) and doc_accent:
        accent = _safe_color(doc_accent)
    elif theme is not None:
        accent = _t_color(theme, "primary", _DEFAULT_PRIMARY)
    else:
        accent = _safe_color(doc_accent)

    rendered: list[str] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        block_type = block.get("type")
        chunk: str = ""
        if block_type == "heading":
            chunk = _render_heading(block, theme)
        elif block_type == "paragraph":
            chunk = _render_paragraph(block, theme)
        elif block_type == "image":
            chunk = _render_image(block, theme)
        elif block_type == "button":
            chunk = _render_button_with_accent(block, accent, theme)
        elif block_type == "divider":
            chunk = _render_divider(block, theme)
        elif block_type == "video":
            chunk = _render_video(block, theme)
        elif block_type == "eyebrow":
            chunk = _render_eyebrow(block, accent, theme)
        elif block_type == "subheading":
            chunk = _render_subheading(block, theme)
        elif block_type == "badge":
            chunk = _render_badge(block, theme)
        elif block_type == "list":
            chunk = _render_list(block, theme)
        elif block_type == "quote":
            chunk = _render_quote(block, accent, theme)
        elif block_type == "columns":
            chunk = _render_columns(block, theme)
        elif block_type == "checklist":
            chunk = _render_checklist(block, accent, theme)
        elif block_type == "event-card":
            chunk = _render_event_card(block, accent, theme)
        elif block_type == "receipt":
            chunk = _render_receipt(block, theme)
        elif block_type == "digest-item":
            chunk = _render_digest_item(block, accent, theme)
        elif block_type == "pull":
            chunk = _render_pull(block, theme)
        elif block_type == "callout":
            chunk = _render_callout(block, theme)
        elif block_type == "gallery":
            chunk = _render_gallery(block, theme)
        elif block_type == "embed":
            chunk = _render_embed(block, theme)
        elif block_type == "poll":
            chunk = _render_poll(block, accent, theme)
        elif block_type == "paywall":
            chunk = _render_paywall(block, accent, theme)
        elif block_type == "audio":
            chunk = _render_audio(block, accent, theme)
        if chunk:
            rendered.append(chunk)
    return "\n".join(rendered)
