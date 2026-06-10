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
