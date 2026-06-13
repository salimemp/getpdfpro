"""
Email service via Resend.

Resend free tier: 3K emails/month, 100/day.

Templates are in :mod:`app.services.email_templates` and cover:
- welcome
- email verification
- password reset
- magic link sign-in
- payment receipt (initial checkout + renewal)
- payment failed
- plan upgraded
- plan cancelled
"""

import structlog
from pydantic import BaseModel, EmailStr

from app.config import settings
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

logger = structlog.get_logger()

# Lazy import resend (optional dependency in dev)
try:
    import resend
    resend.api_key = settings.resend_api_key
    HAS_RESEND = True
except ImportError:
    HAS_RESEND = False
    logger.warning("resend_not_installed")


class EmailMessage(BaseModel):
    to: list[EmailStr]
    subject: str
    html: str
    text: str | None = None
    reply_to: str | None = None


class EmailService:
    """Wrapper around Resend."""

    async def send(self, message: EmailMessage) -> dict:
        if not HAS_RESEND:
            logger.warning("email_skipped", to=message.to, subject=message.subject)
            return {"id": "dev-skip", "to": message.to}

        try:
            params = {
                "from": settings.resend_from_email,
                "to": message.to,
                "subject": message.subject,
                "html": message.html,
            }
            if message.text:
                params["text"] = message.text
            if message.reply_to:
                params["reply_to"] = message.reply_to

            result = resend.Emails.send(params)
            logger.info("email_sent", to=message.to, subject=message.subject, id=result.get("id"))
            return result
        except Exception as e:
            logger.error("email_send_failed", error=str(e), to=message.to)
            raise

    # ─── Transactional templates ───────────────────────────────
    # Each method takes the recipient, locale, and the template-
    # specific kwargs. Locale defaults to English.
    async def send_welcome(
        self,
        to: str,
        locale: str = "en",
        *,
        name: str = "",
        dashboard_url: str = "",
    ) -> None:
        subject, html, text = render_welcome_email(
            name=name, dashboard_url=dashboard_url, locale=locale
        )
        await self.send(EmailMessage(to=[to], subject=subject, html=html, text=text))

    async def send_verification(
        self,
        to: str,
        locale: str = "en",
        *,
        verification_url: str = "",
    ) -> None:
        subject, html, text = render_verification_email(
            verification_url=verification_url, locale=locale
        )
        await self.send(EmailMessage(to=[to], subject=subject, html=html, text=text))

    async def send_password_reset(
        self,
        to: str,
        locale: str = "en",
        *,
        reset_url: str = "",
        email: str | None = None,
    ) -> None:
        subject, html, text = render_password_reset_email(
            reset_url=reset_url, locale=locale, email=email
        )
        await self.send(EmailMessage(to=[to], subject=subject, html=html, text=text))

    async def send_magic_link(
        self,
        to: str,
        locale: str = "en",
        *,
        login_url: str = "",
    ) -> None:
        subject, html, text = render_magic_link_email(
            login_url=login_url, locale=locale
        )
        await self.send(EmailMessage(to=[to], subject=subject, html=html, text=text))

    async def send_payment_receipt(
        self,
        to: str,
        locale: str = "en",
        *,
        amount: float,
        currency: str,
        plan: str,
        invoice_url: str,
        receipt_id: str | None = None,
    ) -> None:
        subject, html, text = render_payment_receipt(
            amount=amount,
            currency=currency,
            plan=plan,
            invoice_url=invoice_url,
            locale=locale,
            receipt_id=receipt_id,
        )
        await self.send(EmailMessage(to=[to], subject=subject, html=html, text=text))

    async def send_payment_failed(
        self,
        to: str,
        locale: str = "en",
        *,
        amount: float,
        currency: str,
        plan: str,
        update_payment_url: str,
    ) -> None:
        subject, html, text = render_payment_failed_email(
            amount=amount,
            currency=currency,
            plan=plan,
            update_payment_url=update_payment_url,
            locale=locale,
        )
        await self.send(EmailMessage(to=[to], subject=subject, html=html, text=text))

    async def send_plan_upgraded(
        self,
        to: str,
        locale: str = "en",
        *,
        plan: str,
        next_billing_date,
        explore_url: str | None = None,
    ) -> None:
        subject, html, text = render_plan_upgraded_email(
            plan=plan,
            next_billing_date=next_billing_date,
            locale=locale,
            explore_url=explore_url,
        )
        await self.send(EmailMessage(to=[to], subject=subject, html=html, text=text))

    async def send_plan_cancelled(
        self,
        to: str,
        locale: str = "en",
        *,
        period_end,
        plan: str | None = None,
        reactivate_url: str | None = None,
    ) -> None:
        subject, html, text = render_plan_cancelled_email(
            period_end=period_end,
            locale=locale,
            plan=plan,
            reactivate_url=reactivate_url,
        )
        await self.send(EmailMessage(to=[to], subject=subject, html=html, text=text))


# Module-level singleton
email_service = EmailService()
