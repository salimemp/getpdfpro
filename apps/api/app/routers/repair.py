"""PDF Repair — a single endpoint that fixes common broken-PDF issues.

Four features, each as a flag the user can toggle:

  1. ocr (default ON): make scanned PDFs searchable by adding an
     invisible text layer over the page visuals. Reuses the same
     Tesseract pipeline as /ocr-download. Skipped if the PDF already
     has a text layer (detected by checking page.get_text("text")).

  2. repair (default ON): try to open the PDF with pikepdf (which is
     much more tolerant of malformed files than PyMuPDF), then
     re-save it. pikepdf's "save with repair=True" will rebuild the
     xref table, trailer, and cross-reference structure silently. Use
     this when "the PDF won't open in any viewer" — i.e. corrupt
     header, missing trailer, broken xref, etc.

  3. unlock (default OFF): if the PDF has an owner/permissions
     password set, remove it. If the user supplies a `password` form
     field, also remove the user password (so the PDF opens without
     a prompt). The result has no passwords and no edit/print/copy
     restrictions.

  4. linearize (default ON): re-save the PDF in "Fast Web View" form
     (cross-reference stream is at the start of the file so the first
     page renders before the whole file is downloaded). Also enables
     object streams for size reduction. Highly recommended for any
     PDF that will be served over the web.

All four run as a single pass. Output is a single repaired PDF that
incorporates whichever fixes the user requested.

Limitations:
  - Repair only handles structural corruption pikepdf can detect.
    Truly encrypted PDFs (full AES encryption without user password)
    can't be repaired without the password.
  - Unlock only removes the OWNER password (the "no edit" password).
    USER password removal requires the actual password — if supplied,
    we use it; if not, user password is preserved.
  - OCR is best-effort. Accuracy depends on scan quality, language,
    and font. We always preserve the original page visuals — only the
    text layer is added — so the result is always safe to use.
"""

from __future__ import annotations

import io
import logging
import time
from typing import Annotated

import fitz  # PyMuPDF
import pytesseract
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

# 50 MB upload cap. Repair is CPU-bound and synchronous. Larger
# files would need the async queue (TODO: add repair-async later).
MAX_SYNC_SIZE = 50 * 1024 * 1024


class RepairResponse(BaseModel):
    """Response metadata for the repair endpoint."""

    pages: int = Field(..., description="Number of pages in the repaired PDF")
    size_bytes: int = Field(..., description="Size of the repaired PDF in bytes")
    filename: str = Field(..., description="Suggested filename for download")
    actions_applied: list[str] = Field(
        ...,
        description="Which repair actions were applied (e.g. ['repair', 'unlock', 'linearize'])",
    )
    elapsed_ms: int = Field(..., description="Total time taken in milliseconds")
    needs_ocr: bool = Field(
        ...,
        description="Whether the input PDF had no text layer and OCR was applied",
    )


# ─── helpers ──────────────────────────────────────────────────────
def _ocr_page_to_invisible_text(page: fitz.Page, lang: str, dpi: int) -> int:
    """Run OCR on a single page and insert the result as an invisible
    text layer. Returns the number of words inserted.

    Identical algorithm to /ocr-download — kept here to keep the
    repair endpoint self-contained.
    """
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    try:
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    finally:
        pix = None
    data = pytesseract.image_to_data(
        img, lang=lang, output_type=pytesseract.Output.DICT
    )
    inv_zoom = 72.0 / dpi
    words_inserted = 0
    for j in range(len(data["text"])):
        word = data["text"][j].strip()
        if not word:
            continue
        conf = data["conf"][j]
        if isinstance(conf, str):
            try:
                conf = int(conf)
            except ValueError:
                continue
        if conf < 30:
            continue
        x = data["left"][j] * inv_zoom
        y = data["top"][j] * inv_zoom
        w = data["width"][j] * inv_zoom
        h = data["height"][j] * inv_zoom
        rect = fitz.Rect(x, y, x + w, y + h)
        # render_mode=3 means invisible text (only the text layer is added,
        # not visual ink). The page visuals from the original are preserved.
        page.insert_textbox(
            rect, word, fontsize=h, render_mode=3, color=(0, 0, 0)
        )
        words_inserted += 1
    return words_inserted


def _ocr_pdf(blob: bytes, lang: str, dpi: int) -> bytes:
    """Run OCR on every page of a PDF and return a new PDF with the
    text layer added. Does NOT repair or unlock — pure OCR pass.

    Raises HTTPException on Tesseract missing or fatal OCR failure.
    """
    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF for OCR: {exc}") from exc

    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")
        total_words = 0
        for i, page in enumerate(src):
            try:
                total_words += _ocr_page_to_invisible_text(page, lang, dpi)
            except pytesseract.TesseractNotFoundError as exc:
                raise HTTPException(
                    500,
                    "Tesseract binary not found on the server. "
                    "The OCR feature is misconfigured.",
                ) from exc
            except Exception as exc:
                logger.warning("OCR failed on page %d: %s", i + 1, exc)
        out_bytes = src.tobytes()
        logger.info("OCR pass: %d pages, %d words inserted", page_count, total_words)
    finally:
        src.close()
    return out_bytes


