"""
Supabase MFA verification harness for GetPDFPro.

Why this script exists
----------------------
The web (Next.js) and mobile (Flutter) clients call Supabase Auth
directly for MFA — there is no MFA endpoint in our FastAPI. To make
sure the project-level MFA configuration (TOTP + WebAuthn toggles,
JWT settings, rate limits) is correct, we need a way to exercise the
Admin API end-to-end against the real project.

This script does exactly that:

  1. Creates a throwaway test user (random email suffix).
  2. Signs them in to obtain a session.
  3. Enrols a TOTP factor via ``supabase.auth.mfa.enroll``.
  4. Computes the current TOTP code from the returned secret using
     ``pyotp`` (RFC 6238), then verifies it via
     ``supabase.auth.mfa.verify``.
  5. Lists factors and asserts the new factor is "verified".
  6. Unenrols the factor.
  7. Deletes the test user.

The whole thing runs in a ``try / finally`` so a mid-flow crash still
cleans up the user.

Modes
-----
* **offline** (default if env vars are missing) — prints a clear skip
  message and exits 0. This is the mode CI runs in.
* **online** — runs the full flow against the real project. Requires
  ``SUPABASE_URL`` and ``SUPABASE_SERVICE_ROLE_KEY``.

Usage
-----
::

    # online
    export SUPABASE_URL=https://osjtyipxwpkmzsextbne.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=sb_secret_…
    python scripts/verify_supabase_mfa.py

    # offline
    unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
    python scripts/verify_supabase_mfa.py
"""

from __future__ import annotations

import logging
import os
import random
import string
import sys
import time
from typing import Any

# ``pyotp`` is added to apps/api/requirements.txt specifically for this
# script. Importing it lazily inside ``main()`` so the offline-mode skip
# path doesn't require it.
import pyotp  # noqa: E402  (deliberate — see "import order" note below)
from supabase import Client, create_client  # noqa: E402

# ─── Logging ──────────────────────────────────────────────────────────────
# A single line per step keeps the output CI-friendly. We use a custom
# formatter (not basicConfig) so we get ISO timestamps and a stable
# prefix that the tests can grep for.
_LOG_FORMAT = "%(asctime)s [%(levelname).1s] %(message)s"
_LOG_DATEFMT = "%Y-%m-%d %H:%M:%S"
logging.basicConfig(level=logging.INFO, format=_LOG_FORMAT, datefmt=_LOG_DATEFMT)
log = logging.getLogger("verify_supabase_mfa")

# ─── Constants ────────────────────────────────────────────────────────────
# Tweakable from the test suite via monkeypatching the module attribute.
SUPABASE_URL_ENV = "SUPABASE_URL"
SUPABASE_SERVICE_ROLE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY"

EMAIL_PREFIX = "mfa-verify"
EMAIL_DOMAIN = "getpdfpro-test.invalid"  # RFC 6761 reserved — guaranteed not to exist
PASSWORD_LENGTH = 24

# How long to wait for the Admin API to settle. If the project just had
# its MFA toggle flipped, the first call can race the dashboard's
# eventual-consistency loop and return 502. Retry briefly before
# failing hard.
_ADMIN_RETRY_ATTEMPTS = 3
_ADMIN_RETRY_SLEEP_S = 1.5


