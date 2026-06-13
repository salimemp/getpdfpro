"""
Email verification — confirms ownership of the email address.

Used both on initial signup (Supabase re-sends to the same address
on confirmation) and on email-change requests.
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


def render_verification_email(
    verification_url: str,
    locale: str = "en",
) -> tuple[str, str, str]:
    """
    Build the email-verification message.

    Args:
        verification_url: Absolute one-click confirmation URL.
        locale: One of en/es/ar/hi.

    Returns:
        (subject, html, text)
    """
    preheader = _t(locale, "verify.preheader")
    subject = _t(locale, "verify.subject")

    body = (
        heading(_t(locale, "verify.heading"))
        + paragraph(_t(locale, "verify.body"))
        + cta_button(verification_url, _t(locale, "verify.cta"))
        + paragraph(
            _t(locale, "verify.expiry"),
            color="#475569",
            size=14,
        )
        + paragraph(
            _t(locale, "verify.ignore"),
            color="#475569",
            size=14,
        )
    )

    html = wrap_html(preheader=preheader, body_html=body, locale=locale)
    text_body = html_to_text(body)
    fallback = _t(locale, "common.cta_fallback") + f"\n{verification_url}"
    text = build_text(
        preheader=preheader,
        body_text=text_body + f"\n\n{fallback}",
        locale=locale,
    )

    return subject, html, text
