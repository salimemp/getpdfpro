"""Celery application + task definitions.

Tasks here are simple / illustrative for the MVP — they perform a real
piece of work (PDF text extraction, merge) and return a small result
dict. The API enqueues them with `.delay()` and returns a task_id to
the client; clients poll the status endpoint.

Why Celery on the same image as the API:
- One Dockerfile pattern, two CMDs (Dockerfile.api / Dockerfile.worker).
- One requirements file, one Python environment.
- Railway can run both services from the same repo with the same code.
"""

from __future__ import annotations

import io
import os
import time
import uuid
from typing import Any

import fitz  # PyMuPDF
import structlog
from celery import Celery, signals
from celery.utils.log import get_task_logger

from app.config import get_settings

# ─── Celery app ────────────────────────────────────────────────
# Broker = Redis URL from settings. Falls back to env so Railway's
# REDIS_URL auto-injected from the linked Redis service works even
# if the app boots before Settings is fully populated.
REDIS_URL = os.getenv("REDIS_URL") or get_settings().redis_url

celery_app = Celery(
    "getpdfpro",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.celery_app"],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Time
    timezone="UTC",
    enable_utc=True,

    # Reliability
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,

    # Result TTL
    result_expires=3600,

    # Retry
    task_default_retry_delay=30,
    task_default_max_retries=3,

    # Queues
    task_default_queue="default",
    task_routes={
        "app.celery_app.process_pdf_job": {"queue": "default"},
        "app.celery_app.cleanup_old_uploads": {"queue": "maintenance"},
    },

    # Beat schedule — periodic tasks. ``cleanup_old_uploads`` runs
    # every 15 minutes and deletes uploaded files older than 1h from
    # the R2 bucket. The interval is intentionally tighter than the
    # TTL so a missed run doesn't let the bucket grow unbounded.
    beat_schedule={
        "cleanup-old-uploads-hourly": {
            "task": "app.celery_app.cleanup_old_uploads",
            # 15min cadence. max_age_seconds=3600 (1h) is the default.
            "schedule": 15 * 60,
            "kwargs": {"max_age_seconds": 3600},
            "options": {"queue": "maintenance"},
        },
    },
)

logger = structlog.get_logger()
celery_log = get_task_logger(__name__)


# ─── Result helpers ────────────────────────────────────────────
def _new_job_id() -> str:
    return str(uuid.uuid4())