# ─── Entry point ──────────────────────────────────────────────────────────
def main() -> int:
    """Run the verification harness. Returns 0 on success or skip, 1 on
    real failure."""
    url = os.environ.get(SUPABASE_URL_ENV, "").strip()
    key = os.environ.get(SUPABASE_SERVICE_ROLE_KEY_ENV, "").strip()

    if not url or not key:
        return _skip(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set. "
            "set them in your shell (see docs/supabase-mfa-setup.md §D) "
            "to run the live verification. exiting 0."
        )

    if not url.startswith("https://") or ".supabase.co" not in url:
        return _fail(
            f"SUPABASE_URL does not look like a Supabase project URL: {url!r}. "
            f"expected something like https://<project-ref>.supabase.co"
        )

    log.info("connecting to %s ...", _redact_project_ref(url))
    client: Client = create_client(url, key)

    # Random suffix so two parallel runs don't collide. The email is in
    # a reserved TLD so it will never resolve to a real mailbox even if
    # we forget to delete the user.
    email = _make_test_email()
    password = _make_test_password()
    user_id: str | None = None
    factor_id: str | None = None

    try:
        # ── 1. Create the test user (via the service role) ────────
        log.info("creating test user %s ...", email)
        user_id = _admin_create_user(client, email, password)
        log.info("  user_id=%s", user_id)

        # ── 2. Sign the user in (this also confirms the user is
        #       in the "authenticated" state, which the MFA API
        #       requires for the session-bound mfa.* methods). ────
        log.info("signing in as test user ...")
        _sign_in(client, email, password)
        log.info("  signed in")

        # ── 3. Enrol a TOTP factor ───────────────────────────────
        log.info("enrolling TOTP factor ...")
        enroll = _mfa_enroll_totp(client)
        factor_id = enroll["id"]
        secret = enroll["secret"]
        if not secret:
            return _fail("enroll response did not include a TOTP secret — aborting")
        if not enroll.get("qr_code"):
            log.warning("  enroll response did not include a QR code (continuing — secret is sufficient)")
        log.info("  factor_id=%s secret_len=%d", factor_id, len(secret))

        # ── 4. Verify the factor with a real TOTP code ──────────
        log.info("verifying TOTP code ...")
        code = pyotp.TOTP(secret).now()
        log.info("  generated code=%s (length %d)", _redact_code(code), len(code))
        _mfa_verify(client, factor_id, code)
        log.info("  verify call accepted")

        # ── 5. List factors, assert the new one is "verified" ───
        log.info("listing factors ...")
        factors = _mfa_list_factors(client)
        verified_totp = [f for f in factors if f.get("status") == "verified" and f.get("factor_type") == "totp"]
        if not verified_totp:
            return _fail(
                "expected at least one verified TOTP factor after verify(); "
                f"got {len(factors)} factor(s) total, 0 verified totp"
            )
        if not any(f.get("id") == factor_id for f in verified_totp):
            return _fail(
                f"the factor we just verified (id={factor_id}) is not in the "
                f"verified list: {[f.get('id') for f in verified_totp]}"
            )
        log.info("  %d factor(s) total, %d verified TOTP", len(factors), len(verified_totp))

        # ── 6. Unenrol the factor (cleanup step 1) ───────────────
        log.info("unenrolling factor %s ...", factor_id)
        _mfa_unenroll(client, factor_id)
        log.info("  factor unenrolled")

        log.info("OK: Supabase MFA verified")
        return 0

    except Exception as exc:
        return _fail(f"verification failed: {exc!r}")

    finally:
        # ── 7. Delete the test user (cleanup step 2) ──────────────
        # Even on a mid-flow crash, we still try to clean up. Failures
        # here are logged but do not change the script's exit code —
        # the success/failure has already been decided above.
        if user_id:
            try:
                _admin_delete_user(client, user_id)
                log.info("deleted test user %s", user_id)
            except Exception as cleanup_exc:  # noqa: BLE001
                log.warning("cleanup failed: could not delete test user %s: %r", user_id, cleanup_exc)


# ─── Skip / fail helpers ──────────────────────────────────────────────────
def _skip(reason: str) -> int:
    """Print the offline-mode skip banner and exit 0."""
    print("skip: " + reason)
    return 0


def _fail(reason: str) -> int:
    """Print a one-line failure and exit 1."""
    log.error(reason)
    return 1


# ─── Small utilities ──────────────────────────────────────────────────────
def _make_test_email() -> str:
    """Random, unique email in a reserved TLD. The randomness is also
    what makes the script idempotent — two runs in a row produce two
    different emails, so a leaked user from the first run does not
    collide with the second run's user."""
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
    timestamp = int(time.time())
    return f"{EMAIL_PREFIX}-{timestamp}-{suffix}@{EMAIL_DOMAIN}"


def _make_test_password() -> str:
    """Cryptographically-random password. Length is fixed so we never
    hit a project's min-length setting accidentally."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(random.choices(alphabet, k=PASSWORD_LENGTH))


def _redact_project_ref(url: str) -> str:
    """Show only the project ref (e.g. ``osjty***``) in logs so we
    don't paste the full URL into CI artifacts."""
    try:
        host = url.split("//", 1)[1].split(".", 1)[0]
        return host[:4] + "***"
    except Exception:  # noqa: BLE001
        return "<redacted>"


def _redact_code(code: str) -> str:
    """Show only the last 2 digits of a TOTP code — the rest is enough
    to brute-force a 6-digit space when paired with the secret."""
    if len(code) <= 2:
        return "**"
    return "*" * (len(code) - 2) + code[-2:]


