"""Async job endpoints — enqueue a Celery task, return task_id; client polls for status.

This is the public-facing path for the heavy PDF tools (merge, compress,
convert). Sync endpoints in `routers/pdf.py` stay for the small-file fast
track; anything > 50 MB or any AI job goes through the queue.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.celery_app import process_pdf_job

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────
class JobEnqueueRequest(BaseModel):
    job_type: str = Field(..., description="One of: pdf_to_text, merge, compress, rotate, ...")
    file_b64: str | None = Field(
        default=None,
        description="Base64-encoded PDF. Required for single-file jobs.",
    )
    options: dict[str, Any] = Field(
        default_factory=dict,
        description="Job-specific options. For 'merge', pass {'files_b64': [b64, b64, ...]}.",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "job_type": "pdf_to_text",
                "file_b64": "JVBERi0xLjQKJeLjz9MK...",
                "options": {},
            }
        }


class JobEnqueueResponse(BaseModel):
    task_id: str
    job_id: str
    status: str = "queued"


class JobStatusResponse(BaseModel):
    task_id: str
    job_id: str
    status: str
    result: dict[str, Any] | None = None
    error: str | None = None


# ─── Routes ───────────────────────────────────────────────────
@router.post(
    "/jobs",
    response_model=JobEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue an async PDF job (Celery)",
)
async def enqueue_job(req: JobEnqueueRequest) -> JobEnqueueResponse:
    """Submit a PDF job to the Celery worker queue.

    Returns a `task_id` — pass it to `GET /api/v1/jobs/{task_id}` to
    poll for status. Returns 202 immediately.
    """
    if req.job_type not in {"pdf_to_text", "merge", "compress", "rotate"}:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported job_type: {req.job_type}",
        )

    if req.job_type in {"pdf_to_text", "compress", "rotate"} and not req.file_b64:
        raise HTTPException(400, f"{req.job_type} requires 'file_b64'")

    if req.job_type == "merge" and not req.options.get("files_b64"):
        raise HTTPException(400, "merge requires options.files_b64 (list of base64 PDFs)")

    try:
        async_result = process_pdf_job.delay(
            job_type=req.job_type,
            file_b64=req.file_b64,
            options=req.options,
        )
    except Exception as exc:
        # Redis is the usual culprit. Surface 503 instead of 500 so
        # the client knows to retry rather than report a bug.
        logger.exception("Failed to enqueue Celery job")
        raise HTTPException(
            status_code=503,
            detail=f"queue unavailable: {exc.__class__.__name__}",
        ) from exc

    # We use the Celery task_id as both task_id and job_id; the task
    # generates a fresh uuid internally if job_id is omitted.
    return JobEnqueueResponse(
        task_id=async_result.id,
        job_id=async_result.id,
        status="queued",
    )


@router.get(
    "/jobs/{task_id}",
    response_model=JobStatusResponse,
    summary="Get async job status / result",
)
async def get_job_status(task_id: str) -> JobStatusResponse:
    """Poll for the status of an enqueued job.

    Status lifecycle: `PENDING` → `STARTED` → `SUCCESS` | `FAILURE`.
    """
    from app.celery_app import celery_app

    try:
        result = celery_app.AsyncResult(task_id)
        state = result.state
    except Exception as exc:
        logger.exception("Failed to read job status from Redis")
        raise HTTPException(
            status_code=503,
            detail=f"queue unavailable: {exc.__class__.__name__}",
        ) from exc

    payload = JobStatusResponse(
        task_id=task_id,
        job_id=task_id,
        status=state.lower(),
    )

    if state == "SUCCESS":
        payload.result = result.result
    elif state == "FAILURE":
        # result.result is the exception object in FAILURE state
        payload.error = str(result.result)

    return payload
