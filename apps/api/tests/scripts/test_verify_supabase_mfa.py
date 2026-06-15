"""
Tests for ``scripts/verify_supabase_mfa.py``.

We mock the supabase client entirely. The script's own logic — env
detection, the offline skip, the happy-path ordering, and the cleanup
guarantee — is what we are exercising here. The real Supabase Admin
API is exercised separately when an operator runs the script with
``SUPABASE_SERVICE_ROLE_KEY`` set (see ``docs/supabase-mfa-setup.md``).

The mock client's shape matches ``supabase.Client``. Specifically:

* ``client.auth.admin.create_user``  → returns an object with ``.user.id``
* ``client.auth.admin.delete_user``  → no-op
* ``client.auth.sign_in_with_password`` → returns an object with ``.session``
* ``client.auth.mfa.enroll``         → returns an enroll response object
* ``client.auth.mfa.challenge_and_verify`` → returns a tokens-bearing object
* ``client.auth.mfa.list_factors``   → returns an object with ``.all``
* ``client.auth.mfa.unenroll``       → no-op

Run with::

    cd apps/api
    python -m pytest tests/scripts/test_verify_supabase_mfa.py -v
"""

from __future__ import annotations

import importlib.util
import sys
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ─── Import the script under test ─────────────────────────────────────────
# The script lives in ``apps/api/scripts/`` (sibling of ``app/``), not
# under the ``app`` package. We load it by file path so pytest doesn't
# need an ``__init__.py`` in ``scripts/`` and so the script's top-level
# imports (``pyotp``, ``supabase``) are evaluated against the same
# interpreter as the test.
_SCRIPT_PATH = (
    Path(__file__).resolve().parents[2]
    / "scripts"
    / "verify_supabase_mfa.py"
)
if not _SCRIPT_PATH.exists():
    raise RuntimeError(f"verify_supabase_mfa.py not found at {_SCRIPT_PATH}")

_spec = importlib.util.spec_from_file_location(
    "verify_supabase_mfa", str(_SCRIPT_PATH)
)
assert _spec is not None and _spec.loader is not None
_script = importlib.util.module_from_spec(_spec)
sys.modules["verify_supabase_mfa"] = _script
_spec.loader.exec_module(_script)