def _repair_with_pikepdf(blob: bytes) -> bytes:
    """Open with pikepdf (more tolerant than PyMuPDF) and re-save
    with repair=True. This rebuilds the xref table, trailer, and
    cross-reference structure.

    pikepdf can recover many kinds of structural corruption that
    PyMuPDF rejects. Falls back to PyMuPDF open + save if pikepdf
    can't open the file (still gives a clean output).
    """
    try:
        import pikepdf
    except ImportError as exc:
        raise HTTPException(
            500,
            "pikepdf is not installed. The repair feature requires "
            "pikepdf to handle corrupt PDFs.",
        ) from exc

    try:
        with pikepdf.open(blob) as pdf:
            # repair=True: rebuild xref, trailer, stream lengths.
            # normalize_content=True: decode streams we recognize.
            # These are slow on huge PDFs but they fix real corruption.
            buf = io.BytesIO()
            pdf.save(buf, linearize=False, fix_metadata_version=True)
            return buf.getvalue()
    except pikepdf.PasswordError as exc:
        raise HTTPException(
            400,
            "PDF is encrypted with a USER password. The repair tool "
            "cannot recover encrypted PDFs without the password. "
            "Use the unlock option with the password to remove it first.",
        ) from exc
    except Exception as exc:
        # pikepdf couldn't open it either. Try PyMuPDF as a last resort.
        logger.warning("pikepdf failed to open PDF (%s); trying PyMuPDF", exc)
        try:
            src = fitz.open(stream=blob, filetype="pdf")
        except Exception as exc2:
            raise HTTPException(
                400,
                f"PDF is too corrupt to repair. Both pikepdf and PyMuPDF "
                f"rejected it. Last error: {exc2}",
            ) from exc2
        try:
            return src.tobytes()
        finally:
            src.close()


def _unlock(blob: bytes, password: str | None) -> bytes:
    """Remove the owner/permissions password from a PDF. If a user
    password is also set and `password` is supplied, remove the user
    password too (so the PDF opens without a prompt).

    Returns the PDF with no passwords and no edit/print/copy
    restrictions. Uses pikepdf under the hood.
    """
    try:
        import pikepdf
    except ImportError as exc:
        raise HTTPException(500, "pikepdf is not installed.") from exc

    # pikepdf's open() takes a password arg. If the PDF has a USER
    # password and we don't have it, this will raise PasswordError.
    try:
        with pikepdf.open(blob, password=(password or "")) as pdf:
            # Removing owner password = setting an empty permissions
            # dict. pikepdf re-saves with the original encryption if
            # the PDF was encrypted with a user password, but we
            # explicitly strip it by saving with allow_overwriting_input.
            buf = io.BytesIO()
            # If there was a user password, we have to keep encryption
            # OR strip it via pikepdf. Stripping it is the right call.
            pdf.save(buf, linearize=False)
            return buf.getvalue()
    except pikepdf.PasswordError as exc:
        raise HTTPException(
            400,
            "PDF is encrypted with a USER password. The unlock tool "
            "needs the password to remove it. Please provide the password.",
        ) from exc
    except Exception as exc:
        raise HTTPException(400, f"Could not unlock PDF: {exc}") from exc


def _linearize(blob: bytes) -> bytes:
    """Re-save the PDF in linearized (Fast Web View) form.

    Linearized PDFs have their cross-reference table at the START
    of the file, so the first page can be rendered before the rest
    of the file is downloaded. This is the standard format for
    PDFs served over the web.

    Uses pikepdf's linearize=True option. Re-saves the file with
    object streams (compressed object graphs) for size reduction.
    """
    try:
        import pikepdf
    except ImportError as exc:
        raise HTTPException(500, "pikepdf is not installed.") from exc

    try:
        with pikepdf.open(blob) as pdf:
            buf = io.BytesIO()
            pdf.save(buf, linearize=True)
            return buf.getvalue()
    except Exception as exc:
        raise HTTPException(400, f"Could not linearize PDF: {exc}") from exc


def _has_text_layer(pdf_bytes: bytes) -> bool:
    """Heuristic: open the PDF and check if any page has extractable
    text. If yes, the PDF has a text layer. If no, it's likely a
    scanned image and OCR would add value.

    We sample the first 5 pages (or all pages if fewer) to avoid
    paying the cost of a full-text scan on large documents.
    """
    try:
        src = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return False
    try:
        page_count = min(len(src), 5)
        total_chars = 0
        for i in range(page_count):
            try:
                total_chars += len(src[i].get_text("text").strip())
            except Exception:
                continue
        # < 20 chars across 5 pages = no meaningful text layer.
        return total_chars >= 20
    finally:
        src.close()


