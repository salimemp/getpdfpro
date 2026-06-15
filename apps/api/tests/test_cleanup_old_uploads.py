"""
Tests for ``app.celery_app.cleanup_old_uploads``.

The R2 cleanup is a background task — we test the core
(``_cleanup_old_uploads_core``) directly with a mocked boto3 client
and a mock settings object. No live R2 / boto3 calls.

What we cover:

* happy path: lists a page of objects, deletes the stale ones,
  paginates, returns the deleted count.
* skip path: no R2 creds → returns ``{"status": "skipped", ...}``
  without trying to build a boto3 client.
* mixed page: some objects old, some fresh → only the old ones
  are deleted.
* error path: ``delete_object`` raises on one key → counted in
  ``errors``; the rest of the page still gets processed.
* empty bucket: zero pages of contents → ``deleted=0``.
"""

from __future__ import annotations

import importlib
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


# ─── Fixtures ─────────────────────────────────────────────────────────────
@pytest.fixture
def fake_settings() -> SimpleNamespace:
    """Settings stand-in. R2 creds are populated; bucket is set."""
    return SimpleNamespace(
        r2_account_id="test-account",
        r2_access_key_id="test-key",
        r2_secret_access_key="test-secret",
        r2_bucket="getpdfpro-uploads",
    )


@pytest.fixture
def celery_module(monkeypatch: pytest.MonkeyPatch, fake_settings: SimpleNamespace):
    """Reload ``app.celery_app`` with our fake settings. Avoids the
    real lru_cache on get_settings()."""
    # Force a fresh import
    for mod in list(sys.modules):
        if mod == "app.celery_app" or mod.startswith("app.celery_app."):
            del sys.modules[mod]

    # Patch get_settings before the import
    import app.config as config_module
    monkeypatch.setattr(config_module, "get_settings", lambda: fake_settings)

    import app.celery_app  # noqa: F401  (registers the task)
    return app.celery_app


def _make_obj(key: str, age_seconds: int) -> dict:
    """Build a fake S3 object entry with a LastModified timestamp
    ``age_seconds`` in the past."""
    lm = datetime.now(tz=timezone.utc) - timedelta(seconds=age_seconds)
    return {"Key": key, "LastModified": lm, "Size": 1024, "ETag": '"x"'}


def _make_list_response(objects: list[dict], *, truncated: bool = False, next_token: str | None = None) -> dict:
    return {
        "Contents": objects,
        "IsTruncated": truncated,
        "NextContinuationToken": next_token,
        "Name": "getpdfpro-uploads",
        "Prefix": "",
        "MaxKeys": 1000,
        "KeyCount": len(objects),
    }


# ─── Tests ────────────────────────────────────────────────────────────────
class TestHappyPath:
    """Mixed page of fresh and stale objects — only the stale ones
    are deleted, and the count is correct."""

    def test_deletes_only_stale_objects(
        self,
        celery_module: Any,
        fake_settings: SimpleNamespace,
    ) -> None:
        old1 = _make_obj("uploads/old1.pdf", age_seconds=7200)  # 2h old
        old2 = _make_obj("uploads/old2.pdf", age_seconds=4000)  # ~66min
        fresh = _make_obj("uploads/fresh.pdf", age_seconds=300)  # 5min

        mock_client = MagicMock()
        mock_client.list_objects_v2.return_value = _make_list_response([old1, old2, fresh])

        with patch.object(celery_module, "_r2_client", return_value=(mock_client, "getpdfpro-uploads")):
            result = celery_module._cleanup_old_uploads_core(max_age_seconds=3600)

        assert result["status"] == "ok"
        assert result["deleted"] == 2
        assert result["errors"] == 0
        # Only the old keys are deleted.
        deleted_keys = sorted(
            call.kwargs["Key"] for call in mock_client.delete_object.call_args_list
        )
        assert deleted_keys == ["uploads/old1.pdf", "uploads/old2.pdf"]

    def test_returns_zero_when_bucket_empty(
        self,
        celery_module: Any,
    ) -> None:
        mock_client = MagicMock()
        mock_client.list_objects_v2.return_value = _make_list_response([])

        with patch.object(celery_module, "_r2_client", return_value=(mock_client, "getpdfpro-uploads")):
            result = celery_module._cleanup_old_uploads_core(max_age_seconds=3600)

        assert result["status"] == "ok"
        assert result["deleted"] == 0
        assert result["errors"] == 0
        mock_client.delete_object.assert_not_called()

    def test_paginates_until_truncation_false(
        self,
        celery_module: Any,
    ) -> None:
        page1 = _make_list_response(
            [_make_obj("a.pdf", 7200)], truncated=True, next_token="t1"
        )
        page2 = _make_list_response(
            [_make_obj("b.pdf", 7200)], truncated=True, next_token="t2"
        )
        page3 = _make_list_response(
            [_make_obj("c.pdf", 7200)], truncated=False
        )
        mock_client = MagicMock()
        mock_client.list_objects_v2.side_effect = [page1, page2, page3]

        with patch.object(celery_module, "_r2_client", return_value=(mock_client, "getpdfpro-uploads")):
            result = celery_module._cleanup_old_uploads_core(max_age_seconds=3600)

        assert result["deleted"] == 3
        assert mock_client.list_objects_v2.call_count == 3
        # Pagination token is passed on calls 2 and 3.
        call2_kwargs = mock_client.list_objects_v2.call_args_list[1].kwargs
        assert call2_kwargs.get("ContinuationToken") == "t1"