# ─── Tasks ─────────────────────────────────────────────────────
@celery_app.task(
    name="app.celery_app.process_pdf_job",
    bind=True,
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
)
def process_pdf_job(
    self,
    job_id: str | None = None,
    job_type: str = "pdf_to_text",
    file_b64: str | None = None,
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Process a single PDF job.

    job_type ∈ {"pdf_to_text", "merge", "compress", "rotate", ...}
    file_b64: base64-encoded PDF bytes (small files only — large files
              should use the signed-URL upload flow, not implemented yet).
    """
    job_id = job_id or _new_job_id()
    options = options or {}
    log = logger.bind(job_id=job_id, job_type=job_type)
    log.info("job_started")

    import base64

    if not file_b64:
        return {"job_id": job_id, "status": "failed", "error": "missing file_b64"}

    started = time.monotonic()
    try:
        blob = base64.b64decode(file_b64)
    except Exception as exc:
        return {"job_id": job_id, "status": "failed", "error": f"invalid base64: {exc}"}

    if not blob:
        return {"job_id": job_id, "status": "failed", "error": "empty file"}

    # ─── Dispatch ────────────────────────────────────────────
    if job_type == "pdf_to_text":
        try:
            pdf = fitz.open(stream=blob, filetype="pdf")
        except Exception as exc:
            return {"job_id": job_id, "status": "failed", "error": f"open failed: {exc}"}

        try:
            text = "\n".join(page.get_text() for page in pdf)
            pages = len(pdf)
        finally:
            pdf.close()

        elapsed = round((time.monotonic() - started) * 1000, 1)
        log.info("job_done", pages=pages, elapsed_ms=elapsed, chars=len(text))
        return {
            "job_id": job_id,
            "status": "completed",
            "job_type": job_type,
            "pages": pages,
            "chars": len(text),
            "elapsed_ms": elapsed,
            # We return text inline for small jobs; large outputs will move
            # to R2 in the next iteration.
            "result": {"text": text},
        }

    if job_type == "merge":
        # options["files_b64"]: list of base64-encoded PDFs
        files_b64 = options.get("files_b64") or []
        if len(files_b64) < 2:
            return {"job_id": job_id, "status": "failed", "error": "merge needs >= 2 files"}

        blobs: list[bytes] = [base64.b64decode(x) for x in files_b64]
        result = fitz.open()
        try:
            for b in blobs:
                src = fitz.open(stream=b, filetype="pdf")
                try:
                    result.insert_pdf(src)
                finally:
                    src.close()
            buf = io.BytesIO()
            result.save(buf)
            payload = buf.getvalue()
        finally:
            result.close()

        elapsed = round((time.monotonic() - started) * 1000, 1)
        log.info(
            "job_done",
            pages=len(payload) and None,  # placeholder
            elapsed_ms=elapsed,
            size_bytes=len(payload),
        )
        return {
            "job_id": job_id,
            "status": "completed",
            "job_type": job_type,
            "pages": None,
            "size_bytes": len(payload),
            "elapsed_ms": elapsed,
        }

    return {
        "job_id": job_id,
        "status": "failed",
        "error": f"unsupported job_type: {job_type}",
    }


# ─── Convenience for app startup log ──────────────────────────
@signals.worker_ready.connect
def _on_worker_ready(sender, **_: Any) -> None:
    logger.info("celery_worker_ready", hostname=getattr(sender, "hostname", "?"))


# ─── R2 cleanup task ─────────────────────────────────────────
def _r2_client():
    """Build a Cloudflare R2 S3 client from settings. Returns None
    if the required R2 credentials are not configured (so the
    cleanup task can no-op cleanly in dev)."""
    import boto3  # lazy: boto3 is heavy and not every worker needs it

    s = get_settings()
    if not (s.r2_account_id and s.r2_access_key_id and s.r2_secret_access_key):
        return None, None
    client = boto3.client(
        "s3",
        endpoint_url=f"https://{s.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=s.r2_access_key_id,
        aws_secret_access_key=s.r2_secret_access_key,
        region_name="auto",  # R2 ignores region but boto3 requires it
    )
    return client, s.r2_bucket


@celery_app.task(
    name="app.celery_app.cleanup_old_uploads",
    bind=True,
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
)
def cleanup_old_uploads(self, max_age_seconds: int = 3600) -> dict[str, Any]:
    """Delete uploaded files older than ``max_age_seconds`` from the
    R2 bucket. Default 1h — this is what the marketing page
    promises ("uploaded files auto-delete after 1 hour"). Runs every
    15min via the beat schedule.

    The function is split into a pure core (``_cleanup_old_uploads_core``)
    and a thin Celery wrapper so the test suite can call the core
    directly with a mock boto3 client. The Celery wrapper is the
    version that runs in the worker.
    """
    return _cleanup_old_uploads_core(max_age_seconds)


def _cleanup_old_uploads_core(max_age_seconds: int) -> dict[str, Any]:
    """Pure-Python core. Takes ``max_age_seconds`` as input and
    returns a small result dict. Reads R2 creds from settings and
    deletes objects whose ``LastModified`` is older than the cutoff.
    Paginates with ``list_objects_v2`` continuation tokens."""
    import time as _time
    from datetime import datetime, timedelta, timezone

    log = logger.bind(task="cleanup_old_uploads", max_age_seconds=max_age_seconds)
    client, bucket = _r2_client()
    if client is None or not bucket:
        log.warning("r2_not_configured_skipping_cleanup")
        return {"status": "skipped", "reason": "r2_not_configured", "deleted": 0}

    cutoff = datetime.now(tz=timezone.utc) - timedelta(seconds=max_age_seconds)
    log.info("cleanup_started", cutoff=cutoff.isoformat(), bucket=bucket)

    deleted = 0
    errors = 0
    paginator_token: str | None = None
    pages = 0

    try:
        while True:
            pages += 1
            kwargs: dict[str, Any] = {"Bucket": bucket, "MaxKeys": 1000}
            if paginator_token:
                kwargs["ContinuationToken"] = paginator_token
            resp = client.list_objects_v2(**kwargs)
            contents = resp.get("Contents", []) or []
            for obj in contents:
                lm = obj.get("LastModified")
                key = obj.get("Key")
                if not lm or not key:
                    continue
                # boto3 returns a timezone-aware datetime.
                if lm < cutoff:
                    try:
                        client.delete_object(Bucket=bucket, Key=key)
                        deleted += 1
                    except Exception as exc:  # noqa: BLE001
                        errors += 1
                        log.warning(
                            "delete_object_failed", key=key, error=str(exc)
                        )
            truncated = resp.get("IsTruncated")
            paginator_token = resp.get("NextContinuationToken")
            if not truncated or not paginator_token:
                break
            # Safety cap so a misconfigured bucket can't pin a worker.
            if pages > 100:
                log.warning("cleanup_pagination_cap_reached", pages=pages)
                break
    except Exception as exc:
        log.exception("cleanup_failed")
        return {
            "status": "failed",
            "error": str(exc),
            "deleted": deleted,
            "errors": errors,
        }

    elapsed_ms = round(_time.monotonic() * 1000)
    log.info("cleanup_done", deleted=deleted, errors=errors, pages=pages)
    return {
        "status": "ok",
        "deleted": deleted,
        "errors": errors,
        "pages": pages,
    }
