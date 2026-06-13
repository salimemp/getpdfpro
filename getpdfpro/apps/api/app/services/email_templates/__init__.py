"""
Email template package for GetPDFPro transactional emails.

All templates return ``(subject, html, text)`` and support the
locales en, es, ar, hi. Brand colors, layout, and the
GetPDFPro logo are centralised in :mod:`app.services.email_templates.common`.

Quick usage::

    from app.services.email_templates import render_welcome_email

    subject, html, text = render_welcome_email(
        name="Salim",
        dashboard_url="https://app.getpdfpro.com/dashboard",
        locale="en",
    )
"""

from __future__ import annotations

# Brand constants — re-exported for callers that want to keep
# brand look-and-feel consistent in their own templates.
from app.services.email_templates.common import (
    BRAND_BG,
    BRAND_BORDER,
    BRAND_CARD,
    BRAND_DANGER,
    BRAND_MUTED,
    BRAND_NAME,
    BRAND_PRIMARY,
    BRAND_PRIMARY_DARK,
    BRAND_TEXT,
    LOGO_URL,
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
)

# Per-template renderers
from app.services.email_templates.email_verification import render_verification_email
from app.services.email_templates.magic_link import render_magic_link_email
from app.services.email_templates.password_reset import render_password_reset_email
from app.services.email_templates.payment_failed import render_payment_failed_email
from app.services.email_templates.payment_receipt import render_payment_receipt
from app.services.email_templates.plan_cancelled import render_plan_cancelled_email
from app.services.email_templates.plan_upgraded import render_plan_upgraded_email
from app.services.email_templates.welcome import render_welcome_email

__all__ = [
    # Brand
    "BRAND_NAME",
    "BRAND_PRIMARY",
    "BRAND_PRIMARY_DARK",
    "BRAND_TEXT",
    "BRAND_MUTED",
    "BRAND_BG",
    "BRAND_CARD",
    "BRAND_BORDER",
    "BRAND_DANGER",
    "LOGO_URL",
    "SUPPORTED_LOCALES",
    "DEFAULT_LOCALE",
    # Renderers
    "render_welcome_email",
    "render_verification_email",
    "render_password_reset_email",
    "render_magic_link_email",
    "render_payment_receipt",
    "render_payment_failed_email",
    "render_plan_upgraded_email",
    "render_plan_cancelled_email",
]
