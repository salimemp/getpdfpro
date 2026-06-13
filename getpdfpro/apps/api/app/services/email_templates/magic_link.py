"""
Magic-link sign-in — passwordless login link.

Different copy from password reset: shorter expiry (15 min vs 30),
single-use framing, and a softer "no password required" tone.
"""

from __future__ import annotations

from app.services.email_templates.common import (
    BRAND_NAME,
    _t,
    build_text,
    cta_button,
    heading,
    html_to_text,
    paragraph,
    wrap_html,
)


def render_magic_link_email(
    login_url: str,
    locale: str = "en",
) -> tuple[str, str, str]:
    """
    Build the magic-link sign-in message.

    Args:
        login_url: Absolute one-click sign-in URL.
        locale: One of en/es/ar/hi.

    Returns:
        (subject, html, text)
    """
    preheader = _t(locale, "magic.preheader")
    subject = _t(locale, "magic.subject")

    body = (
        heading(_t(locale, "magic.heading"))
        + paragraph(_t(locale, "magic.body"))
        + cta_button(login_url, _t(locale, "magic.cta"))
        + paragraph(
            _t(locale, "magic.expiry"),
            color="#475569",
            size=14,
        )
        + paragraph(
            _t(locale, "magic.ignore"),
            color="#475569",
            size=14,
        )
    )

    html = wrap_html(preheader=preheader, body_html=body, locale=locale)
    text_body = html_to_text(body)
    fallback = _t(locale, "common.cta_fallback") + f"\n{login_url}"
    text = build_text(
        preheader=preheader,
        body_text=text_body + f"\n\n{fallback}",
        locale=locale,
    )

    return subject, html, text
