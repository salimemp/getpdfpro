"""
Tests for the GetPDFPro email template package.

Strategy: render each template directly and assert that the
returned (subject, html, text) tuple contains the expected key
strings. We do NOT mock the Resend SDK — these tests live one
level below the delivery path and are pure-function tests.

Run with:
    cd apps/api && python -m pytest tests/services/test_email_templates.py -v
"""

from __future__ import annotations

import pytest

from app.services.email_templates import (
    BRAND_BG,
    BRAND_BORDER,
    BRAND_NAME,
    BRAND_PRIMARY,
    BRAND_TEXT,
    DEFAULT_LOCALE,
    LOGO_URL,
    SUPPORTED_LOCALES,
    render_magic_link_email,
    render_password_reset_email,
    render_payment_failed_email,
    render_payment_receipt,
    render_plan_cancelled_email,
    render_plan_upgraded_email,
    render_verification_email,
    render_welcome_email,
)
from app.services.email_templates.common import _normalize_locale, _t, wrap_html


# ─── Fixtures ──────────────────────────────────────────────────
@pytest.fixture
def dashboard_url() -> str:
    return "https://app.getpdfpro.com/dashboard"


@pytest.fixture
def verification_url() -> str:
    return "https://app.getpdfpro.com/verify-email?token=abc123"


@pytest.fixture
def reset_url() -> str:
    return "https://app.getpdfpro.com/reset-password?token=def456"


@pytest.fixture
def magic_url() -> str:
    return "https://app.getpdfpro.com/auth/callback?token=ghi789"


# ─── Common HTML wrapper ──────────────────────────────────────
class TestCommon:
    def test_wrap_html_contains_brand_colors(self) -> None:
        # Render a real template so the wrapper sees a body that
        # uses the CTA primary color.
        _, html, _ = render_welcome_email(
            "Salim", "https://app.getpdfpro.com/dashboard", locale="en"
        )
        # All three required brand colors must be present in the
        # inline-styled wrapper.
        assert BRAND_PRIMARY in html  # #0ea5e9 (CTA buttons)
        assert BRAND_TEXT in html     # #0f172a (body text)
        assert BRAND_BG in html       # #f8fafc (page background)

    def test_wrap_html_contains_logo(self) -> None:
        _, html, _ = render_welcome_email(
            "Salim", "https://app.getpdfpro.com/dashboard", locale="en"
        )
        assert LOGO_URL in html
        assert "GetPDFPro logo" in html

    def test_wrap_html_is_rtl_for_arabic(self) -> None:
        html = wrap_html(
            preheader="preheader",
            body_html="<p>body</p>",
            locale="ar",
        )
        assert 'dir="rtl"' in html
        assert 'lang="ar"' in html

    def test_wrap_html_ltr_for_english(self) -> None:
        html = wrap_html(
            preheader="preheader",
            body_html="<p>body</p>",
            locale="en",
        )
        assert 'dir="rtl"' not in html
        assert 'lang="en"' in html

    def test_normalize_locale_handles_unknown(self) -> None:
        assert _normalize_locale(None) == DEFAULT_LOCALE
        assert _normalize_locale("") == DEFAULT_LOCALE
        assert _normalize_locale("zz") == DEFAULT_LOCALE
        assert _normalize_locale("en-US") == "en"
        assert _normalize_locale("ES") == "es"
        assert _normalize_locale("ar-SA") == "ar"
        assert _normalize_locale("hi") == "hi"

    def test_t_helper_falls_back_to_english(self) -> None:
        # Unknown key returns the key itself
        assert _t("en", "nope.does.not.exist") == "nope.does.not.exist"
        # Unknown locale uses English strings
        assert _t("zz", "welcome.subject") == _t("en", "welcome.subject")
        # Brand variable is auto-injected
        assert "GetPDFPro" in _t("en", "welcome.subject")

    def test_supported_locales_constant(self) -> None:
        # Per spec: en, es, ar, hi at minimum
        for loc in ("en", "es", "ar", "hi"):
            assert loc in SUPPORTED_LOCALES


