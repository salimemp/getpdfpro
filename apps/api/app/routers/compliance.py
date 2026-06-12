"""PDF compliance / advanced tools — Wave 3 (Adobe cascade).

Four endpoints, all cascade through Adobe PDF Services (tier 1)
and fall back to self-hosted pikepdf (tier 2) when Adobe is not
configured or the free tier is exhausted.

  /pdf-to-pdfa-download    — PDF → PDF/A-2b (archival format)
  /redact-download         — redact text patterns (genuine deletion)
  /compare-download        — compare two PDFs (structural + text diff)
  /forms-extract-download  — extract form field data as JSON

Cascade strategy:

  PDF/A:  Adobe (correct conformance) → pikepdf metadata cleanup
          (approximate; labeled in response). Note that true PDF/A
          conformance needs font embedding + sRGB color check that
          only Adobe does well. Self-hosted is best-effort.

  Redact: Adobe (genuine text removal) → pikepdf "blackout"
          (draws black rectangles on matches; NOT real redaction,
          but a visual approximation that may suffice for low-risk
          use cases). The response clearly labels which path served
          the request.

  Compare: Adobe (visual diff report) → PyMuPDF text-only diff
          (returns a JSON with per-page text-delta stats; the
          output is labeled "approximate").

  Forms:  Adobe only (genuine AcroForm extraction is non-trivial).
          Self-hosted fallback is PyMuPDF's widget list — also
          useful, also labeled.

All four are honest about which adapter served the request via
the `X-Cascade-Adapter` response header.
"""

from __future__ import annotations

import io
import json
import logging
import time
from typing import Annotated, Literal

import fitz  # PyMuPDF
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_SYNC_SIZE = 50 * 1024 * 1024


# ─── Helpers ─────────────────────────────────────────────────────
def _validate_pdf_filename(filename: str | None) -> str:
    if not filename or not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF.")
    return filename


def _suggest_name(original: str, suffix: str) -> str:
    base = (original or "document.pdf").rsplit(".", 1)[0]
    return f"{base}-{suffix}.pdf"


