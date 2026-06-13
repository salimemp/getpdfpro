"""
Auth-related endpoints (signup confirmation, password breach check,
welcome email, password reset, email change, magic link).

Most actual auth happens on the frontend via Supabase directly.
These endpoints handle server-side concerns like HIBP checks,
welcome email dispatch, and post-auth user creation in our DB.
"""

import secrets
from urllib.parse import urlencode

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.security import validate_password_full
from app.services.email import email_service

logger = structlog.get_logger()
router = APIRouter()

# ─── Public app URL (used for absolute CTA links) ─────────────
# In dev this is the local frontend; in prod it's the real app.
# Keep it configurable so we can swap hosts per environment
# without code changes.
import os

APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://app.getpdfpro.com")


# ─── Password check (existing) ────────────────────────────────
class PasswordCheckRequest(BaseModel):
    password: str


class PasswordCheckResponse(BaseModel):
    is_strong: bool
    is_breached: bool
    message: str | None = None


@router.post("/check-password", response_model=PasswordCheckResponse)
async def check_password_strength(req: PasswordCheckRequest) -> PasswordCheckResponse:
    """
    Check password strength + HIBP breach status.
    Called by frontend during signup to give real-time feedback.
    """
    from app.core.security import check_password_breached, validate_password_strength

    try:
        validate_password_strength(req.password)
    except Exception as e:
        return PasswordCheckResponse(
            is_strong=False,
            is_breached=False,
            message=str(e),
        )

    is_breached = await check_password_breached(req.password)

    return PasswordCheckResponse(
        is_strong=True,
        is_breached=is_breached,
        message="Password has been seen in data breaches" if is_breached else None,
    )


# ─── Signup validation (existing) ─────────────────────────────
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None
    locale: str = "en"


@router.post("/signup-validate")
async def validate_signup(req: SignupRequest) -> dict:
    """
    Validate signup data BEFORE the frontend calls Supabase.
    Saves a round-trip on bad data.

    On success, also dispatches a welcome email so the user has
    it waiting in their inbox the moment Supabase confirms.
    """
    await validate_password_full(req.password)

    dashboard_url = f"{APP_BASE_URL}/dashboard"
    try:
        await email_service.send_welcome(
            to=req.email,
            locale=req.locale,
            name=req.display_name or "",
            dashboard_url=dashboard_url,
        )
    except Exception as e:  # never block signup on email failure
        logger.warning("welcome_email_failed", email=req.email, error=str(e))

    return {"valid": True}


# ─── Password reset request ───────────────────────────────────
class PasswordResetRequest(BaseModel):
    email: EmailStr
    locale: str = "en"


@router.post("/request-password-reset")
async def request_password_reset(req: PasswordResetRequest) -> dict:
    """
    Generate a one-time reset token and email it to the user.

    The token should be opaque and short-lived (15–30 min). In a
    real deployment this would be persisted in a tokens table;
    here we generate it and embed it in the URL.
    """
    token = secrets.token_urlsafe(32)
    qs = urlencode({"token": token, "email": req.email})
    reset_url = f"{APP_BASE_URL}/reset-password?{qs}"

    try:
        await email_service.send_password_reset(
            to=req.email,
            locale=req.locale,
            reset_url=reset_url,
            email=req.email,
        )
    except Exception as e:
        # Log the failure but still return success to the caller —
        # we don't want to leak which emails are registered.
        logger.error("password_reset_email_failed", email=req.email, error=str(e))
        # Still return success so we don't leak account existence.
    return {"sent": True}


# ─── Email change / verification ──────────────────────────────
class EmailChangeRequest(BaseModel):
    new_email: EmailStr
    locale: str = "en"


@router.post("/request-email-change")
async def request_email_change(req: EmailChangeRequest) -> dict:
    """
    Send a verification email to the new address.

    The user must click the link in the email to confirm they
    own the new address before the change is committed (the
    confirmation handler lives in /me or similar).
    """
    token = secrets.token_urlsafe(32)
    qs = urlencode({"token": token, "email": req.new_email})
    verification_url = f"{APP_BASE_URL}/verify-email?{qs}"

    try:
        await email_service.send_verification(
            to=req.new_email,
            locale=req.locale,
            verification_url=verification_url,
        )
    except Exception as e:
        logger.error("verification_email_failed", email=req.new_email, error=str(e))
        raise HTTPException(502, "Could not send verification email")
    return {"sent": True}


# ─── Magic link sign-in ───────────────────────────────────────
class MagicLinkRequest(BaseModel):
    email: EmailStr
    locale: str = "en"


@router.post("/magic-link")
async def request_magic_link(req: MagicLinkRequest) -> dict:
    """
    Send a one-time sign-in link to the user's email.

    Expiry is 15 minutes (enforced in the template copy and in
    the token-claim endpoint).
    """
    token = secrets.token_urlsafe(32)
    qs = urlencode({"token": token, "email": req.email})
    login_url = f"{APP_BASE_URL}/auth/callback?{qs}"

    try:
        await email_service.send_magic_link(
            to=req.email,
            locale=req.locale,
            login_url=login_url,
        )
    except Exception as e:
        logger.error("magic_link_email_failed", email=req.email, error=str(e))
        # Don't leak — always return success.
    return {"sent": True}
