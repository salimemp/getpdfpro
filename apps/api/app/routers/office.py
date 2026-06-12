"""Office PDF conversions — Wave C.

Five endpoints, all Adobe-tier-1 only. Without Adobe credentials
configured, these endpoints return 503 with a clear message —
the LibreOffice self-hosted fallback is NOT available because
of the 0xc10 save bug we hit during the C10 sprint. Future
work to add pdf2docx / pdf2pptx / etc. as a tier 2 fallback
is tracked separately.

  /word-to-pdf-download         .docx → PDF
  /powerpoint-to-pdf-download   .pptx → PDF
  /excel-to-pdf-download         .xlsx → PDF
  /pdf-to-powerpoint-download   PDF → .pptx
  /pdf-to-excel-download         PDF → .xlsx

All five:
  - 50 MB cap (sync, same as other PDF endpoints)
  - Return StreamingResponse with X-Office-Source-Format,
    X-Office-Target-Format, X-Cascade-Adapter headers
  - Reject unsupported MIME types with 400
"""

from __future__ import annotations

import io
import logging
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_SYNC_SIZE = 50 * 1024 * 1024


# ─── Helpers ─────────────────────────────────────────────────────
def _validate(filename: str | None, ext: str) -> str:
    """Validate filename and check extension matches expected."""
    if not filename or not filename.lower().endswith(f".{ext}"):
        raise HTTPException(400, f"File must be a .{ext} file.")
    return filename


def _suggest_name(original: str, suffix: str, ext: str = "pdf") -> str:
    base = (original or f"document.{ext}").rsplit(".", 1)[0]
    return f"{base}-{suffix}.{ext}"


def _not_configured_response() -> HTTPException:
    """Standard 503 message for when Adobe isn't configured."""
    return HTTPException(
        503,
        "Office conversions require Adobe PDF Services to be configured. "
        "Set ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET in your environment. "
        "Without these, the LibreOffice self-hosted fallback is "
        "unavailable (0xc10 save bug on the slim Docker env).",
    )


# ─── TO-PDF endpoints (3) ───────────────────────────────────────
@router.post(
    "/word-to-pdf-download",
    response_class=StreamingResponse,
    summary="Convert a Word .docx file to PDF (sync, ≤ 50 MB)",
)
async def word_to_pdf(
    file: Annotated[UploadFile, File(description=".docx file to convert")],
) -> StreamingResponse:
    _validate(file.filename, "docx")
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    from app.adapters import adobe_ops
    if not adobe_ops.is_configured():
        raise _not_configured_response()

    try:
        result = await adobe_ops.create_pdf_from_office(blob, "docx", "document")
    except adobe_ops.AdobeOpError as exc:
        raise HTTPException(500 if exc.retryable else 400, str(exc)) from exc

    return StreamingResponse(
        io.BytesIO(result.bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.docx", "converted")}"',
            "X-Office-Source-Format": "docx",
            "X-Office-Target-Format": "pdf",
            "X-Cascade-Adapter": "adobe",
            "X-Pdf-Size-Bytes": str(len(result.bytes)),
            "X-Ai-Elapsed-Ms": str(result.elapsed_ms),
            "Cache-Control": "no-store",
        },
    )


@router.post(
    "/powerpoint-to-pdf-download",
    response_class=StreamingResponse,
    summary="Convert a PowerPoint .pptx file to PDF (sync, ≤ 50 MB)",
)
async def powerpoint_to_pdf(
    file: Annotated[UploadFile, File(description=".pptx file to convert")],
) -> StreamingResponse:
    _validate(file.filename, "pptx")
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    from app.adapters import adobe_ops
    if not adobe_ops.is_configured():
        raise _not_configured_response()

    try:
        result = await adobe_ops.create_pdf_from_office(blob, "pptx", "presentation")
    except adobe_ops.AdobeOpError as exc:
        raise HTTPException(500 if exc.retryable else 400, str(exc)) from exc

    return StreamingResponse(
        io.BytesIO(result.bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "pres.pptx", "converted")}"',
            "X-Office-Source-Format": "pptx",
            "X-Office-Target-Format": "pdf",
            "X-Cascade-Adapter": "adobe",
            "X-Pdf-Size-Bytes": str(len(result.bytes)),
            "X-Ai-Elapsed-Ms": str(result.elapsed_ms),
            "Cache-Control": "no-store",
        },
    )


