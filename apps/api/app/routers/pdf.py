"""PDF processing endpoints — synchronous (small files) and async (large files)."""

from __future__ import annotations

import io
import logging
import zipfile
from typing import Annotated, Literal

import fitz  # PyMuPDF
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
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


# ─── Split ─────────────────────────────────────────────────────
@router.post(
    "/split-download",
    summary="Split a PDF into one-PDF-per-page, returned as a ZIP",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "ZIP of one-PDF-per-page",
            "content": {"application/zip": {}},
        },
        400: {"description": "Invalid PDF"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def split_pdf_download(
    file: Annotated[UploadFile, File(description="PDF file to split")],
    mode: Annotated[
        Literal["all", "ranges"],
        Form(description="all = one PDF per page; ranges = use ranges[] form field"),
    ] = "all",
    ranges: Annotated[
        str | None,
        Form(description='Page ranges like "1-3,5,7-9" (only when mode=ranges)'),
    ] = None,
) -> StreamingResponse:
    """Split a PDF into individual PDFs.

    Default mode `all` produces N single-page PDFs, one per page of the
    input. With `mode=ranges` and a `ranges` form field (e.g. "1-3,5,7-9"),
    produces one PDF per range.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF.",
        )
    blob = await file.read()
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.",
        )
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")

    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")

        # Build list of (label, [page_indices]) to emit
        slices: list[tuple[str, list[int]]] = []
        if mode == "all":
            for i in range(page_count):
                # 1-based page numbers in filenames (humans think 1-based)
                slices.append((f"page_{i + 1:03d}.pdf", [i]))
        else:
            if not ranges:
                raise HTTPException(
                    400,
                    'mode=ranges requires the "ranges" form field (e.g. "1-3,5,7-9").',
                )
            try:
                parsed = _parse_ranges(ranges, page_count)
            except ValueError as exc:
                raise HTTPException(400, f"Invalid ranges: {exc}") from exc
            if not parsed:
                raise HTTPException(400, "No valid ranges parsed.")
            for label, indices in parsed:
                slices.append((label, indices))

        if not slices:
            raise HTTPException(400, "Nothing to split.")

        # Build ZIP in memory
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for filename, indices in slices:
                out_doc = fitz.open()
                try:
                    for idx in indices:
                        out_doc.insert_pdf(src, from_page=idx, to_page=idx)
                    page_buf = io.BytesIO()
                    out_doc.save(page_buf)
                    zf.writestr(filename, page_buf.getvalue())
                finally:
                    out_doc.close()
        zip_bytes = zip_buf.getvalue()
    finally:
        src.close()

    base = (file.filename or "document.pdf").rsplit(".", 1)[0]
    zip_name = f"{base}-pages.zip"

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_name}"',
            "X-Pdf-Source-Pages": str(page_count),
            "X-Pdf-Parts": str(len(slices)),
            "X-Pdf-Size-Bytes": str(len(zip_bytes)),
            "Cache-Control": "no-store",
        },
    )


def _parse_ranges(spec: str, total: int) -> list[tuple[str, list[int]]]:
    """Parse '1-3,5,7-9' into [(label, [indices])].

    Pages are 1-based in the spec, converted to 0-based for fitz.
    Out-of-range pages are clamped to [1, total].
    """
    out: list[tuple[str, list[int]]] = []
    for raw in spec.split(","):
        token = raw.strip()
        if not token:
            continue
        if "-" in token:
            a, b = token.split("-", 1)
            start = int(a)
            end = int(b)
            if start > end:
                start, end = end, start
            start = max(1, min(start, total))
            end = max(1, min(end, total))
            indices = list(range(start - 1, end))
            label = f"pages_{start:03d}-{end:03d}.pdf"
        else:
            n = int(token)
            if n < 1 or n > total:
                continue
            indices = [n - 1]
            label = f"page_{n:03d}.pdf"
        if indices:
            out.append((label, indices))
    return out


# ─── Compress ──────────────────────────────────────────────────
@router.post(
    "/compress-download",
    summary="Compress a PDF and stream the result back (≤ 50 MB input)",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Compressed PDF",
            "content": {"application/pdf": {}},
        },
        400: {"description": "Invalid PDF"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def compress_pdf_download(
    file: Annotated[UploadFile, File(description="PDF file to compress")],
    level: Annotated[
        Literal["low", "medium", "high"],
        Form(description="low (best quality), medium (balanced), high (smallest)"),
    ] = "medium",
) -> StreamingResponse:
    """Compress a PDF using PyMuPDF's garbage collection + image
    downsampling. Three quality levels:
      - low: garbage collect only, no image reencoding (~10% smaller)
      - medium: + image compression with quality 70 (~40% smaller)
      - high: + image downsample to 150 DPI + quality 50 (~70% smaller)
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF.")
    blob = await file.read()
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")

    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    # Compression knobs per level
    if level == "low":
        image_quality = 85
        image_dpi = None  # don't resample
        garbage = 4  # max garbage collection
        deflate = True
    elif level == "medium":
        image_quality = 70
        image_dpi = None
        garbage = 4
        deflate = True
    else:  # high
        image_quality = 50
        image_dpi = 150
        garbage = 4
        deflate = True

    try:
        # Save with garbage + deflate + optional image recompression.
        # Most of the savings come from garbage=4 (drops unused objects),
        # deflate=zlib-compresses streams, and clean=true (rebuilds xref).
        # The image recompression at medium/high also re-encodes JPEGs at
        # lower quality and downsamples oversized images to ~150 DPI.
        out_buf = io.BytesIO()
        save_kwargs: dict = {
            "garbage": garbage,
            "deflate": deflate,
            "clean": True,
            "expand": False,
        }
        # Only re-encode images if the level asks for it
        if level in ("medium", "high"):
            # Force image re-encoding with quality reduction
            # Per-page image processing is done by inserting replacements
            # for each image at the requested DPI/quality.
            for page in src:
                for img_info in page.get_images(full=True):
                    xref = img_info[0]
                    try:
                        # Get the image as a Pixmap
                        pix = fitz.Pixmap(src, xref)
                        # Skip if already grayscale or 1-bit (not much to save)
                        if pix.colorspace and pix.colorspace.n >= 4:
                            pix = fitz.Pixmap(fitz.csRGB, pix)
                        # Optionally downsample
                        if image_dpi and image_dpi < 300:
                            scale = image_dpi / max(72.0, pix.width / 4)  # rough heuristic
                            scale = min(1.0, max(0.3, scale))
                            if scale < 1.0:
                                pix.shrink(int(1 / scale))
                        # Re-encode as JPEG
                        new_bytes = pix.tobytes("jpeg", jpg_quality=image_quality)
                        # Replace the image in the doc
                        src.replace_image(xref, new_bytes)
                    except Exception:
                        # Best-effort — skip images we can't process
                        logger.debug("Skipping image xref=%s", xref, exc_info=True)
                        continue

        src.save(out_buf, **save_kwargs)
        out_bytes = out_buf.getvalue()
    except Exception as exc:
        logger.exception("Compress failed")
        raise HTTPException(500, f"Compress failed: {exc}") from exc
    finally:
        src.close()

    base = (file.filename or "document.pdf").rsplit(".", 1)[0]
    out_name = f"{base}-compressed.pdf"
    saved_pct = round((1 - len(out_bytes) / len(blob)) * 100, 1) if blob else 0

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            "X-Original-Size-Bytes": str(len(blob)),
            "X-Compressed-Size-Bytes": str(len(out_bytes)),
            "X-Saved-Percent": str(saved_pct),
            "X-Compression-Level": level,
            "Cache-Control": "no-store",
        },
    )
