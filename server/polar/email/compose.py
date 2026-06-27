"""Finalise an email body into the HTML that is actually sent.

The course email editor produces a COMPLETE, self-contained HTML document —
its own ``<!doctype html>``, ``<head>`` with the responsive ``<style>``, web
fonts, dark background, and a footer carrying the unsubscribe link. Such a
document must be sent verbatim.

Wrapping it in the ``MarketingEmail`` React-Email template (as every send path
used to) injects a whole document inside a ``<div>`` via
``dangerouslySetInnerHTML``. Email clients then discard the nested ``<head>``/
``<style>`` (killing the mobile media queries, ``color-scheme`` and fonts) and
render the body inside the wrapper's narrow, white ``Container`` — which is
exactly the reported "email is too tight / white on mobile / editor changes do
nothing" failure.

Legacy fragment bodies (e.g. ``<h2>..</h2><p>..</p>`` from the simple composer)
are NOT self-contained and still get the marketing chrome.
"""

from polar.email.react import render_email_template
from polar.email.schemas import MarketingEmail, MarketingEmailProps


def is_full_html_document(html: str | None) -> bool:
    """True when ``html`` is a complete document (starts with a doctype/<html>)."""
    head = (html or "").lstrip()[:256].lower()
    return head.startswith("<!doctype") or head.startswith("<html")


def finalize_email_html(
    content_html: str,
    *,
    unsubscribe_url: str,
    organization_name: str,
    organization_logo_url: str | None = None,
    organization_website: str | None = None,
    preview_text: str | None = None,
) -> str:
    """Return the final send-ready HTML for ``content_html``.

    A self-contained editor email is returned as-is (only its
    ``{{unsubscribe_url}}`` footer placeholder is filled in); anything else is
    wrapped in the shared marketing template.
    """
    if is_full_html_document(content_html):
        return content_html.replace("{{unsubscribe_url}}", unsubscribe_url)
    return render_email_template(
        MarketingEmail(
            props=MarketingEmailProps(
                organization_name=organization_name,
                organization_logo_url=organization_logo_url,
                organization_website=organization_website,
                html_content=content_html,
                unsubscribe_url=unsubscribe_url,
                preview_text=preview_text,
            )
        )
    )


__all__ = ["finalize_email_html", "is_full_html_document"]