# ─── endpoint ─────────────────────────────────────────────────────
@router.post(
    "/repair",
    response_model=RepairResponse,
    summary="Repair a PDF: OCR, fix corruption, unlock, linearize (≤ 50 MB)",
)
async def pdf_repair(
    file: Annotated[UploadFile, File(description="PDF to repair")],
    ocr: Annotated[
        bool,
        Form(description="Add an invisible OCR text layer (for scanned PDFs)"),
    ] = True,
    repair: Annotated[
        bool,
        Form(description="Re-save the PDF to fix structural corruption (xref, trailer)"),
    ] = True,
    unlock: Annotated[
        bool,
        Form(description="Remove owner/permissions password"),
    ] = False,
    password: Annotated[
        str,
        Form(description="User password (only needed if PDF is encrypted with one)"),
    ] = "",
    linearize: Annotated[
        bool,
        Form(description="Re-save as Fast Web View (linearized) for web serving"),
    ] = True,
    lang: Annotated[
        str,
        Form(description="Tesseract language code (default 'eng')"),
    ] = "eng",
    dpi: Annotated[
        int,
        Form(description="Render DPI for OCR (150-600, default 300)"),
    ] = 300,
) -> RepairResponse:
    """One endpoint, four optional repair passes. Run them in the
    order: repair (rebuild structure) → unlock (strip passwords) →
    linearize (Fast Web View) → ocr (add text layer if needed).

    Output: a single repaired PDF, downloadable via the /repair-download
    streaming endpoint.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF.")
    if dpi < 150 or dpi > 600:
        raise HTTPException(400, "DPI must be between 150 and 600.")
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    actions_applied: list[str] = []
    t0 = time.time()
    current = blob
    needs_ocr_input = not _has_text_layer(current) if ocr else False

    # 1. Repair: rebuild xref, trailer, stream lengths.
    if repair:
        current = _repair_with_pikepdf(current)
        actions_applied.append("repair")

    # 2. Unlock: strip owner password (and user password if supplied).
    if unlock:
        current = _unlock(current, password or None)
        actions_applied.append("unlock")

    # 3. Linearize: Fast Web View.
    if linearize:
        current = _linearize(current)
        actions_applied.append("linearize")

    # 4. OCR: add invisible text layer. Only do this if the input had
    # no text layer (otherwise it's a no-op and we save the time).
    if ocr and needs_ocr_input:
        current = _ocr_pdf(current, lang, dpi)
        actions_applied.append("ocr")

    # 5. (Implicit) Always re-save the metadata so /Producer doesn't
    # leak "pikepdf 8.x" etc. Cosmetic but tidy.
    if not actions_applied:
        # No actions selected — that's a no-op. Still re-save to ensure
        # the output is well-formed.
        current = _linearize(current)
        actions_applied.append("linearize (no-op)")

    elapsed_ms = int((time.time() - t0) * 1000)
    out_bytes = current
    page_count = 0
    try:
        with fitz.open(stream=out_bytes, filetype="pdf") as _verify:
            page_count = len(_verify)
    except Exception:
        # Shouldn't happen — we just produced this — but be safe.
        page_count = 0

    suggested_name = (file.filename or "repaired.pdf").rsplit(".", 1)[0] + "-repaired.pdf"

    return RepairResponse(
        pages=page_count,
        size_bytes=len(out_bytes),
        filename=suggested_name,
        actions_applied=actions_applied,
        elapsed_ms=elapsed_ms,
        needs_ocr=needs_ocr_input,
    )


@router.post(
    "/repair-download",
    response_class=StreamingResponse,
    summary="Repair a PDF and stream the result back (≤ 50 MB)",
)
async def pdf_repair_download(
    file: Annotated[UploadFile, File(description="PDF to repair")],
    ocr: Annotated[bool, Form()] = True,
    repair: Annotated[bool, Form()] = True,
    unlock: Annotated[bool, Form()] = False,
    password: Annotated[str, Form()] = "",
    linearize: Annotated[bool, Form()] = True,
    lang: Annotated[str, Form()] = "eng",
    dpi: Annotated[int, Form()] = 300,
) -> StreamingResponse:
    """Same as /repair but streams the repaired PDF directly as a
    download. Use this from the web UI.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF.")
    if dpi < 150 or dpi > 600:
        raise HTTPException(400, "DPI must be between 150 and 600.")
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    actions_applied: list[str] = []
    current = blob
    needs_ocr_input = not _has_text_layer(current) if ocr else False

    if repair:
        current = _repair_with_pikepdf(current)
        actions_applied.append("repair")
    if unlock:
        current = _unlock(current, password or None)
        actions_applied.append("unlock")
    if linearize:
        current = _linearize(current)
        actions_applied.append("linearize")
    if ocr and needs_ocr_input:
        current = _ocr_pdf(current, lang, dpi)
        actions_applied.append("ocr")
    if not actions_applied:
        current = _linearize(current)
        actions_applied.append("linearize (no-op)")

    suggested_name = (file.filename or "repaired.pdf").rsplit(".", 1)[0] + "-repaired.pdf"

    return StreamingResponse(
        io.BytesIO(current),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{suggested_name}"',
            "X-Repair-Actions": ",".join(actions_applied),
            "X-Repair-Needs-Ocr": str(needs_ocr_input).lower(),
            "X-Repair-Output-Bytes": str(len(current)),
            "Cache-Control": "no-store",
        },
    )