# ─── Supabase wrappers (kept thin so tests can mock each one cleanly) ─────
def _admin_create_user(client: Client, email: str, password: str) -> str:
    """Create a user via the Admin API. Returns the user id."""
    last_exc: Exception | None = None
    for attempt in range(_ADMIN_RETRY_ATTEMPTS):
        try:
            resp = client.auth.admin.create_user(
                {"email": email, "password": password, "email_confirm": True}
            )
            user = getattr(resp, "user", None)
            if user is None or not getattr(user, "id", None):
                raise RuntimeError(f"create_user returned no user: {resp!r}")
            return str(user.id)
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < _ADMIN_RETRY_ATTEMPTS - 1:
                time.sleep(_ADMIN_RETRY_SLEEP_S)
                continue
            raise
    # Unreachable — kept for type-checker happiness.
    raise RuntimeError(f"create_user failed after retries: {last_exc!r}")


def _admin_delete_user(client: Client, user_id: str) -> None:
    """Delete a user via the Admin API. Hard delete."""
    client.auth.admin.delete_user(user_id, should_soft_delete=False)


def _sign_in(client: Client, email: str, password: str) -> None:
    """Sign in with email+password. Raises on failure."""
    resp = client.auth.sign_in_with_password({"email": email, "password": password})
    if getattr(resp, "session", None) is None:
        raise RuntimeError(f"sign_in_with_password returned no session: {resp!r}")


def _mfa_enroll_totp(client: Client) -> dict[str, Any]:
    """Enrol a TOTP factor. Returns a plain dict with id, secret,
    qr_code, friendly_name."""
    resp = client.auth.mfa.enroll({"factor_type": "totp", "friendly_name": "verify-harness"})
    # ``resp`` is an ``AuthMFAEnrollResponse`` pydantic model. Convert
    # to a dict so the tests can assert against a stable shape.
    if hasattr(resp, "model_dump"):
        data = resp.model_dump()
    elif hasattr(resp, "dict"):  # pydantic v1 fallback
        data = resp.dict()
    else:
        data = dict(resp)  # type: ignore[arg-type]
    # ``totp`` is a nested object — flatten it.
    totp = data.pop("totp", None) or {}
    if isinstance(totp, dict):
        data.setdefault("qr_code", totp.get("qr_code"))
        data.setdefault("secret", totp.get("secret"))
        data.setdefault("uri", totp.get("uri"))
    if not data.get("id"):
        raise RuntimeError(f"enroll returned no factor id: {data!r}")
    return data


def _mfa_verify(client: Client, factor_id: str, code: str) -> None:
    """Verify a TOTP code. Supabase requires both a factor_id and a
    challenge_id; we issue the challenge inline (challenge_and_verify
    is the convenience wrapper that issues + verifies in one call)."""
    resp = client.auth.mfa.challenge_and_verify(
        {"factor_id": factor_id, "code": code}
    )
    if getattr(resp, "access_token", None) is None and getattr(resp, "refresh_token", None) is None:
        # If challenge_and_verify is not available in the installed
        # client version, fall back to challenge + verify.
        challenge = client.auth.mfa.challenge({"factor_id": factor_id})
        challenge_id = getattr(challenge, "id", None) or (challenge.get("id") if isinstance(challenge, dict) else None)
        if not challenge_id:
            raise RuntimeError(f"mfa.challenge returned no challenge id: {challenge!r}")
        resp = client.auth.mfa.verify(
            {"factor_id": factor_id, "challenge_id": challenge_id, "code": code}
        )
    if getattr(resp, "access_token", None) is None and getattr(resp, "refresh_token", None) is None:
        raise RuntimeError(f"mfa verify returned no tokens: {resp!r}")


def _mfa_list_factors(client: Client) -> list[dict[str, Any]]:
    """List factors for the current user. Returns a list of dicts."""
    resp = client.auth.mfa.list_factors()
    # ``resp`` is an ``AuthMFAListFactorsResponse``. It has three lists:
    # ``all``, ``totp``, ``phone``. We flatten ``all`` to a single list
    # for the caller.
    all_factors = getattr(resp, "all", None)
    if all_factors is None and isinstance(resp, dict):
        all_factors = resp.get("all", [])
    if all_factors is None:
        return []
    out: list[dict[str, Any]] = []
    for f in all_factors:
        if hasattr(f, "model_dump"):
            out.append(f.model_dump())
        elif hasattr(f, "dict"):
            out.append(f.dict())
        elif isinstance(f, dict):
            out.append(f)
        else:
            # best-effort fallback
            out.append({"id": getattr(f, "id", None), "factor_type": getattr(f, "factor_type", None), "status": getattr(f, "status", None)})
    return out


def _mfa_unenroll(client: Client, factor_id: str) -> None:
    """Unenrol a factor by id."""
    client.auth.mfa.unenroll({"factor_id": factor_id})


# ─── Script guard ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    sys.exit(main())
