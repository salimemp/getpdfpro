"""
Auth-related endpoints (signup confirmation, password breach check, etc.).

Most actual auth happens on the frontend via Supabase directly.
These endpoints handle server-side concerns like HIBP checks and
post-auth user creation in our DB.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.core.security import validate_password_full

router = APIRouter()


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
    """
    await validate_password_full(req.password)
    return {"valid": True}
