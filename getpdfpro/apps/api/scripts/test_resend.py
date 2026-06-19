"""
Resend API test — verifies the email service integration works.

Usage:
  # 1. Template-only test (no API call, just renders HTML/text):
  python3 scripts/test_resend.py --render-only

  # 2. Real send test (requires RESEND_API_KEY env var):
  RESEND_API_KEY=re_xxx python3 scripts/test_resend.py --to you@example.com

  # 3. Real send with a specific template:
  RESEND_API_KEY=re_xxx python3 scripts/test_resend.py --to you@example.com \\
      --template welcome --name "Salim"

This script:
  - Verifies resend SDK loads and API key is accepted
  - Renders each of the 8 templates with sample data
  - Optionally sends one to a real inbox (costs 1 of your 100/day free quota)
  - Reports the Resend message ID on success

Run from getpdfpro/apps/api/ so the app.* imports resolve.
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add api root to sys.path so we can import app.*
_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))


def render_all_templates() -> int:
    """Render every template and check it produces non-empty HTML/text."""
    from app.services.email_templates import (
        render_magic_link_email,
        render_password_reset_email,
        render_payment_failed_email,
        render_payment_receipt,
        render_plan_cancelled_email,
        render_plan_upgraded_email,
        render_verification_email,
        render_welcome_email,
    )

    cases = [
        ("welcome", lambda: render_welcome_email(
            name="Salim", dashboard_url="https://app.getpdfpro.com/account", locale="en")),
        ("verification", lambda: render_verification_email(
            verification_url="https://app.getpdfpro.com/verify?token=abc123", locale="en")),
        ("password_reset", lambda: render_password_reset_email(
            reset_url="https://app.getpdfpro.com/reset?token=abc123",
            email="salim@example.com", locale="en")),
        ("magic_link", lambda: render_magic_link_email(
            login_url="https://app.getpdfpro.com/auth?token=abc123", locale="en")),
        ("payment_receipt", lambda: render_payment_receipt(
            amount=53.88, currency="USD", plan="Pro Yearly",
            invoice_url="https://app.getpdfpro.com/billing/invoice/123",
            receipt_id="rcpt_123", locale="en")),
        ("payment_failed", lambda: render_payment_failed_email(
            amount=5.99, currency="USD", plan="Pro Monthly",
            update_payment_url="https://app.getpdfpro.com/billing/update",
            locale="en")),
        ("plan_upgraded", lambda: render_plan_upgraded_email(
            plan="Pro Yearly", next_billing_date="2027-06-19",
            explore_url="https://app.getpdfpro.com/tools", locale="en")),
        ("plan_cancelled", lambda: render_plan_cancelled_email(
            period_end="2026-06-19", plan="Pro Monthly",
            reactivate_url="https://app.getpdfpro.com/billing/reactivate",
            locale="en")),
    ]

    failures = 0
    for name, render in cases:
        try:
            subject, html, text = render()
            html_len = len(html)
            text_len = len(text) if text else 0
            assert html_len > 500, f"HTML too short ({html_len} chars) for {name}"
            assert subject, f"Empty subject for {name}"
            # Basic sanity check
            assert "GetPDFPro" in html or "GetPDFPro" in subject, f"Brand missing in {name}"
            print(f"  [OK]   {name:20s}  subject={len(subject):3d}ch  html={html_len:5d}ch  text={text_len:4d}ch")
        except Exception as e:
            print(f"  [FAIL] {name:20s}  {e}")
            failures += 1

    return failures


def send_test_email(to: str, template: str) -> int:
    """Send a real test email via Resend."""
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key or api_key.startswith("re_test_placeholder"):
        print("ERROR: RESEND_API_KEY env var not set or still placeholder.")
        print("Get a key from https://resend.com/api-keys, then:")
        print("  export RESEND_API_KEY=re_xxx")
        return 1

    from app.config import settings
    import resend
    resend.api_key = settings.resend_api_key

    from app.services.email_templates import (
        render_welcome_email,
        render_verification_email,
        render_password_reset_email,
        render_magic_link_email,
        render_payment_receipt,
        render_payment_failed_email,
        render_plan_upgraded_email,
        render_plan_cancelled_email,
    )

    renderers = {
        "welcome": lambda: render_welcome_email(
            name="Salim (test)",
            dashboard_url="https://app.getpdfpro.com/account",
            locale="en"),
        "verification": lambda: render_verification_email(
            verification_url="https://app.getpdfpro.com/verify?token=test",
            locale="en"),
        "password_reset": lambda: render_password_reset_email(
            reset_url="https://app.getpdfpro.com/reset?token=test",
            email=to, locale="en"),
        "magic_link": lambda: render_magic_link_email(
            login_url="https://app.getpdfpro.com/auth?token=test", locale="en"),
        "payment_receipt": lambda: render_payment_receipt(
            amount=53.88, currency="USD", plan="Pro Yearly",
            invoice_url="https://app.getpdfpro.com/billing/invoice/test",
            receipt_id="rcpt_test", locale="en"),
        "payment_failed": lambda: render_payment_failed_email(
            amount=5.99, currency="USD", plan="Pro Monthly",
            update_payment_url="https://app.getpdfpro.com/billing/update",
            locale="en"),
        "plan_upgraded": lambda: render_plan_upgraded_email(
            plan="Pro Yearly", next_billing_date="2027-06-19",
            explore_url="https://app.getpdfpro.com/tools", locale="en"),
        "plan_cancelled": lambda: render_plan_cancelled_email(
            period_end="2026-06-19", plan="Pro Monthly",
            reactivate_url="https://app.getpdfpro.com/billing/reactivate",
            locale="en"),
    }
    if template not in renderers:
        print(f"ERROR: unknown template '{template}'. Choose from: {', '.join(renderers)}")
        return 1

    subject, html, text = renderers[template]()

    # Prefix the subject so it's obvious in the inbox
    subject = f"[GetPDFPro TEST] {subject}"

    print(f"Sending to:      {to}")
    print(f"From:            {settings.resend_from_email}")
    print(f"Template:        {template}")
    print(f"Subject:         {subject}")
    print(f"HTML length:     {len(html)} chars")
    print(f"Text length:     {len(text) if text else 0} chars")
    print()

    try:
        result = resend.Emails.send({
            "from": settings.resend_from_email,
            "to": [to],
            "subject": subject,
            "html": html,
            "text": text,
        })
        print("SUCCESS!")
        print(f"  Resend message ID: {result.get('id', 'no-id')}")
        print(f"  Check inbox at:    {to}")
        return 0
    except Exception as e:
        print(f"FAILED: {e}")
        # Common error hints
        msg = str(e)
        if "domain" in msg.lower():
            print("  Hint: the 'from' domain (getpdfpro.com) must be verified in Resend.")
            print("        Go to https://resend.com/domains and verify it.")
        elif "api_key" in msg.lower() or "unauthorized" in msg.lower():
            print("  Hint: API key is invalid. Check https://resend.com/api-keys")
        elif "rate" in msg.lower():
            print("  Hint: hit the 100/day free tier limit. Wait or upgrade.")
        return 2


def main() -> int:
    parser = argparse.ArgumentParser(description="Test the Resend email integration")
    parser.add_argument("--render-only", action="store_true",
                        help="Only test template rendering, no API call")
    parser.add_argument("--to", type=str, help="Email address to send test to")
    parser.add_argument("--template", type=str, default="welcome",
                        help="Template to send: welcome, verification, password_reset, "
                             "magic_link, payment_receipt, payment_failed, "
                             "plan_upgraded, plan_cancelled")
    args = parser.parse_args()

    print("=" * 60)
    print("GetPDFPro Resend Integration Test")
    print("=" * 60)
    print()

    # Always run the render test (no API call, no key needed)
    print("Step 1: Render every email template (no API call)")
    print("-" * 60)
    render_failures = render_all_templates()
    if render_failures:
        print(f"\n{render_failures} template(s) failed to render. Aborting.")
        return 1
    print()
    print("All 8 templates rendered successfully.")
    print()

    if args.render_only:
        return 0

    if not args.to:
        print("Step 2: Skipped (no --to provided, add --to you@example.com to send a real test)")
        return 0

    print("Step 2: Send a real email via Resend")
    print("-" * 60)
    return send_test_email(args.to, args.template)


if __name__ == "__main__":
    sys.exit(main())
