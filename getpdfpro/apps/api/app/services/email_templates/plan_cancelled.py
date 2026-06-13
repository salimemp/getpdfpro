"""
Plan-cancelled email — sent when a user cancels their subscription.

Reassures them they keep paid access until the period end, and
offers a one-click reactivate flow. Tone is friendly, not pushy —
they already cancelled, don't guilt-trip them.
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


def render_plan_cancelled_email(
    period_end: datetime | str,
    locale: str = "en",
    *,
    plan: str | None = None,
    reactivate_url: str | None = None,
    timezone: str = "UTC",
) -> tuple[str, str, str]:
    """
    Build the plan-cancelled email.

    Args:
        period_end: datetime (or ISO date string) of when paid
                    access ends.
        locale: One of en/es/ar/hi.
        plan: Display name of the cancelled plan (e.g. "Pro").
              If omitted, copy uses "your subscription".
        reactivate_url: Optional absolute URL to reactivate. If
                        omitted the CTA is omitted.
        timezone: IANA timezone for the date display.

    Returns:
        (subject, html, text)
    """
    preheader = _t(locale, "cancelled.preheader", date="")
    subject = _t(locale, "cancelled.subject")

    if isinstance(period_end, str):
        try:
            dt = datetime.fromisoformat(period_end)
        except ValueError:
            dt = datetime.strptime(period_end, "%Y-%m-%d")
    else:
        dt = period_end

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    try:
        dt_local = dt.astimezone(ZoneInfo(timezone))
    except Exception:
        dt_local = dt
    date_display = dt_local.strftime("%B %d, %Y")

    plan_label = plan or "your subscription"

    body = (
        heading(_t(locale, "cancelled.heading"))
        + paragraph(
            _t(
                locale,
                "cancelled.body",
                plan=plan_label,
                date=date_display,
            )
        )
        + paragraph(
            _t(locale, "cancelled.resume"),
            color="#475569",
            size=14,
        )
    )
    if reactivate_url:
        body += cta_button(reactivate_url, _t(locale, "cancelled.cta"))

    html = wrap_html(preheader=preheader, body_html=body, locale=locale)
    text_body = html_to_text(body)
    text_kwargs: dict = {"preheader": preheader, "body_text": text_body, "locale": locale}
    if reactivate_url:
        fallback = _t(locale, "common.cta_fallback") + f"\n{reactivate_url}"
        text_kwargs["body_text"] = text_body + f"\n\n{fallback}"
    text = build_text(**text_kwargs)

    return subject, html, text
