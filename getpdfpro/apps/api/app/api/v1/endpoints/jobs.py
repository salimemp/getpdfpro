"""
Job management — create, list, get, cancel PDF processing jobs.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.core.security import AuthUser, get_current_user

logger = structlog.get_logger()
router = APIRouter()


class JobType(str, Enum):
    MERGE = "merge"
    SPLIT = "split"
    COMPRESS = "compress"
    CONVERT_PDF_TO_WORD = "convert_pdf_to_word"
    CONVERT_WORD_TO_PDF = "convert_word_to_pdf"
    CONVERT_PDF_TO_JPG = "convert_pdf_to_jpg"
    CONVERT_JPG_TO_PDF = "convert_jpg_to_pdf"
    SIGN = "sign"
    OCR = "ocr"
    SUMMARIZE = "summarize"
    TRANSLATE = "translate"
    REDACT = "redact"
    WATERMARK = "watermark"
    ROTATE = "rotate"
    PROTECT = "protect"
    UNLOCK = "unlock"


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CreateJobRequest(BaseModel):
    type: JobType
    input_files: list[str]  # R2 keys
    options: dict = {}


class JobResponse(BaseModel):
    id: str
    type: JobType
    status: JobStatus
    progress: int
    input_files: list[str]
    output_file: str | None
    error: str | None
    created_at: datetime
    completed_at: datetime | None


@router.post("", response_model=JobResponse, status_code=201)
async def create_job(
    req: CreateJobRequest,
    user: AuthUser = Depends(get_current_user),
) -> JobResponse:
    """Create a new PDF processing job."""
    job_id = str(uuid.uuid4())

    # Enqueue Celery task based on type
    from app.workers.tasks import dispatch_job  # lazy import to avoid circular

    dispatch_job.delay(
        job_id=job_id,
        user_id=user.id,
        job_type=req.type.value,
        input_files=req.input_files,
        options=req.options,
    )

    # Persist to DB (placeholder — implement with SQLAlchemy in real code)
    return JobResponse(
        id=job_id,
        type=req.type,
        status=JobStatus.QUEUED,
        progress=0,
        input_files=req.input_files,
        output_file=None,
        error=None,
        created_at=datetime.now(timezone.utc),
        completed_at=None,
    )


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    user: AuthUser = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
) -> list[JobResponse]:
    """List the current user's jobs, most recent first."""
    # TODO: implement with SQLAlchemy
    return []


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    user: AuthUser = Depends(get_current_user),
) -> JobResponse:
    """Get a specific job's status."""
    # TODO: implement with SQLAlchemy
    raise HTTPException(status_code=404, detail="Job not found")


@router.delete("/{job_id}", status_code=204)
async def cancel_job(
    job_id: str,
    user: AuthUser = Depends(get_current_user),
) -> None:
    """Cancel a queued or processing job."""
    # TODO: implement
    return None