@router.post(
    "/excel-to-pdf-download",
    response_class=StreamingResponse,
    summary="Convert an Excel .xlsx file to PDF (sync, ≤ 50 MB)",
)
async def excel_to_pdf(
    file: Annotated[UploadFile, File(description=".xlsx file to convert")],
) -> StreamingResponse:
    _validate(file.filename, "xlsx")
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    from app.adapters import adobe_ops
    if not adobe_ops.is_configured():
        raise _not_configured_response()

    try:
        result = await adobe_ops.create_pdf_from_office(blob, "xlsx", "spreadsheet")
    except adobe_ops.AdobeOpError as exc:
        raise HTTPException(500 if exc.retryable else 400, str(exc)) from exc

    return StreamingResponse(
        io.BytesIO(result.bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "sheet.xlsx", "converted")}"',
            "X-Office-Source-Format": "xlsx",
            "X-Office-Target-Format": "pdf",
            "X-Cascade-Adapter": "adobe",
            "X-Pdf-Size-Bytes": str(len(result.bytes)),
            "X-Ai-Elapsed-Ms": str(result.elapsed_ms),
            "Cache-Control": "no-store",
        },
    )


# ─── FROM-PDF endpoints (2) ─────────────────────────────────────
@router.post(
    "/pdf-to-powerpoint-download",
    response_class=StreamingResponse,
    summary="Convert a PDF to .pptx via Adobe (sync, ≤ 50 MB)",
)
async def pdf_to_powerpoint(
    file: Annotated[UploadFile, File(description="PDF to convert to .pptx")],
) -> StreamingResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF.")
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    from app.adapters import adobe_ops
    if not adobe_ops.is_configured():
        raise _not_configured_response()

    try:
        result = await adobe_ops.export_pdf_to_office(blob, "pptx")
    except adobe_ops.AdobeOpError as exc:
        raise HTTPException(500 if exc.retryable else 400, str(exc)) from exc

    return StreamingResponse(
        io.BytesIO(result.bytes),
        media_type=result.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "pptx", "pptx")}"',
            "X-Office-Source-Format": "pdf",
            "X-Office-Target-Format": "pptx",
            "X-Cascade-Adapter": "adobe",
            "X-Office-Size-Bytes": str(len(result.bytes)),
            "X-Ai-Elapsed-Ms": str(result.elapsed_ms),
            "Cache-Control": "no-store",
        },
    )


@router.post(
    "/pdf-to-excel-download",
    response_class=StreamingResponse,
    summary="Convert a PDF to .xlsx via Adobe (sync, ≤ 50 MB)",
)
async def pdf_to_excel(
    file: Annotated[UploadFile, File(description="PDF to convert to .xlsx")],
) -> StreamingResponse:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF.")
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    from app.adapters import adobe_ops
    if not adobe_ops.is_configured():
        raise _not_configured_response()

    try:
        result = await adobe_ops.export_pdf_to_office(blob, "xlsx")
    except adobe_ops.AdobeOpError as exc:
        raise HTTPException(500 if exc.retryable else 400, str(exc)) from exc

    return StreamingResponse(
        io.BytesIO(result.bytes),
        media_type=result.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "xlsx", "xlsx")}"',
            "X-Office-Source-Format": "pdf",
            "X-Office-Target-Format": "xlsx",
            "X-Cascade-Adapter": "adobe",
            "X-Office-Size-Bytes": str(len(result.bytes)),
            "X-Ai-Elapsed-Ms": str(result.elapsed_ms),
            "Cache-Control": "no-store",
        },
    )
