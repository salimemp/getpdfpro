"""
Plan-upgraded email — sent on a successful plan change (Free → Pro,
Pro → Team, etc.).

Confirms the new plan, calls out the next billing date, and links to
the user's new tools so they can poke around right away.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

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


def render_plan_upgraded_email(
    plan: str,
    next_billing_date: datetime | str,
    locale: str = "en",
    *,
    explore_url: str | None = None,
    timezone: str = "UTC",
) -> tuple[str, str, str]:
    """
    Build the plan-upgraded email.

    Args:
        plan: Display name of the new plan ("Pro", "Team", ...).
        next_billing_date: datetime (or ISO date string) of the
                           next billing run.
        locale: One of en/es/ar/hi.
        explore_url: Optional absolute URL to the dashboard. If
                     omitted the CTA is omitted.
        timezone: IANA timezone for the date display.

    Returns:
        (subject, html, text)
    """
    preheader = _t(locale, "upgraded.preheader", plan=plan)
    subject = _t(locale, "upgraded.subject", plan=plan)

    if isinstance(next_billing_date, str):
        # Accept either YYYY-MM-DD or full ISO.
        try:
            dt = datetime.fromisoformat(next_billing_date)
        except ValueError:
            dt = datetime.strptime(next_billing_date, "%Y-%m-%d")
    else:
        dt = next_billing_date

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    try:
        dt_local = dt.astimezone(ZoneInfo(timezone))
    except Exception:
        dt_local = dt
    date_display = dt_local.strftime("%B %d, %Y")

    body = (
        heading(_t(locale, "upgraded.heading", plan=plan))
        + paragraph(_t(locale, "upgraded.body", plan=plan))
        + paragraph(
            _t(locale, "upgraded.next_billing", date=date_display),
            color="#475569",
            size=14,
        )
    )
    if explore_url:
        body += cta_button(explore_url, _t(locale, "upgraded.cta"))

    html = wrap_html(preheader=preheader, body_html=body, locale=locale)
    text_body = html_to_text(body)
    text_kwargs: dict = {"preheader": preheader, "body_text": text_body, "locale": locale}
    if explore_url:
        fallback = _t(locale, "common.cta_fallback") + f"\n{explore_url}"
        text_kwargs["body_text"] = text_body + f"\n\n{fallback}"
    text = build_text(**text_kwargs)

    return subject, html, text