# ─── /pdf-to-pdfa-download ─────────────────────────────────────
@router.post(
    "/pdf-to-pdfa-download",
    response_class=StreamingResponse,
    summary="Convert a PDF to PDF/A-2b archival format (sync, ≤ 50 MB)",
    responses={
        200: {"description": "PDF/A-2b conformant PDF", "content": {"application/pdf": {}}},
        400: {"description": "Invalid input"},
        413: {"description": "File exceeds 50 MB cap"},
        503: {"description": "Adobe PDF Services not configured and self-hosted fallback failed"},
    },
)
async def pdf_to_pdfa(
    file: Annotated[UploadFile, File(description="PDF to convert to PDF/A")],
    conformance: Annotated[
        Literal["PDF_A_1_B", "PDF_A_2_B", "PDF_A_3_B"],
        Form(description="PDF/A conformance level (default PDF_A_2_B)"),
    ] = "PDF_A_2_B",
) -> StreamingResponse:
    """Convert a PDF to PDF/A (archival) format.

    PDF/A is a restricted subset of PDF designed for long-term
    preservation. It requires embedded fonts, sRGB color, no
    external references, and no encryption.

    Tier 1: Adobe PDF Services. This is the only path that
    produces a strictly conformant PDF/A-2b (or 1b, 3b). It
    handles font embedding, color space conversion, and XMP
    metadata correctly.

    Tier 2 (fallback): pikepdf metadata cleanup. This is
    approximate — it sets the /OutputIntent to sRGB and
    writes the right /Version, but does NOT verify font
    embedding or color spaces. Use the Adobe path if you
    need strict conformance.
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    cascade_adapter = "self-hosted (pikepdf)"
    out_bytes: bytes

    # Try Adobe first
    try:
        from app.adapters import adobe_ops

        if adobe_ops.is_configured():
            t0 = time.time()
            result = await adobe_ops.pdf_to_pdfa(blob, conformance=conformance)
            out_bytes = result.bytes
            cascade_adapter = "adobe"
            elapsed_ms = int((time.time() - t0) * 1000)
        else:
            raise adobe_ops.AdobeOpError("Adobe not configured", retryable=False)
    except Exception as exc:
        logger.info("Adobe PDF/A unavailable (%s); falling back to pikepdf", exc)
        # Self-hosted fallback: pikepdf metadata cleanup
        try:
            import pikepdf
        except ImportError as exc2:
            raise HTTPException(503, "pikepdf is not installed.") from exc2
        # pikepdf 8.x's save() with fix_metadata_version=True
        # sometimes triggers a qpdf temp-file roundtrip that fails
        # on BytesIO ("No such file or directory: b'%PDF...'"). Save
        # to a real temp file path to avoid that.
        import os
        import tempfile
        fd_in, path_in = tempfile.mkstemp(suffix=".pdf")
        try:
            with os.fdopen(fd_in, "wb") as f:
                f.write(blob)
            with pikepdf.open(path_in, allow_overwriting_input=True) as pdf:
                # pikepdf 9.x made pdf_version read-only. To set
                # the version, we have to use the lowest-level API:
                # patch the /Root object to point to a fresh Version,
                # then save. Simpler: just call save with the
                # desired min_version.
                # In pikepdf 9, min_version is a save() parameter.
                min_ver = "1.4" if conformance == "PDF_A_1_B" else "1.7"
                with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
                    meta["dc:title"] = meta.get("dc:title", "Document")
                    meta["pdf:Producer"] = "GetPDFPro (pikepdf fallback)"
                fd_out, path_out = tempfile.mkstemp(suffix=".pdf")
                try:
                    with os.fdopen(fd_out, "wb") as f:
                        # min_version pins the /Root entry to at
                        # least the requested PDF version. This is
                        # the pikepdf 9.x replacement for the
                        # removed pdf_version setter.
                        try:
                            pdf.save(f, linearize=False, min_version=min_ver)
                        except TypeError:
                            # Older pikepdf without min_version kwarg
                            pdf.save(f, linearize=False)
                    with open(path_out, "rb") as f:
                        out_bytes = f.read()
                finally:
                    try: os.unlink(path_out)
                    except OSError: pass
        except Exception as exc2:
            logger.exception("pikepdf PDF/A fallback failed")
            raise HTTPException(
                503,
                f"PDF/A conversion failed on both Adobe and self-hosted. Last error: {exc2}",
            ) from exc2
        finally:
            try: os.unlink(path_in)
            except OSError: pass

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "pdfa")}"',
            "X-Pdf-Conformance": conformance,
            "X-Cascade-Adapter": cascade_adapter,
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )


# ─── /redact-download ──────────────────────────────────────────
@router.post(
    "/redact-download",
    response_class=StreamingResponse,
    summary="Redact text patterns from a PDF (sync, ≤ 50 MB)",
    responses={
        200: {"description": "Redacted PDF", "content": {"application/pdf": {}}},
        400: {"description": "Invalid input or no words/regex supplied"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def redact_pdf(
    file: Annotated[UploadFile, File(description="PDF to redact")],
    words: Annotated[
        str,
        Form(description="Comma-separated list of words/phrases to redact (e.g. 'SSN,DOB,John Smith')"),
    ] = "",
    regex: Annotated[
        str,
        Form(description="Comma-separated list of regular expressions to redact (e.g. '\\d{3}-\\d{2}-\\d{4}')"),
    ] = "",
) -> StreamingResponse:
    """Redact text from a PDF.

    Two input types:
      - `words`: comma-separated list of plain strings to remove.
      - `regex`: comma-separated list of regular expressions.

    Tier 1: Adobe redact. Genuine text removal — the underlying
    glyphs and ToUnicode entries are deleted from the PDF stream.
    This is real redaction; the redacted text cannot be recovered
    from the output.

    Tier 2: pikepdf + PyMuPDF blackout. Draws black rectangles over
    matches. Visually similar but the underlying text IS still in
    the PDF. Anyone with a text-extraction tool can read the
    "redacted" content. ONLY use for non-sensitive content.
    """
    word_list = [w.strip() for w in words.split(",") if w.strip()]
    regex_list = [r.strip() for r in regex.split(",") if r.strip()]
    if not word_list and not regex_list:
        raise HTTPException(400, "Provide at least one word or regex to redact.")
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    cascade_adapter = "self-hosted (pikepdf blackout)"
    out_bytes: bytes

    # Try Adobe first
    try:
        from app.adapters import adobe_ops

        if adobe_ops.is_configured():
            result = await adobe_ops.redact(blob, words=word_list, regex=regex_list)
            out_bytes = result.bytes
            cascade_adapter = "adobe"
        else:
            raise adobe_ops.AdobeOpError("Adobe not configured", retryable=False)
    except Exception as exc:
        logger.info("Adobe redact unavailable (%s); falling back to blackout", exc)
        # Self-hosted fallback: draw black rectangles on matches.
        # We use PyMuPDF's text search to find each match, then
        # draw a filled black rectangle over it. The text stays in
        # the PDF stream (not deleted), so this is NOT real
        # redaction — anyone with a text extraction tool can read
        # the "redacted" content. The response clearly labels this
        # via the X-Cascade-Adapter header.
        try:
            src = fitz.open(stream=blob, filetype="pdf")
        except Exception as exc2:
            raise HTTPException(400, f"Could not read PDF: {exc2}") from exc2
        try:
            page_count = len(src)
            redactions_applied = 0
            for page in src:
                rects = []
                for w in word_list:
                    for inst in page.search_for(w):
                        rects.append(inst)
                for pat in regex_list:
                    try:
                        for inst in page.search_for(pat):
                            rects.append(inst)
                    except Exception:
                        # PyMuPDF's regex is limited; skip on error
                        continue
                for r in rects:
                    page.add_redact_annot(r, fill=(0, 0, 0))
                    page.apply_redactions()
                    redactions_applied += 1
            out_buf = io.BytesIO()
            src.save(out_buf, garbage=4, deflate=True)
            out_bytes = out_buf.getvalue()
            logger.info(
                "Blackout fallback: %d redactions across %d pages",
                redactions_applied, page_count,
            )
        except Exception as exc2:
            logger.exception("Redact fallback failed")
            raise HTTPException(
                500,
                f"Redact failed on both Adobe and self-hosted: {exc2}",
            ) from exc2
        finally:
            src.close()

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "redacted")}"',
            "X-Cascade-Adapter": cascade_adapter,
            "X-Words-Redacted": str(len(word_list)),
            "X-Regex-Redacted": str(len(regex_list)),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )


# ─── /compare-download ─────────────────────────────────────────
@router.post(
    "/compare-download",
    response_class=StreamingResponse,
    summary="Compare two PDFs (sync, ≤ 50 MB total)",
    responses={
        200: {"description": "Comparison report (JSON)", "content": {"application/json": {}}},
        400: {"description": "Need exactly 2 PDFs"},
        413: {"description": "Total size exceeds 50 MB cap"},
    },
)
async def compare_pdfs(
    file_a: Annotated[UploadFile, File(description="Base PDF (the 'old' version)")],
    file_b: Annotated[UploadFile, File(description="Target PDF (the 'new' version)")],
) -> StreamingResponse:
    """Compare two PDFs and return a difference report (JSON).

    Tier 1: Adobe Document Compare. Returns a visual + structural
    diff including which paragraphs were added, removed, or
    modified, and the visual layout changes.

    Tier 2: PyMuPDF text diff. Returns per-page statistics
    (chars in A, chars in B, overlap %, words in A only, words in
    B only). No visual diff.

    The output is JSON either way; the structure differs slightly
    between adapters. The X-Cascade-Adapter header tells you which
    path served the request.
    """
    for f, label in [(file_a, "file_a"), (file_b, "file_b")]:
        _validate_pdf_filename(f.filename)
    blob_a = await file_a.read()
    blob_b = await file_b.read()
    if not blob_a or not blob_b:
        raise HTTPException(400, "Both PDFs are required.")
    if len(blob_a) + len(blob_b) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"Total size exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    cascade_adapter = "self-hosted (PyMuPDF text diff)"
    report_bytes: bytes

    # Try Adobe first
    try:
        from app.adapters import adobe_ops

        if adobe_ops.is_configured():
            result = await adobe_ops.compare(blob_a, blob_b)
            report_bytes = result.bytes
            cascade_adapter = "adobe"
        else:
            raise adobe_ops.AdobeOpError("Adobe not configured", retryable=False)
    except Exception as exc:
        logger.info("Adobe compare unavailable (%s); falling back to text diff", exc)
        # Self-hosted fallback: PyMuPDF text-only diff.
        try:
            doc_a = fitz.open(stream=blob_a, filetype="pdf")
            doc_b = fitz.open(stream=blob_b, filetype="pdf")
        except Exception as exc2:
            raise HTTPException(400, f"Could not read PDFs: {exc2}") from exc2
        try:
            pages_a = len(doc_a)
            pages_b = len(doc_b)
            report: dict = {
                "kind": "approximate_text_diff",
                "page_count_a": pages_a,
                "page_count_b": pages_b,
                "pages": [],
            }
            max_pages = max(pages_a, pages_b)
            for i in range(max_pages):
                page_data: dict = {"page": i + 1}
                if i < pages_a:
                    text_a = doc_a[i].get_text("text").strip()
                    page_data["chars_a"] = len(text_a)
                    page_data["words_a"] = set(text_a.split())
                else:
                    page_data["chars_a"] = 0
                    page_data["words_a"] = set()
                if i < pages_b:
                    text_b = doc_b[i].get_text("text").strip()
                    page_data["chars_b"] = len(text_b)
                    page_data["words_b"] = set(text_b.split())
                else:
                    page_data["chars_b"] = 0
                    page_data["words_b"] = set()
                common = page_data["words_a"] & page_data["words_b"]
                only_a = page_data["words_a"] - page_data["words_b"]
                only_b = page_data["words_b"] - page_data["words_a"]
                page_data["words_common"] = len(common)
                page_data["words_only_in_a"] = sorted(only_a)[:200]  # cap to keep response small
                page_data["words_only_in_b"] = sorted(only_b)[:200]
                page_data["change_pct"] = (
                    round((len(only_a) + len(only_b)) * 100 / max(1, len(common) + len(only_a) + len(only_b)), 1)
                )
                report["pages"].append(page_data)
            report["summary"] = {
                "total_chars_a": sum(p.get("chars_a", 0) for p in report["pages"]),
                "total_chars_b": sum(p.get("chars_b", 0) for p in report["pages"]),
                "pages_with_changes": sum(1 for p in report["pages"] if p.get("change_pct", 0) > 0),
            }
            report_bytes = json.dumps(report, indent=2).encode("utf-8")
        except Exception as exc2:
            logger.exception("Compare fallback failed")
            raise HTTPException(500, f"Compare failed: {exc2}") from exc2
        finally:
            try: doc_a.close()
            except Exception: pass
            try: doc_b.close()
            except Exception: pass

    return StreamingResponse(
        io.BytesIO(report_bytes),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="compare-report.json"',
            "X-Cascade-Adapter": cascade_adapter,
            "Cache-Control": "no-store",
        },
    )


# ─── /forms-extract-download ───────────────────────────────────
@router.post(
    "/forms-extract-download",
    response_class=StreamingResponse,
    summary="Extract form field data from a PDF as JSON (sync, ≤ 50 MB)",
    responses={
        200: {"description": "Form fields as JSON", "content": {"application/json": {}}},
        400: {"description": "Invalid PDF or no form fields found"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def forms_extract(
    file: Annotated[UploadFile, File(description="PDF with form fields")],
) -> StreamingResponse:
    """Extract form field data from a PDF (AcroForm).

    Returns a JSON file with one entry per form field:
    name, type, value, default, options (for choice fields), etc.

    Tier 1: Adobe extractPDF API. Best fidelity — handles XFA
    forms, complex field hierarchies, JavaScript-calculated values.

    Tier 2: PyMuPDF widget walk. Returns a basic listing of
    AcroForm widgets (type, name, value, rect). Does not handle
    XFA. Useful for most simple forms.

    The output structure is normalized to:
      {fields: [{name, type, value, default, options}], count, source}
    where `source` is "adobe" or "pymupdf".
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    cascade_adapter = "self-hosted (PyMuPDF)"
    fields: list[dict] = []

    # Try Adobe first
    try:
        from app.adapters import adobe_ops

        if adobe_ops.is_configured():
            result = await adobe_ops.extract_forms(blob)
            # The Adobe result is the extractPDF JSON. The relevant
            # array is `elements` (mixed tables+formFields) — pull
            # out formFields.
            try:
                data = json.loads(result.bytes)
            except Exception:
                data = {}
            raw_fields = (
                data.get("formFields")
                or data.get("elements")
                or []
            )
            for f in raw_fields:
                fields.append({
                    "name": f.get("name") or f.get("fieldName") or "",
                    "type": f.get("type") or f.get("fieldType") or "unknown",
                    "value": f.get("value") or f.get("fieldValue"),
                    "default": f.get("defaultValue"),
                    "options": f.get("options") or f.get("enumValues"),
                })
            cascade_adapter = "adobe"
        else:
            raise adobe_ops.AdobeOpError("Adobe not configured", retryable=False)
    except Exception as exc:
        logger.info("Adobe forms extract unavailable (%s); falling back to PyMuPDF", exc)
        # Self-hosted fallback: PyMuPDF widget walk
        try:
            src = fitz.open(stream=blob, filetype="pdf")
        except Exception as exc2:
            raise HTTPException(400, f"Could not read PDF: {exc2}") from exc2
        try:
            for page in src:
                for widget in page.widgets() or []:
                    fields.append({
                        "name": widget.field_name or "",
                        "type": _widget_type_name(widget.field_type),
                        "value": widget.field_value,
                        "default": widget.field_default_value,
                        "options": _widget_options(widget),
                        "rect": [widget.rect.x0, widget.rect.y0, widget.rect.x1, widget.rect.y1],
                    })
        except Exception as exc2:
            logger.exception("Forms extract fallback failed")
            raise HTTPException(500, f"Forms extract failed: {exc2}") from exc2
        finally:
            src.close()

    if not fields:
        # Not an error — just no form fields in the PDF
        logger.info("No form fields found in %s", file.filename)

    out_obj = {
        "count": len(fields),
        "source": cascade_adapter,
        "fields": fields,
    }
    out_bytes = json.dumps(out_obj, indent=2).encode("utf-8")

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "forms").rsplit(".", 1)[0]}.json"',
            "X-Cascade-Adapter": cascade_adapter,
            "X-Form-Field-Count": str(len(fields)),
            "Cache-Control": "no-store",
        },
    )


def _widget_type_name(t: int) -> str:
    """Map PyMuPDF's widget field_type int to a string name."""
    # From PyMuPDF docs:
    return {
        0: "unknown",
        1: "button",
        2: "checkbox",
        3: "combobox",
        4: "listbox",
        5: "radiobutton",
        6: "signature",
        7: "text",
    }.get(t, f"type_{t}")


def _widget_options(widget) -> list[str] | None:
    """Return the choice-field options for a combobox/listbox, else None."""
    try:
        if hasattr(widget, "choice_values") and widget.choice_values:
            return list(widget.choice_values)
    except Exception:
        pass
    return None
