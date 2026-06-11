"""PDF processing endpoints — synchronous (small files) and async (large files)."""

from __future__ import annotations

import io
import logging
from typing import Annotated

import fitz  # PyMuPDF
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

# 50 MB upload cap on the sync fast track. Larger files go through the
# Celery queue (see /api/v1/pdf/merge-async) — to be added next sprint.
MAX_SYNC_SIZE = 50 * 1024 * 1024  # 50 MB


class PdfToTextResponse(BaseModel):
    text: str = Field(..., description="Extracted plain text")
    pages: int = Field(..., description="Number of pages in the source PDF")
    chars: int = Field(..., description="Character count of the extracted text")


class MergeResponse(BaseModel):
    pages: int = Field(..., description="Total pages in the merged PDF")
    size_bytes: int = Field(..., description="Size of the merged PDF in bytes")
    filename: str = Field(..., description="Suggested filename for download")


@router.post(
    "/pdf-to-text",
    response_model=PdfToTextResponse,
    summary="Extract text from a PDF (sync, ≤ 50 MB)",
)
async def pdf_to_text(
    file: Annotated[UploadFile, File(description="PDF file to extract text from")],
) -> PdfToTextResponse:
    """Extract plain text from every page of a PDF. Synchronous, fast track."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF.",
        )

    blob = await file.read()
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit. Use the async endpoint.",
        )
    if len(blob) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file.",
        )

    try:
        pdf = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        logger.warning("Failed to open PDF: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read PDF. File may be corrupted or password-protected.",
        ) from exc

    try:
        text = "\n".join(page.get_text() for page in pdf)
        page_count = len(pdf)
    finally:
        pdf.close()

    return PdfToTextResponse(text=text, pages=page_count, chars=len(text))


@router.post(
    "/merge",
    response_model=MergeResponse,
    summary="Merge multiple PDFs into one (sync, ≤ 50 MB total)",
)
async def merge_pdfs(
    files: Annotated[list[UploadFile], File(description="PDF files to merge, in order")],
) -> MergeResponse:
    """Merge 2+ PDFs into a single document, preserving page order."""
    if len(files) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Need at least 2 PDFs to merge.",
        )

    blobs: list[bytes] = []
    total = 0
    for f in files:
        if not f.filename or not f.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{f.filename} is not a PDF.",
            )
        b = await f.read()
        total += len(b)
        if total > MAX_SYNC_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Total size exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.",
            )
        blobs.append(b)

    try:
        result = fitz.open()
        try:
            for blob in blobs:
                src = fitz.open(stream=blob, filetype="pdf")
                try:
                    result.insert_pdf(src)
                finally:
                    src.close()

            out = io.BytesIO()
            result.save(out)
            payload = out.getvalue()
            page_count = len(result)
        finally:
            result.close()
    except Exception as exc:
        logger.exception("Merge failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Merge failed — input PDFs may be invalid.",
        ) from exc

    return MergeResponse(
        pages=page_count,
        size_bytes=len(payload),
        filename="merged.pdf",
    )


@router.post(
    "/merge-download",
    summary="Merge multiple PDFs and stream the merged file back (≤ 50 MB total)",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Merged PDF as application/pdf",
            "content": {"application/pdf": {}},
        },
        400: {"description": "Invalid input (need ≥ 2 PDFs, all must be .pdf)"},
        413: {"description": "Total size exceeds 50 MB cap"},
    },
)
async def merge_pdfs_download(
    files: Annotated[list[UploadFile], File(description="PDF files to merge, in order")],
) -> StreamingResponse:
    """Merge 2+ PDFs and return the merged file as a binary download.

    Use this endpoint when the client needs the actual PDF bytes
    (e.g. the web app's "Merge PDF" tool). For metadata-only, use
    the JSON `/merge` endpoint.
    """
    if len(files) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Need at least 2 PDFs to merge.",
        )

    blobs: list[bytes] = []
    total = 0
    for f in files:
        if not f.filename or not f.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{f.filename} is not a PDF.",
            )
        b = await f.read()
        total += len(b)
        if total > MAX_SYNC_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Total size exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.",
            )
        blobs.append(b)

    try:
        result = fitz.open()
        try:
            for blob in blobs:
                src = fitz.open(stream=blob, filetype="pdf")
                try:
                    result.insert_pdf(src)
                finally:
                    src.close()
            page_count = len(result)
            out = io.BytesIO()
            result.save(out)
            payload = out.getvalue()
        finally:
            result.close()
    except Exception as exc:
        logger.exception("Merge failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Merge failed — input PDFs may be invalid.",
        ) from exc

    # Filename = first input name + "-merged" + extension, or default.
    base = (files[0].filename or "merged.pdf").rsplit(".", 1)[0]
    out_name = f"{base}-merged.pdf"

    return StreamingResponse(
        io.BytesIO(payload),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            "X-Pdf-Pages": str(page_count),
            "X-Pdf-Size-Bytes": str(len(payload)),
            "Cache-Control": "no-store",
        },
    )
