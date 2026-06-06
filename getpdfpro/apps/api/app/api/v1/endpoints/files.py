"""
File upload/download endpoints.
"""

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.core.security import AuthUser, get_current_user
from app.services.storage import storage_service

logger = structlog.get_logger()
router = APIRouter()


class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str = "application/pdf"
    size_bytes: int = Field(..., gt=0, le=10 * 1024 * 1024 * 1024)  # max 10GB
    purpose: str = "input"  # "input" or "output"


class UploadUrlResponse(BaseModel):
    upload_url: str
    file_id: str
    key: str
    expires_in: int


@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_upload_url(
    req: UploadUrlRequest,
    user: AuthUser = Depends(get_current_user),
) -> UploadUrlResponse:
    """
    Get a pre-signed R2 PUT URL. Client uploads directly to R2,
    bypassing our API. Saves bandwidth and compute.
    """
    # Check tier limits
    max_size = settings.pro_tier_max_file_size_mb * 1024 * 1024  # assume Pro for now
    if req.size_bytes > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {max_size / 1024 / 1024:.0f}MB",
        )

    # Generate unique key
    file_id = str(uuid.uuid4())
    ext = req.filename.rsplit(".", 1)[-1] if "." in req.filename else "pdf"
    ts = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    key = f"uploads/{ts}/{user.id}/{file_id}.{ext}"

    upload_url = await storage_service.presigned_put_url(
        key=key,
        content_type=req.content_type,
    )

    return UploadUrlResponse(
        upload_url=upload_url,
        file_id=file_id,
        key=key,
        expires_in=settings.upload_signed_url_ttl_seconds,
    )


class DownloadUrlRequest(BaseModel):
    key: str


class DownloadUrlResponse(BaseModel):
    download_url: str
    expires_in: int


@router.post("/download-url", response_model=DownloadUrlResponse)
async def get_download_url(
    req: DownloadUrlRequest,
    user: AuthUser = Depends(get_current_user),
) -> DownloadUrlResponse:
    """Get a pre-signed R2 GET URL for downloading a file."""
    # TODO: verify the requesting user owns this file
    url = await storage_service.presigned_get_url(req.key)
    return DownloadUrlResponse(
        download_url=url,
        expires_in=settings.download_signed_url_ttl_seconds,
    )
