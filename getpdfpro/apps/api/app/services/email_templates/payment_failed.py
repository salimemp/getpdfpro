"""
Payment-failed email — sent when a charge doesn't go through.

Urgent copy, danger-colored CTA, and a "common reasons" panel so
the user can self-diagnose before contacting support.
"""

from __future__ import annotations

from app.services.email_templates.common import (
    BRAND_DANGER,
    _t,
    build_text,
    cta_button,
    currency_format,
    heading,
    html_to_text,
    info_panel,
    paragraph,
    wrap_html,
)


def render_payment_failed_email(
    amount: float,
    currency: str,
    plan: str,
    update_payment_url: str,
    locale: str = "en",
) -> tuple[str, str, str]:
    """
    Build the payment-failed email.

    Args:
        amount: Numeric amount in the given currency.
        currency: ISO currency code.
        plan: Display name of the plan ("Pro", "Team", ...).
        update_payment_url: Absolute URL to the payment-method
                            update page.
        locale: One of en/es/ar/hi.

    Returns:
        (subject, html, text)
    """
    preheader = _t(locale, "failed.preheader")
    subject = _t(locale, "failed.subject")

    formatted_amount = currency_format(amount, currency)

    reasons_html = (
        f'<p style="margin:0 0 8px 0;font-weight:600;font-size:14px;">'
        f'{_t(locale, "failed.reason_title")}</p>'
        f'<ul style="margin:0;padding-' + ('right' if locale == "ar" else 'left') + ':20px;font-size:14px;color:#0f172a;">'
        f'<li style="margin-bottom:4px;">{_t(locale, "failed.reason_1")}</li>'
        f'<li style="margin-bottom:4px;">{_t(locale, "failed.reason_2")}</li>'
        f'<li style="margin-bottom:0;">{_t(locale, "failed.reason_3")}</li>'
        f'</ul>'
    )

    body = (
        heading(_t(locale, "failed.heading"), color=BRAND_DANGER)
        + paragraph(
            _t(
                locale,
                "failed.body",
                amount=formatted_amount,
                currency=currency,
                plan=plan,
            )
        )
        + cta_button(
            update_payment_url,
            _t(locale, "failed.cta"),
            color=BRAND_DANGER,
        )
        + info_panel(reasons_html)
    )

    html = wrap_html(preheader=preheader, body_html=body, locale=locale)
    text_body = html_to_text(body)
    fallback = _t(locale, "common.cta_fallback") + f"\n{update_payment_url}"
    text = build_text(
        preheader=preheader,
        body_text=text_body + f"\n\n{fallback}",
        locale=locale,
    )

    return subject, html, text
