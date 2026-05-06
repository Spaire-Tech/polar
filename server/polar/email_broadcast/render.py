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
"""

from __future__ import annotations

import html
from typing import Any


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


def _render_heading(block: dict[str, Any]) -> str:
    level = block.get("level") or 1
    if level not in (1, 2, 3):
        level = 1
    style = _HEADING_STYLES[level]
    text = _esc(block.get("text") or "")
    return f'<h{level} style="{style}">{text}</h{level}>'


def _render_paragraph(block: dict[str, Any]) -> str:
    text = _paragraph_text(block.get("text") or "")
    return f'<p style="{_PARAGRAPH_STYLE}">{text}</p>'


def _render_image(block: dict[str, Any]) -> str:
    src = _safe_url(block.get("src"))
    if not src:
        return ""
    alt = _attr(block.get("alt") or "")
    img = f'<img src="{_attr(src)}" alt="{alt}" style="{_IMAGE_STYLE}">'
    href = _safe_url(block.get("href"))
    inner = f'<a href="{_attr(href)}" target="_blank" rel="noreferrer">{img}</a>' if href else img
    return f'<div style="margin:20px 0">{inner}</div>'


def _render_button(block: dict[str, Any]) -> str:
    url = _safe_url(block.get("url"))
    text = _esc(block.get("text") or "Learn more")
    if not url:
        # Render the text but skip the link if the URL is missing/invalid.
        return f'<div style="{_BUTTON_WRAPPER_STYLE}"><span style="{_BUTTON_STYLE}">{text}</span></div>'
    return (
        f'<div style="{_BUTTON_WRAPPER_STYLE}">'
        f'<a href="{_attr(url)}" target="_blank" rel="noreferrer" '
        f'style="{_BUTTON_STYLE}">{text}</a>'
        f"</div>"
    )


def _render_divider(_block: dict[str, Any]) -> str:
    return f'<hr style="{_DIVIDER_STYLE}">'


def _render_video(block: dict[str, Any]) -> str:
    # Prefer the embed link; fall back to a direct file URL. Thumbnail
    # defaults to the same URL when none is given.
    target = _safe_url(block.get("embed_url")) or _safe_url(block.get("src"))
    if not target:
        return ""
    thumb = _safe_url(block.get("thumbnail")) or target
    return (
        f'<div style="margin:24px 0">'
        f'<a href="{_attr(target)}" target="_blank" rel="noreferrer">'
        f'<img src="{_attr(thumb)}" alt="Watch video" style="{_VIDEO_THUMB_STYLE}">'
        f"</a>"
        f"</div>"
    )


_RENDERERS = {
    "heading": _render_heading,
    "paragraph": _render_paragraph,
    "image": _render_image,
    "button": _render_button,
    "divider": _render_divider,
    "video": _render_video,
}


def render_blocks_to_html(content_json: dict[str, Any] | None) -> str:
    """Render the block document to a string of email-safe HTML.

    Returns an empty string if there's nothing to render — callers can choose
    to fall back to a stored `content_html` (or a placeholder) in that case.
    """
    if not content_json:
        return ""
    blocks = content_json.get("blocks") or []
    if not isinstance(blocks, list):
        return ""

    rendered: list[str] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        renderer = _RENDERERS.get(block.get("type"))
        if renderer is None:
            continue
        chunk = renderer(block)
        if chunk:
            rendered.append(chunk)
    return "\n".join(rendered)
