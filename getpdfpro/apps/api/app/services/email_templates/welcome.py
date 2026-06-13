"""
Welcome email — sent right after a successful signup.

Greets the user by name, points them at the dashboard, and seeds a
quick AI tip so the first session doesn't feel empty.
"""

from __future__ import annotations

from app.services.email_templates.common import (
    BRAND_NAME,
    _t,
    build_text,
    cta_button,
    fallback_text_block,
    heading,
    html_to_text,
    info_panel,
    paragraph,
    wrap_html,
)


def render_welcome_email(
    name: str,
    dashboard_url: str,
    locale: str = "en",
) -> tuple[str, str, str]:
    """
    Build the welcome email.

    Args:
        name: User's display name (falls back to a friendly default
              if empty).
        dashboard_url: Absolute URL to the post-login dashboard.
        locale: One of en/es/ar/hi.

    Returns:
        (subject, html, text)
    """
    # Always have a name to greet — empty strings are common when
    # OAuth signup comes through before the user fills in profile.
    display_name = name.strip() if name else ""
    greeting_key = "common.hello" if display_name else "common.hello_generic"
    greeting_vars: dict[str, str] = {"name": display_name} if display_name else {}

    preheader = _t(locale, "welcome.preheader")
    subject = _t(locale, "welcome.subject")

    body = (
        heading(_t(locale, "welcome.heading"))
        + paragraph(_t(locale, "welcome.body", **greeting_vars))
        + paragraph(_t(locale, "welcome.body_short"))
        + cta_button(dashboard_url, _t(locale, "welcome.cta"))
        + info_panel(
            "<p style=\"margin:0 0 6px 0;font-weight:600;color:"
            + "inherit;font-size:14px;\">"
            + _t(locale, "welcome.tip_title")
            + "</p>"
            + "<p style=\"margin:0;font-size:14px;color:inherit;\">"
            + _t(locale, "welcome.tip_body")
            + "</p>"
        )
        + paragraph(_t(locale, "common.signature"))
    )

    html = wrap_html(preheader=preheader, body_html=body, locale=locale)

    # Plain-text mirror — derived from the same body so nothing
    # drifts.
    text_body = html_to_text(body)
    fallback = _t(locale, "common.cta_fallback") + f"\n{dashboard_url}"
    text = build_text(
        preheader=preheader,
        body_text=text_body + f"\n\n{fallback}",
        locale=locale,
    )

    return subject, html, text
