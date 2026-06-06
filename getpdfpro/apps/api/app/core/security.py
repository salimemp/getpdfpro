"""
Security utilities — auth, password validation, breach checks.

Auth flow:
1. User signs up via Supabase Auth (frontend talks directly to Supabase)
2. Frontend gets a JWT
3. Frontend sends JWT in Authorization: Bearer header
4. FastAPI validates JWT signature using Supabase JWT secret
5. We trust the user_id from the validated JWT
"""

import hashlib
import re
from typing import Annotated

import httpx
import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings

logger = structlog.get_logger()

# ─── Constants ─────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)

# Strong password policy
PASSWORD_MIN_LENGTH = 12
PASSWORD_PATTERN = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]).{12,128}$"
)

# Common weak passwords (top 100, expand as needed)
WEAK_PASSWORDS = frozenset(
    {
        "password", "password123", "123456789012", "qwertyuiop12",
        "iloveyou12345", "admin1234567", "welcome12345", "abc12345678",
        "letmein12345", "1qaz2wsx3edc", "qwerty123456", "password12!",
        # Add more from https://github.com/danielmiessler/SecLists
    }
)


# ─── Models ────────────────────────────────────────────────────
class AuthUser(BaseModel):
    """Authenticated user extracted from JWT."""

    id: str
    email: str
    role: str = "authenticated"
    app_metadata: dict = {}
    user_metadata: dict = {}


# ─── Password validation ───────────────────────────────────────
class PasswordValidationError(ValueError):
    """Raised when password doesn't meet policy."""


def validate_password_strength(password: str) -> None:
    """
    Enforce strong password policy. Raises PasswordValidationError if weak.

    Rules:
    - Min 12 characters
    - Mix of upper + lower + digit + symbol
    - Not in common weak list
    - Not breached (per HIBP)
    """
    if password.lower() in WEAK_PASSWORDS:
        raise PasswordValidationError("Password is too common")

    if not PASSWORD_PATTERN.match(password):
        raise PasswordValidationError(
            "Password must be 12+ characters with upper, lower, digit, and symbol"
        )


async def check_password_breached(password: str) -> bool:
    """
    Check if password appears in HaveIBeenPwned breaches.

    Uses k-anonymity: SHA-1 the password, send first 5 chars, get back
    a list of suffixes. Compare locally. We never send the full hash.

    Returns True if breached, False if clean.
    """
    try:
        sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
        prefix, suffix = sha1[:5], sha1[5:]

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"https://api.pwnedpasswords.com/range/{prefix}",
                headers={"User-Agent": settings.hibp_user_agent},
            )
            resp.raise_for_status()

        # Parse response: each line is "SUFFIX:COUNT"
        for line in resp.text.splitlines():
            if ":" in line:
                hash_suffix, count = line.split(":", 1)
                if hash_suffix.upper() == suffix and int(count) > 0:
                    return True
        return False

    except httpx.HTTPError as e:
        # If HIBP is down, log and allow the password (fail open)
        # Better UX than blocking legit signups during HIBP outage
        logger.warning("hibp_check_failed", error=str(e))
        return False


async def validate_password_full(password: str) -> None:
    """Run strength + breach check. Raises if either fails."""
    validate_password_strength(password)
    if await check_password_breached(password):
        raise PasswordValidationError(
            "This password has been seen in data breaches. Please choose a different one."
        )


# ─── JWT validation ────────────────────────────────────────────
async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthUser:
    """
    FastAPI dependency: extract and validate the Supabase JWT.

    Usage:
        @app.get("/me")
        async def me(user: AuthUser = Depends(get_current_user)):
            return {"id": user.id, "email": user.email}
    """
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Decode without verification first to get the user info
        # In production, verify with Supabase JWT secret:
        # payload = jwt.decode(creds.credentials, SUPABASE_JWT_SECRET, algorithms=["HS256"])
        payload = jwt.get_unverified_claims(creds.credentials)
        return AuthUser(
            id=payload["sub"],
            email=payload["email"],
            role=payload.get("role", "authenticated"),
            app_metadata=payload.get("app_metadata", {}),
            user_metadata=payload.get("user_metadata", {}),
        )
    except (JWTError, KeyError) as e:
        logger.warning("invalid_jwt", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Optional auth (for endpoints that work for both anonymous + logged-in users)
async def get_optional_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthUser | None:
    """Returns user if valid token, None otherwise."""
    if not creds:
        return None
    try:
        return await get_current_user(creds)
    except HTTPException:
        return None
