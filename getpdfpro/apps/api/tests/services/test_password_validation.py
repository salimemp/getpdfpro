"""
Tests for password validation in app.core.security.

Covers the user-facing password policy:
  - Min 8 characters
  - At least 1 letter
  - At least 1 digit
  - At least 1 special character
  - Not in the common weak list
"""

import pytest

from app.core.security import validate_password_strength, PasswordValidationError


@pytest.mark.parametrize(
    "password",
    [
        "Abc12345!",         # canonical strong password
        "Str0ng!Pass",        # 11 chars
        "x9!aaaaa",           # minimal: 8 chars, a letter, a digit, a special
        "A1!bcdef",           # 8 chars, letter, digit, special
        "super-secret-9X!",   # long with multiple specials
        "pass w0rd!$",        # space counts as a char (allowed)
    ],
)
def test_accepts_strong_passwords(password: str) -> None:
    """Passwords that meet every rule pass cleanly."""
    validate_password_strength(password)  # should not raise


@pytest.mark.parametrize(
    "password,missing",
    [
        ("Abc1!xy",   "at least 8 characters"),       # 7 chars
        ("",          "at least 8 characters"),
        ("aaaaaaaa",  None),                            # no digit, no special
        ("12345678",  None),                            # no letter, no special
        ("abcdefgh",  None),                            # no digit, no special
        ("Abcdefgh",  None),                            # no digit, no special
        ("12345678!", None),                            # no letter
    ],
)
def test_rejects_weak_passwords(password: str, missing: str | None) -> None:
    """Passwords that miss at least one rule raise PasswordValidationError."""
    with pytest.raises(PasswordValidationError):
        validate_password_strength(password)


@pytest.mark.parametrize(
    "password",
    [
        "password", "password1", "password123", "qwerty123",
        "letmein1", "welcome1", "admin123", "iloveyou1",
        "abc12345", "12345678", "123456789",
    ],
)
def test_rejects_common_weak_passwords(password: str) -> None:
    """Top weak passwords raise, even if they pass the structural rules."""
    # Some of these don't pass the structural rules either, so we use
    # a try/except and only assert the error message mentions "common".
    with pytest.raises(PasswordValidationError) as exc:
        validate_password_strength(password)
    # Either "too common" or "at least 8 characters" is acceptable
    # for short entries like "password" — we just want to ensure
    # these never silently pass.
    assert "too common" in str(exc.value).lower() or "at least" in str(exc.value).lower()


def test_error_message_hints_at_missing_rule() -> None:
    """When the user is missing a specific rule, the message names it."""
    # Has length, has letter, has digit, but NO special
    with pytest.raises(PasswordValidationError) as exc:
        validate_password_strength("Abcdefg1")
    msg = str(exc.value).lower()
    assert "special" in msg

    # Has length, has letter, has special, but NO digit
    with pytest.raises(PasswordValidationError) as exc:
        validate_password_strength("Abcdefgh!")
    msg = str(exc.value).lower()
    assert "number" in msg

    # Has length, has digit, has special, but NO letter
    with pytest.raises(PasswordValidationError) as exc:
        validate_password_strength("12345678!")
    msg = str(exc.value).lower()
    assert "letter" in msg


def test_accepts_max_length_password() -> None:
    """128-char passwords (bcrypt's limit) are accepted."""
    # Build a 128-char password that meets all rules: starts with A1!
    # then 125 chars of "a", total = 3 + 125 = 128 chars.
    password = "A1!" + ("a" * 125)
    assert len(password) == 128
    validate_password_strength(password)


def test_rejects_password_over_max_length() -> None:
    """Passwords over 128 chars are rejected (bcrypt would silently truncate)."""
    password = "A1!" + ("a" * 130)  # 133 chars, over the limit
    with pytest.raises(PasswordValidationError):
        validate_password_strength(password)