# ─── Welcome ───────────────────────────────────────────────────
class TestWelcome:
    def test_subject_and_html_contain_name_and_url(
        self, dashboard_url: str
    ) -> None:
        subject, html, text = render_welcome_email(
            "Salim", dashboard_url, locale="en"
        )
        assert BRAND_NAME in subject
        assert "Salim" in html
        assert dashboard_url in html
        # CTA button label
        assert "Open your dashboard" in html

    def test_text_contains_name_and_url(self, dashboard_url: str) -> None:
        subject, html, text = render_welcome_email(
            "Salim", dashboard_url, locale="en"
        )
        # Plain-text mirror must contain the same key strings.
        assert "Salim" in text
        assert dashboard_url in text
        assert "Open your dashboard" in text

    def test_text_html_share_key_strings(self, dashboard_url: str) -> None:
        """The plain-text version mirrors the HTML for key sections."""
        _, html, text = render_welcome_email("Aisha", dashboard_url, locale="en")
        # These are the strings a reader needs to see in either
        # client: the user's name, the CTA, and the tip.
        for key in ("Aisha", "Open your dashboard", "Quick tip", "AI"):
            assert key in html
            assert key in text

    def test_empty_name_falls_back_gracefully(self, dashboard_url: str) -> None:
        # When the OAuth signup arrives with no display name, the
        # email shouldn't crash or greet with a literal "Hi ,"
        subject, html, text = render_welcome_email("", dashboard_url, locale="en")
        assert "Salim" not in html  # empty name was passed
        # But the rest of the copy is intact.
        assert dashboard_url in html
        assert BRAND_NAME in subject


# ─── Verification ──────────────────────────────────────────────
class TestVerification:
    @pytest.mark.parametrize(
        "locale,expected_phrase",
        [
            ("en", "Verify your GetPDFPro email"),
            ("es", "Verifica tu correo"),
            ("ar", "تحقق من بريدك"),
            ("hi", "अपना GetPDFPro ईमेल सत्यापित करें"),
        ],
    )
    def test_subject_per_locale(
        self, locale: str, expected_phrase: str, verification_url: str
    ) -> None:
        subject, html, text = render_verification_email(verification_url, locale=locale)
        assert expected_phrase in subject
        # The URL is always present in HTML and in the text
        # fallback block.
        assert verification_url in html
        assert verification_url in text

    def test_html_contains_cta(self, verification_url: str) -> None:
        _, html, _ = render_verification_email(verification_url, locale="en")
        assert "Verify email" in html
        assert verification_url in html


# ─── Password reset ────────────────────────────────────────────
class TestPasswordReset:
    def test_subject_and_html(self, reset_url: str) -> None:
        subject, html, text = render_password_reset_email(
            reset_url, locale="en", email="salim@example.com"
        )
        assert "Reset your GetPDFPro password" in subject
        assert "salim@example.com" in html
        assert reset_url in html
        assert "Set a new password" in html

    def test_text_contains_url(self, reset_url: str) -> None:
        _, _, text = render_password_reset_email(
            reset_url, locale="en", email="salim@example.com"
        )
        assert reset_url in text

    def test_optional_email_arg(self, reset_url: str) -> None:
        # email=None is supported
        subject, html, _ = render_password_reset_email(reset_url, locale="en")
        assert "Reset your" in subject
        assert "your account" in html or "@" in html


# ─── Magic link ────────────────────────────────────────────────
class TestMagicLink:
    def test_subject_and_html(self, magic_url: str) -> None:
        subject, html, text = render_magic_link_email(magic_url, locale="en")
        assert "sign-in link" in subject.lower()
        assert magic_url in html
        assert "Sign in" in html
        # 15-minute expiry is part of the copy
        assert "15" in html

    def test_text_contains_url(self, magic_url: str) -> None:
        _, _, text = render_magic_link_email(magic_url, locale="en")
        assert magic_url in text


# ─── Payment receipt ───────────────────────────────────────────
class TestPaymentReceipt:
    def test_subject_includes_plan(self) -> None:
        subject, _, _ = render_payment_receipt(
            amount=5.99,
            currency="USD",
            plan="Pro",
            invoice_url="https://app.getpdfpro.com/invoice/123",
            locale="en",
            receipt_id="rc_test_001",
        )
        assert "Pro" in subject
        assert BRAND_NAME in subject

    def test_html_contains_amount_and_invoice(self) -> None:
        _, html, _ = render_payment_receipt(
            amount=5.99,
            currency="USD",
            plan="Pro",
            invoice_url="https://app.getpdfpro.com/invoice/123",
            locale="en",
            receipt_id="rc_test_001",
        )
        # Currency formatter uses $ for USD
        assert "$5.99" in html
        assert "https://app.getpdfpro.com/invoice/123" in html
        assert "rc_test_001" in html
        # Plan name appears in body
        assert "Pro" in html

    def test_inr_currency(self) -> None:
        _, html, _ = render_payment_receipt(
            amount=399.0,
            currency="INR",
            plan="Pro",
            invoice_url="https://x/i",
            locale="en",
        )
        assert "₹399.00" in html


