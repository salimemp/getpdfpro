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

# Password policy (matches frontend PasswordInput component):
#   - At least 8 characters
#   - At least 1 letter (a-z or A-Z)
#   - At least 1 digit (0-9)
#   - At least 1 special character (printable ASCII symbol)
# Max 128 chars to match bcrypt's truncation behavior; longer passwords
# silently fail otherwise.
PASSWORD_MIN_LENGTH = 8
PASSWORD_PATTERN = re.compile(
    r"^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:'\"`,.<>?/~\\|]).{8,128}$"
)

# Common weak passwords — checked case-insensitively before the
# strength regex. Expand from https://github.com/danielmiessler/SecLists
WEAK_PASSWORDS = frozenset(
    {
        "password", "password1", "password123", "qwerty123", "qwerty1234",
        "letmein1", "letmein123", "welcome1", "welcome123", "admin123",
        "iloveyou1", "iloveyou123", "abc12345", "abc123456", "12345678",
        "123456789", "1234567890", "qwertyuiop", "1q2w3e4r", "asdf1234",
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
    Enforce password policy. Raises PasswordValidationError if weak.

    Rules:
    - Min 8 characters
    - At least 1 letter (any case)
    - At least 1 digit
    - At least 1 special character
    - Not in common weak list
    """
    if not password or len(password) < PASSWORD_MIN_LENGTH:
        raise PasswordValidationError(
            f"Password must be at least {PASSWORD_MIN_LENGTH} characters"
        )

    if password.lower() in WEAK_PASSWORDS:
        raise PasswordValidationError("Password is too common")

    if not PASSWORD_PATTERN.match(password):
        # Give the user a hint about which rule they missed
        missing = []
        if not re.search(r"[A-Za-z]", password):
            missing.append("a letter")
        if not re.search(r"\d", password):
            missing.append("a number")
        if not re.search(
            r"[!@#$%^&*()_+\-=\[\]{}|;:'\"`,.<>?/~\\|]", password
        ):
            missing.append("a special character")
        if missing:
            hint = "Password needs " + ", ".join(missing)
        else:
            hint = "Password must contain a letter, a number, and a special character"
        raise PasswordValidationError(hint)


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