class TestSkipWhenR2NotConfigured:
    """If R2 creds are missing, the task must no-op cleanly with
    a clear status. This is the same fail-soft shape the verify
    script uses for Supabase — a fresh dev venv without R2 creds
    can't crash the worker."""

    def test_returns_skipped_when_no_creds(
        self,
        celery_module: Any,
    ) -> None:
        with patch.object(celery_module, "_r2_client", return_value=(None, None)):
            result = celery_module._cleanup_old_uploads_core(max_age_seconds=3600)

        assert result["status"] == "skipped"
        assert result["reason"] == "r2_not_configured"
        assert result["deleted"] == 0


class TestErrorHandling:
    """If a single ``delete_object`` call fails, the error is
    counted and the loop continues with the remaining objects."""

    def test_delete_failure_counted_but_loop_continues(
        self,
        celery_module: Any,
    ) -> None:
        objects = [
            _make_obj("fail.pdf", 7200),
            _make_obj("ok.pdf", 7200),
        ]
        mock_client = MagicMock()
        mock_client.list_objects_v2.return_value = _make_list_response(objects)
        # First call raises, second succeeds.
        mock_client.delete_object.side_effect = [
            RuntimeError("s3 500"),
            None,
        ]

        with patch.object(celery_module, "_r2_client", return_value=(mock_client, "getpdfpro-uploads")):
            result = celery_module._cleanup_old_uploads_core(max_age_seconds=3600)

        assert result["status"] == "ok"
        assert result["deleted"] == 1
        assert result["errors"] == 1

    def test_list_failure_returns_failed_status(
        self,
        celery_module: Any,
    ) -> None:
        mock_client = MagicMock()
        mock_client.list_objects_v2.side_effect = RuntimeError("network down")

        with patch.object(celery_module, "_r2_client", return_value=(mock_client, "getpdfpro-uploads")):
            result = celery_module._cleanup_old_uploads_core(max_age_seconds=3600)

        assert result["status"] == "failed"
        assert "network down" in result["error"]


class TestCeleryTaskRegistration:
    """The task should be registered with the celery app and callable
    via ``.delay()`` without actually running (we just check
    registration, not the worker)."""

    def test_task_is_registered(self, celery_module: Any) -> None:
        # ``cleanup_old_uploads`` should be a Celery Task instance.
        assert hasattr(celery_module, "cleanup_old_uploads")
        assert celery_module.cleanup_old_uploads.name == "app.celery_app.cleanup_old_uploads"

    def test_beat_schedule_has_cleanup_entry(self, celery_module: Any) -> None:
        beat = celery_module.celery_app.conf.beat_schedule
        assert "cleanup-old-uploads-hourly" in beat
        entry = beat["cleanup-old-uploads-hourly"]
        assert entry["task"] == "app.celery_app.cleanup_old_uploads"
        # 15min cadence = 900s.
        assert entry["schedule"] == 15 * 60
        assert entry["kwargs"]["max_age_seconds"] == 3600