# ─── Payment failed ────────────────────────────────────────────
class TestPaymentFailed:
    def test_subject_and_html(self) -> None:
        subject, html, _ = render_payment_failed_email(
            amount=5.99,
            currency="USD",
            plan="Pro",
            update_payment_url="https://app.getpdfpro.com/account/billing",
            locale="en",
        )
        assert BRAND_NAME in subject
        assert "Payment failed" in html or "didn't go through" in html
        assert "https://app.getpdfpro.com/account/billing" in html
        # Reasons panel
        assert "Common reasons" in html or "Reasons" in html

    def test_text_contains_update_url(self) -> None:
        _, _, text = render_payment_failed_email(
            amount=5.99,
            currency="USD",
            plan="Pro",
            update_payment_url="https://app.getpdfpro.com/account/billing",
            locale="en",
        )
        assert "https://app.getpdfpro.com/account/billing" in text


# ─── Plan upgraded ─────────────────────────────────────────────
class TestPlanUpgraded:
    def test_string_date(self) -> None:
        subject, html, text = render_plan_upgraded_email(
            plan="Team",
            next_billing_date="2026-07-13",
            locale="en",
            explore_url="https://app.getpdfpro.com/dashboard",
        )
        assert "Team" in subject
        assert "July" in html  # localised month name
        assert "2026" in html
        assert "https://app.getpdfpro.com/dashboard" in html

    def test_iso_string_date(self) -> None:
        _, html, _ = render_plan_upgraded_email(
            plan="Pro",
            next_billing_date="2026-07-13T00:00:00+00:00",
            locale="en",
        )
        assert "2026" in html

    def test_no_explore_url(self) -> None:
        # CTA is optional
        subject, html, _ = render_plan_upgraded_email(
            plan="Pro", next_billing_date="2026-07-13", locale="en"
        )
        assert "Pro" in subject


# ─── Plan cancelled ────────────────────────────────────────────
class TestPlanCancelled:
    def test_subject_and_html(self) -> None:
        subject, html, text = render_plan_cancelled_email(
            period_end="2026-07-13",
            locale="en",
            plan="Pro",
            reactivate_url="https://app.getpdfpro.com/account/billing/reactivate",
        )
        assert "cancelled" in subject.lower() or "canceled" in subject.lower()
        assert "Pro" in html
        assert "July" in html
        assert "https://app.getpdfpro.com/account/billing/reactivate" in html

    def test_text_contains_reactivate_url(self) -> None:
        _, _, text = render_plan_cancelled_email(
            period_end="2026-07-13",
            locale="en",
            plan="Pro",
            reactivate_url="https://app.getpdfpro.com/account/billing/reactivate",
        )
        assert "https://app.getpdfpro.com/account/billing/reactivate" in text

    def test_plan_optional(self) -> None:
        # Should not crash if plan is omitted
        subject, html, _ = render_plan_cancelled_email(
            period_end="2026-07-13", locale="en"
        )
        assert "subscription" in subject.lower() or "cancelled" in subject.lower()


# ─── EmailService method surface (no Resend calls) ───────────
class TestEmailServiceSurface:
    """
    Verify the EmailService exposes the expected ``send_*`` methods.
    We intentionally do NOT exercise the dispatch path here — that
    requires either a real Resend key or a mock, both of which are
    out of scope for template tests.
    """

    def test_send_methods_exist(self) -> None:
        from app.services.email import EmailService

        svc = EmailService()
        for name in (
            "send_welcome",
            "send_verification",
            "send_password_reset",
            "send_magic_link",
            "send_payment_receipt",
            "send_payment_failed",
            "send_plan_upgraded",
            "send_plan_cancelled",
        ):
            assert hasattr(svc, name), f"EmailService missing {name}"
            assert callable(getattr(svc, name))
