"""
Email service via Resend.

Resend free tier: 3K emails/month, 100/day.
Templates:
- Email verification
- Magic link
- Password reset
- Job completion notification
- Subscription receipt
"""

import structlog
from pydantic import BaseModel, EmailStr

from app.config import settings

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

    # ─── Common templates ─────────────────────────────────────
    async def send_verification(self, to: str, verification_url: str, locale: str = "en") -> None:
        subject = {
            "en": "Verify your GetPDFPro email",
            "es": "Verifica tu email de GetPDFPro",
            "ar": "تحقق من بريدك الإلكتروني في GetPDFPro",
            "hi": "अपना GetPDFPro ईमेल सत्यापित करें",
        }.get(locale, "Verify your GetPDFPro email")

        await self.send(EmailMessage(
            to=[to],
            subject=subject,
            html=f"""
                <h1>Welcome to GetPDFPro!</h1>
                <p>Click the link below to verify your email address:</p>
                <p><a href="{verification_url}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:white;border-radius:8px;text-decoration:none;">Verify Email</a></p>
                <p>This link expires in 1 hour.</p>
                <p>If you didn't sign up, please ignore this email.</p>
            """,
        ))

    async def send_magic_link(self, to: str, magic_url: str, locale: str = "en") -> None:
        subject = {
            "en": "Your GetPDFPro sign-in link",
            "es": "Tu enlace de inicio de sesión de GetPDFPro",
            "ar": "رابط تسجيل الدخول إلى GetPDFPro",
            "hi": "आपका GetPDFPro साइन-इन लिंक",
        }.get(locale, "Your GetPDFPro sign-in link")

        await self.send(EmailMessage(
            to=[to],
            subject=subject,
            html=f"""
                <h1>Sign in to GetPDFPro</h1>
                <p>Click the link below to sign in. This link expires in 15 minutes.</p>
                <p><a href="{magic_url}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:white;border-radius:8px;text-decoration:none;">Sign In</a></p>
                <p>If you didn't request this, you can safely ignore this email.</p>
            """,
        ))


# Module-level singleton
email_service = EmailService()