# ─── Fixtures ─────────────────────────────────────────────────────────────
@pytest.fixture
def clean_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
    unset for the duration of the test, regardless of what the
    developer has in their shell."""
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    yield


@pytest.fixture
def fake_enroll_response() -> MagicMock:
    """Mock the pydantic-ish ``AuthMFAEnrollResponse`` object."""
    resp = MagicMock()
    resp.id = "factor-abc-123"
    resp.type = "totp"
    resp.friendly_name = "verify-harness"
    resp.phone = None
    # ``totp`` is a nested object — pydantic v2 in the real SDK would
    # return a nested model, not a dict. Mirror that.
    resp.totp = MagicMock()
    resp.totp.qr_code = "data:image/svg+xml;utf-8,<svg/>"
    resp.totp.secret = "JBSWY3DPEHPK3PXP"  # 16 chars, the example from RFC 6238
    resp.totp.uri = "otpauth://totp/getpdfpro:test?secret=JBSWY3DPEHPK3PXP"
    # ``model_dump`` returns the dict form. Tests can also assert on
    # the attrs directly.
    resp.model_dump.return_value = {
        "id": "factor-abc-123",
        "type": "totp",
        "friendly_name": "verify-harness",
        "phone": None,
        "totp": {
            "qr_code": "data:image/svg+xml;utf-8,<svg/>",
            "secret": "JBSWY3DPEHPK3PXP",
            "uri": "otpauth://totp/getpdfpro:test?secret=JBSWY3DPEHPK3PXP",
        },
    }
    return resp


@pytest.fixture
def fake_list_response() -> MagicMock:
    """Mock the pydantic ``AuthMFAListFactorsResponse`` with one
    verified TOTP factor."""
    factor = MagicMock()
    factor.id = "factor-abc-123"
    factor.friendly_name = "verify-harness"
    factor.factor_type = "totp"
    factor.status = "verified"
    factor.created_at = datetime(2026, 1, 1, tzinfo=UTC)
    factor.updated_at = datetime(2026, 1, 1, tzinfo=UTC)
    factor.model_dump.return_value = {
        "id": "factor-abc-123",
        "friendly_name": "verify-harness",
        "factor_type": "totp",
        "status": "verified",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }

    resp = MagicMock()
    resp.all = [factor]
    resp.totp = [factor]
    resp.phone = []
    return resp


@pytest.fixture
def fake_verify_response() -> MagicMock:
    """Mock the pydantic ``AuthMFAVerifyResponse`` with new tokens."""
    resp = MagicMock()
    resp.access_token = "eyJ_access_token_for_test"
    resp.token_type = "bearer"
    resp.expires_in = 3600
    resp.refresh_token = "v1_refresh_token_for_test"
    resp.user = MagicMock(id="user-xyz-789")
    return resp


@pytest.fixture
def mock_client_factory(
    fake_enroll_response: MagicMock,
    fake_list_response: MagicMock,
    fake_verify_response: MagicMock,
) -> Iterator[MagicMock]:
    """Yield a MagicMock that pretends to be the supabase.Client
    returned by ``create_client``. Each test can adjust the mocks to
    simulate failure cases."""
    with patch.object(_script, "create_client") as mock_create:
        client = MagicMock()
        # Admin
        admin_user = MagicMock(id="user-xyz-789")
        client.auth.admin.create_user.return_value = MagicMock(user=admin_user)
        client.auth.admin.delete_user.return_value = None
        # Sign-in
        client.auth.sign_in_with_password.return_value = MagicMock(
            session=MagicMock(access_token="session-tok")
        )
        # MFA
        client.auth.mfa.enroll.return_value = fake_enroll_response
        client.auth.mfa.challenge_and_verify.return_value = fake_verify_response
        client.auth.mfa.list_factors.return_value = fake_list_response
        client.auth.mfa.unenroll.return_value = MagicMock(id="factor-abc-123")
        mock_create.return_value = client
        yield client


# ─── Tests ────────────────────────────────────────────────────────────────
class TestSkipWhenEnvMissing:
    """Section A: the offline path. The script must exit 0 and print a
    clear skip banner so CI does not break for developers who don't
    have the service role key."""

    def test_both_env_unset_exits_zero_with_skip_message(
        self, clean_env: None, capsys: pytest.CaptureFixture[str]
    ) -> None:
        rc = _script.main()
        captured = capsys.readouterr()

        assert rc == 0, "missing env vars should be a skip (exit 0), not a failure"
        assert "skip:" in captured.out
        assert "SUPABASE_URL" in captured.out
        assert "SUPABASE_SERVICE_ROLE_KEY" in captured.out
        # The script must NOT print the success line in offline mode.
        assert "OK: Supabase MFA verified" not in captured.out

    def test_only_url_set_still_skips(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        rc = _script.main()
        assert rc == 0

    def test_only_key_set_still_skips(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x")
        rc = _script.main()
        assert rc == 0

    def test_empty_env_values_count_as_unset(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Empty strings are a real foot-gun — treat them the same as
        # "not set".
        monkeypatch.setenv("SUPABASE_URL", "")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
        rc = _script.main()
        assert rc == 0


class TestHappyPathOnline:
    """Section B: the live path with everything mocked. Exercises the
    full flow — create user, sign in, enrol, verify, list, unenroll,
    delete — and asserts the success banner is printed."""

    def test_full_flow_prints_ok(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mock_client_factory: MagicMock,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        monkeypatch.setenv("SUPABASE_URL", "https://osjtyipxwpkmzsextbne.supabase.co")
        monkeypatch.setenv(
            "SUPABASE_SERVICE_ROLE_KEY",
            "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.fake_sig",
        )

        with caplog.at_level("INFO", logger="verify_supabase_mfa"):
            rc = _script.main()
        combined = caplog.text

        assert rc == 0, f"happy path should exit 0; got {rc}. output:\n{combined}"
        assert "OK: Supabase MFA verified" in combined

    def test_full_flow_calls_all_expected_methods(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mock_client_factory: MagicMock,
    ) -> None:
        monkeypatch.setenv("SUPABASE_URL", "https://osjtyipxwpkmzsextbne.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x")

        rc = _script.main()
        assert rc == 0

        client = mock_client_factory
        # Admin
        client.auth.admin.create_user.assert_called_once()
        client.auth.admin.delete_user.assert_called_once()
        # Sign-in
        client.auth.sign_in_with_password.assert_called_once()
        # MFA
        client.auth.mfa.enroll.assert_called_once()
        # challenge_and_verify is the wrapper; the script does NOT need
        # to fall back to challenge+verify when it succeeds.
        client.auth.mfa.challenge_and_verify.assert_called_once()
        client.auth.mfa.list_factors.assert_called_once()
        client.auth.mfa.unenroll.assert_called_once()

    def test_enroll_factor_type_is_totp(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mock_client_factory: MagicMock,
    ) -> None:
        monkeypatch.setenv("SUPABASE_URL", "https://osjtyipxwpkmzsextbne.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x")

        rc = _script.main()
        assert rc == 0

        # Inspect the kwargs to ``mfa.enroll``.
        call = mock_client_factory.auth.mfa.enroll.call_args
        args, kwargs = call
        # The script may pass either positionally or by keyword. The
        # shape we care about is the same.
        params = kwargs.get("params") or (args[0] if args else None)
        assert params is not None, "mfa.enroll was not called with any params"
        # The SDK accepts either a TypedDict-style dict or a model
        # instance. We always pass a dict.
        assert isinstance(params, dict)
        assert params.get("factor_type") == "totp"

    def test_secret_returned_by_enroll_is_used_to_compute_totp(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mock_client_factory: MagicMock,
    ) -> None:
        """The verify code must be derived from the secret returned by
        ``enroll`` — not a hard-coded value. We patch ``pyotp.TOTP`` to
        capture the secret passed in."""
        monkeypatch.setenv("SUPABASE_URL", "https://osjtyipxwpkmzsextbne.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x")

        # Patch the ``pyotp.TOTP`` inside the *script* module (not the
        # top-level pyotp module — the script imported it as a name).
        with patch.object(_script.pyotp, "TOTP") as mock_totp:
            mock_instance = MagicMock()
            mock_instance.now.return_value = "123456"
            mock_totp.return_value = mock_instance

            rc = _script.main()
            assert rc == 0

            # The secret from the enroll mock is "JBSWY3DPEHPK3PXP".
            mock_totp.assert_called_once_with("JBSWY3DPEHPK3PXP")
            mock_instance.now.assert_called_once()

            # And the verify call must have used the code "123456".
            verify_call = mock_client_factory.auth.mfa.challenge_and_verify.call_args
            args, kwargs = verify_call
            params = kwargs.get("params") or (args[0] if args else {})
            assert params.get("code") == "123456"
            assert params.get("factor_id") == "factor-abc-123"


class TestCleanupRunsOnFailure:
    """Section C: when the happy path blows up mid-flow, the test user
    must still be deleted. This is what stops a buggy release from
    leaking thousands of ``mfa-verify-*`` rows in ``auth.users``."""

    def test_failure_after_enroll_still_deletes_user(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mock_client_factory: MagicMock,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        monkeypatch.setenv("SUPABASE_URL", "https://osjtyipxwpkmzsextbne.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x")

        # Make ``mfa.challenge_and_verify`` throw — this is roughly
        # "step c) of the flow" in the task description: enrolment
        # succeeded, but verification blew up (e.g. service returned
        # 500 mid-handshake).
        mock_client_factory.auth.mfa.challenge_and_verify.side_effect = RuntimeError(
            "simulated 500 from /auth/v1/factors/.../verify"
        )

        with caplog.at_level("INFO", logger="verify_supabase_mfa"):
            rc = _script.main()
        combined = caplog.text

        # The script should report failure (exit 1) and NOT print the
        # "OK" banner.
        assert rc == 1
        assert "OK: Supabase MFA verified" not in combined
        assert "verification failed" in combined

        # The critical assertion: the user is still deleted.
        mock_client_factory.auth.admin.delete_user.assert_called_once()
        # The id passed to delete_user is the id returned by
        # create_user in the mock factory.
        delete_call = mock_client_factory.auth.admin.delete_user.call_args
        args, kwargs = delete_call
        passed_id = kwargs.get("id") or (args[0] if args else None)
        assert passed_id == "user-xyz-789"

    def test_failure_during_list_factors_still_deletes_user(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mock_client_factory: MagicMock,
    ) -> None:
        monkeypatch.setenv("SUPABASE_URL", "https://osjtyipxwpkmzsextbne.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x")

        # Different failure point: list_factors raises.
        mock_client_factory.auth.mfa.list_factors.side_effect = RuntimeError(
            "simulated 502 from /auth/v1/factors"
        )

        rc = _script.main()
        assert rc == 1
        mock_client_factory.auth.admin.delete_user.assert_called_once()

    def test_cleanup_failure_is_logged_but_does_not_change_exit_code(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mock_client_factory: MagicMock,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """If BOTH the main flow AND the cleanup fail, the script must
        still report the original flow failure (exit 1) and log the
        cleanup failure as a warning. This protects us from
        accidentally hiding a real bug behind a 'skip' exit code."""
        monkeypatch.setenv("SUPABASE_URL", "https://osjtyipxwpkmzsextbne.supabase.co")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x")

        # Flow failure
        mock_client_factory.auth.mfa.challenge_and_verify.side_effect = RuntimeError(
            "flow error"
        )
        # Cleanup also fails
        mock_client_factory.auth.admin.delete_user.side_effect = RuntimeError(
            "cleanup error"
        )

        with caplog.at_level("INFO", logger="verify_supabase_mfa"):
            rc = _script.main()
        combined = caplog.text

        # Original failure still surfaces.
        assert rc == 1
        assert "verification failed" in combined
        # Cleanup failure is logged (so the operator can fix it
        # manually) but does not change the exit code.
        assert "cleanup failed" in combined

    def test_invalid_supabase_url_fails_fast(
        self,
        monkeypatch: pytest.MonkeyPatch,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """A clearly-wrong URL (e.g. dev pasted the anon key URL) must
        be rejected before we try to hit the network."""
        monkeypatch.setenv("SUPABASE_URL", "https://example.com/wat")
        monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_x")

        with caplog.at_level("INFO", logger="verify_supabase_mfa"):
            rc = _script.main()
        combined = caplog.text

        assert rc == 1
        assert "does not look like a Supabase project URL" in combined
