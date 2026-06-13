"""
Payment receipt — sent on successful initial checkout and on
subscription renewal.

Shows the plan, amount, and date. A "View invoice" CTA links to the
customer's billing portal where they can download a PDF invoice.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.email_templates.common import (
    BRAND_NAME,
    _t,
    build_text,
    cta_button,
    currency_format,
    heading,
    html_to_text,
    info_panel,
    label_value_row,
    paragraph,
    wrap_html,
)


def render_payment_receipt(
    amount: float,
    currency: str,
    plan: str,
    invoice_url: str,
    locale: str = "en",
    *,
    receipt_id: str | None = None,
    when: datetime | None = None,
    timezone: str = "UTC",
) -> tuple[str, str, str]:
    """
    Build the payment-receipt email.

    Args:
        amount: Numeric amount in the given currency (e.g. 5.99).
        currency: ISO currency code (USD, EUR, GBP, INR, JPY).
        plan: Display name of the plan ("Pro", "Team", ...).
        invoice_url: Absolute URL to the invoice / billing portal.
        locale: One of en/es/ar/hi.
        receipt_id: Optional receipt/invoice ID for the detail block.
        when: When the payment was processed. Defaults to "now"
              in the user's locale's timezone.
        timezone: IANA timezone for the date display.

    Returns:
        (subject, html, text)
    """
    preheader = _t(locale, "receipt.preheader")
    subject = _t(locale, "receipt.subject", plan=plan)

    formatted_amount = currency_format(amount, currency)
    if when is None:
        when = datetime.now(tz=ZoneInfo("UTC"))
    try:
        when_local = when.astimezone(ZoneInfo(timezone))
    except Exception:
        when_local = when
    date_display = when_local.strftime("%B %d, %Y")

    details_rows = "".join(
        [
            label_value_row(_t(locale, "receipt.plan_label"), plan),
            label_value_row(_t(locale, "receipt.amount_label"), formatted_amount),
            label_value_row(_t(locale, "receipt.date_label"), date_display),
        ]
    )
    if receipt_id:
        details_rows += label_value_row(
            _t(locale, "receipt.receipt_id_label"), receipt_id
        )

    details_table = (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="margin:0;">{details_rows}</table>'
    )

    body = (
        heading(_t(locale, "receipt.heading"))
        + paragraph(
            _t(
                locale,
                "receipt.thanks",
                plan=plan,
                amount=formatted_amount,
                currency=currency,
            )
        )
        + cta_button(invoice_url, _t(locale, "receipt.cta"))
        + (
            f'<p style="margin:24px 0 8px 0;font-weight:600;color:'
            f'#0f172a;font-size:14px;">{_t(locale, "receipt.details_title")}</p>'
            + info_panel(details_table)
        )
    )

    html = wrap_html(preheader=preheader, body_html=body, locale=locale)
    text_body = html_to_text(body)
    fallback = _t(locale, "common.cta_fallback") + f"\n{invoice_url}"
    text = build_text(
        preheader=preheader,
        body_text=text_body + f"\n\n{fallback}",
        locale=locale,
    )

    return subject, html, text
