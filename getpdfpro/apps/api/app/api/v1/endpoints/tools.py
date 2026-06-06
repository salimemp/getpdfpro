"""
PDF tool endpoints — convenience wrappers that combine upload + process + return result.

For simple one-shot operations. For batch or large files, use the jobs endpoint.
"""

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.security import AuthUser, get_current_user
from app.services.pdf_engine import CompressionLevel, pdf_engine
from app.services.storage import storage_service

logger = structlog.get_logger()
router = APIRouter()


class MergeResponse(BaseModel):
    download_url: str
    file_id: str
    page_count: int
    expires_in: int


@router.post("/merge", response_model=MergeResponse)
async def merge_pdfs(
    files: list[UploadFile] = File(..., description="PDF files to merge"),
    user: AuthUser = Depends(get_current_user),
) -> MergeResponse:
    """Merge multiple PDFs into one. Synchronous for ≤5 files."""
    if len(files) < 2:
        raise HTTPException(400, "Need at least 2 files to merge")
    if len(files) > 20:
        raise HTTPException(400, "Use the /jobs endpoint for >20 files")

    file_bytes = [await f.read() for f in files]
    try:
        result = pdf_engine.merge(file_bytes)
    except Exception as e:
        logger.error("merge_failed", error=str(e))
        raise HTTPException(500, f"Merge failed: {e}")

    # Upload result
    file_id = str(uuid.uuid4())
    key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user.id}/{file_id}.pdf"
    await storage_service.put_bytes(key, result)

    download_url = await storage_service.presigned_get_url(key)

    return MergeResponse(
        download_url=download_url,
        file_id=file_id,
        page_count=result.__len__() if hasattr(result, '__len__') else 0,
        expires_in=900,
    )


class CompressRequest(BaseModel):
    level: CompressionLevel = CompressionLevel.MEDIUM


@router.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    level: CompressionLevel = Form(CompressionLevel.MEDIUM),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    """Compress a PDF."""
    data = await file.read()
    original_size = len(data)
    compressed = pdf_engine.compress(data, level=level)
    new_size = len(compressed)
    ratio = round((1 - new_size / original_size) * 100, 1) if original_size else 0

    file_id = str(uuid.uuid4())
    key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user.id}/{file_id}.pdf"
    await storage_service.put_bytes(key, compressed)
    url = await storage_service.presigned_get_url(key)

    return {
        "download_url": url,
        "original_size_bytes": original_size,
        "compressed_size_bytes": new_size,
        "reduction_percent": ratio,
        "level": level.value,
    }


@router.post("/pdf-to-jpg")
async def pdf_to_jpg(
    file: UploadFile = File(...),
    dpi: int = Form(150),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    """Convert each PDF page to a JPG image."""
    if dpi < 72 or dpi > 600:
        raise HTTPException(400, "DPI must be between 72 and 600")
    data = await file.read()
    try:
        images = pdf_engine.pdf_to_jpg(data, dpi=dpi)
    except Exception as e:
        raise HTTPException(500, f"Conversion failed: {e}")

    # Upload each page
    ts = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    urls = []
    for i, img_bytes in enumerate(images, 1):
        key = f"processed/{ts}/{user.id}/page_{i}.jpg"
        await storage_service.put_bytes(key, img_bytes, content_type="image/jpeg")
        url = await storage_service.presigned_get_url(key)
        urls.append({"page": i, "url": url})

    return {"page_count": len(images), "images": urls}


# TODO: add /split, /jpg-to-pdf, /rotate, /watermark, /protect, /unlock, /sign, /ocr, /redact
