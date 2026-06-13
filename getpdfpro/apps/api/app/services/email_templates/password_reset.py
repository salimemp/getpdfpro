"""
Password-reset email — sent when the user clicks "Forgot password".

Reassures the user that the link expires quickly and that their
account is safe if they didn't request it.
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


def render_password_reset_email(
    reset_url: str,
    locale: str = "en",
    *,
    email: str | None = None,
) -> tuple[str, str, str]:
    """
    Build the password-reset message.

    Args:
        reset_url: Absolute one-click URL to choose a new password.
        locale: One of en/es/ar/hi.
        email: Optional — include the affected account address in
               the body so the user can verify it's their request.

    Returns:
        (subject, html, text)
    """
    preheader = _t(locale, "reset.preheader")
    subject = _t(locale, "reset.subject")

    body_text_intro = _t(
        locale,
        "reset.body",
        email=email or "your account",
    )

    body = (
        heading(_t(locale, "reset.heading"))
        + paragraph(body_text_intro)
        + cta_button(reset_url, _t(locale, "reset.cta"))
        + paragraph(
            _t(locale, "reset.expiry"),
            color="#475569",
            size=14,
        )
        + paragraph(
            _t(locale, "reset.ignore"),
            color="#475569",
            size=14,
        )
    )

    html = wrap_html(preheader=preheader, body_html=body, locale=locale)
    text_body = html_to_text(body)
    fallback = _t(locale, "common.cta_fallback") + f"\n{reset_url}"
    text = build_text(
        preheader=preheader,
        body_text=text_body + f"\n\n{fallback}",
        locale=locale,
    )

    return subject, html, text
