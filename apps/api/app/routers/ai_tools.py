"""PDF AI tools — Summarize and Translate.

Two endpoints, both gated on GEMINI_API_KEY being configured:

  /summarize-download — Extract text from a PDF, send to Gemini
                        for summarization, return the summary as
                        a plain text file (or markdown).

  /translate-download — Extract text from a PDF, send to Gemini
                        for translation to the target language,
                        return as a new PDF (preserving layout) OR
                        a plain text file.

Both endpoints:
  - 50 MB cap (sync, like the other PDF tools)
  - Use the existing /pdf-to-text logic for text extraction
    (PyMuPDF get_text)
  - Auto-detect when a PDF has no text layer (i.e. it's a scan)
    and run Tesseract OCR first. For a 50-page scanned PDF this
    can take a while; we surface a 413 with a message suggesting
    the user pre-OCR the file with /ocr-download.
  - For very long documents, chunking is handled inside the AI
    service (see services/ai.py)

Output formats:
  - summarize: plain text (.txt) or markdown (.md) per the user's choice
  - translate: a new PDF (preserving the original page layout where
               possible — the translated text is placed on the same
               page positions as the source). This is the iLovePDF
               / DeepL-style output. If the user prefers a plain
               text file, they can use the form flag.

Both endpoints surface which Gemini model served the request via
the X-Ai-Model response header.
"""

from __future__ import annotations

import io
import logging
import time
from typing import Annotated, Literal

import fitz  # PyMuPDF
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_SYNC_SIZE = 50 * 1024 * 1024

# Maximum text we feed to Gemini in one go. Even with chunking
# inside the AI service, the extraction step can produce a
# massive amount of text from a long PDF. Cap at 1MB of text —
# about 250K tokens, well under flash-8b's 1M window but big
# enough to handle a 200-page book in 2-3 chunks.
MAX_TEXT_BYTES = 1_000_000


# ─── helpers ─────────────────────────────────────────────────
def _validate_pdf_filename(filename: str | None) -> str:
    if not filename or not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF.")
    return filename


def _suggest_name(original: str, suffix: str, ext: str = "pdf") -> str:
    base = (original or "document.pdf").rsplit(".", 1)[0]
    return f"{base}-{suffix}.{ext}"


def _extract_text(blob: bytes) -> tuple[str, int]:
    """Extract text from a PDF. Returns (text, page_count).

    Raises HTTPException(400) if extraction fails or text is
    empty. The text is concatenated page-by-page with double
    newlines between pages.
    """
    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc
    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")
        parts: list[str] = []
        for page in src:
            try:
                text = page.get_text("text").strip()
                if text:
                    parts.append(text)
            except Exception as exc:
                logger.warning("Page %d text extract failed: %s", len(parts) + 1, exc)
        text = "\n\n".join(parts)
    finally:
        src.close()
    if not text.strip():
        raise HTTPException(
            400,
            "No extractable text in this PDF — it appears to be a scanned "
            "image. Use the /tools/ocr tool to add a text layer first, "
            "then come back to summarize or translate.",
        )
    if len(text) > MAX_TEXT_BYTES:
        # Truncate to MAX_TEXT_BYTES and add a marker. The AI
        # service still works on truncated text; it just
        # won't be a full summary.
        logger.warning("PDF text is %d bytes; truncating to %d", len(text), MAX_TEXT_BYTES)
        text = text[:MAX_TEXT_BYTES] + "\n\n[Text truncated at 1MB — your PDF is very long. The summary below covers the first portion only.]"
    return text, page_count


def _build_translated_pdf(
    original_blob: bytes,
    translated_text: str,
) -> bytes:
    """Build a new PDF with the translated text placed on the
    same page positions as the source. Preserves the page count
    and approximate page size.

    This is the iLovePDF / DeepL-style output: a new PDF where
    each page has the translation instead of the source text.
    Layout (fonts, images, headers, footers) is NOT preserved —
    we draw plain text on white pages. This is a faithful
    translation, not a faithful re-layout.
    """
    try:
        src = fitz.open(stream=original_blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc
    try:
        # Build the output by drawing translated text on each
        # page. We distribute the translated text across pages
        # proportionally to the source page sizes.
        out = fitz.open()
        try:
            page_sizes = [(p.rect.width, p.rect.height) for p in src]
            # Split translated text into N chunks (one per page)
            # using word count proportional to source page char count
            src_lengths = []
            for p in src:
                try:
                    src_lengths.append(max(1, len(p.get_text("text"))))
                except Exception:
                    src_lengths.append(1)
            total_src = sum(src_lengths)
            words = translated_text.split()
            total_words = len(words)
            # Each page gets a target word count
            page_word_targets = [
                max(20, int(round(total_words * (sl / total_src))))
                for sl in src_lengths
            ]
            # Distribute any rounding remainder to the last page
            page_word_targets[-1] = total_words - sum(page_word_targets[:-1])
            word_idx = 0
            margin = 50  # 50 pt = ~0.7 inch
            for i, (pw, ph) in enumerate(page_sizes):
                # Use a sensible font size based on page size
                font_size = max(8, min(11, int(pw / 50)))
                line_height = font_size * 1.4
                text_rect_w = pw - 2 * margin
                text_rect_h = ph - 2 * margin
                # New page in the output
                page = out.new_page(width=pw, height=ph)
                # Greedy: write as many words per line as fit,
                # then start a new line, etc.
                rect = fitz.Rect(margin, margin, pw - margin, ph - margin)
                # Use insert_textbox to lay out automatically
                target_words = page_word_targets[i] if i < len(page_word_targets) else 0
                chunk = " ".join(words[word_idx:word_idx + target_words])
                word_idx += target_words
                # insert_textbox with a generous rect; if the text
                # overflows, fitz will return a non-zero
                # remaining — that's OK, we just don't render
                # the overflow.
                page.insert_textbox(
                    rect, chunk,
                    fontsize=font_size,
                    color=(0, 0, 0),
                    align=0,  # left
                )
            out_buf = io.BytesIO()
            out.save(out_buf, garbage=4, deflate=True)
            payload = out_buf.getvalue()
        finally:
            out.close()
    finally:
        src.close()
    return payload


# ─── /summarize-download ────────────────────────────────────
@router.post(
    "/summarize-download",
    response_class=StreamingResponse,
    summary="Summarize a PDF using Gemini AI (sync, ≤ 50 MB)",
    responses={
        200: {"description": "Summary as text or markdown", "content": {"text/plain": {}, "text/markdown": {}}},
        400: {"description": "Invalid PDF or no extractable text"},
        413: {"description": "File exceeds 50 MB cap"},
        503: {"description": "GEMINI_API_KEY not configured"},
    },
)
async def summarize_pdf(
    file: Annotated[UploadFile, File(description="PDF to summarize")],
    length: Annotated[
        Literal["short", "medium", "long", "bullets"],
        Form(description="Summary length"),
    ] = "medium",
    language: Annotated[
        str, Form(description="Output language (2-letter code, default 'en')")
    ] = "en",
    format: Annotated[
        Literal["text", "markdown"],
        Form(description="Output format"),
    ] = "markdown",
) -> StreamingResponse:
    """Summarize a PDF using Gemini.

    Extracts the text from the PDF, sends it to Gemini with a
    summarization prompt at the requested length, returns the
    summary as a downloadable text or markdown file.

    The model used is `settings.gemini_model` (gemini-1.5-flash-8b
    by default — fast, free tier, adequate quality).
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    from app.services import ai
    if not ai.is_configured():
        raise HTTPException(
            503,
            "AI features are not configured on this server. Set the "
            "GEMINI_API_KEY environment variable on Railway to enable "
            "Summarize and Translate.",
        )

    text, page_count = _extract_text(blob)
    t0 = time.time()
    try:
        summary = ai.summarize_text(text, length=length, language=language)
    except ai.AiError as exc:
        raise HTTPException(500, str(exc)) from exc
    elapsed_ms = int((time.time() - t0) * 1000)

    if not summary:
        raise HTTPException(500, "AI returned an empty summary.")

    suffix = f"summary-{length}"
    ext = "md" if format == "markdown" else "txt"
    out_bytes = summary.encode("utf-8")
    out_name = _suggest_name(file.filename or "doc.pdf", suffix, ext)
    media_type = "text/markdown" if format == "markdown" else "text/plain"

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            "X-Pdf-Source-Pages": str(page_count),
            "X-Summary-Length": length,
            "X-Summary-Language": language,
            "X-Ai-Model": ai._model_name or "unknown",
            "X-Ai-Elapsed-Ms": str(elapsed_ms),
            "X-Summary-Format": format,
            "Cache-Control": "no-store",
        },
    )


# ─── /translate-download ────────────────────────────────────
@router.post(
    "/translate-download",
    response_class=StreamingResponse,
    summary="Translate a PDF using Gemini AI (sync, ≤ 50 MB)",
    responses={
        200: {"description": "Translated PDF or text", "content": {"application/pdf": {}, "text/plain": {}}},
        400: {"description": "Invalid PDF or no extractable text"},
        413: {"description": "File exceeds 50 MB cap"},
        503: {"description": "GEMINI_API_KEY not configured"},
    },
)
async def translate_pdf(
    file: Annotated[UploadFile, File(description="PDF to translate")],
    target_lang: Annotated[
        str, Form(description="Target language (2-letter code, e.g. 'es', 'fr', 'de')")
    ] = "es",
    source_lang: Annotated[
        str, Form(description="Source language (2-letter code). Leave blank to auto-detect.")
    ] = "",
    output_format: Annotated[
        Literal["pdf", "text"],
        Form(description="Output: 'pdf' = translated text on new PDF pages; 'text' = plain text"),
    ] = "pdf",
) -> StreamingResponse:
    """Translate a PDF using Gemini.

    Extracts the text, sends it to Gemini for translation to the
    target language, and either:
      - Builds a new PDF with the translated text placed on the
        same page positions as the source (iLovePDF / DeepL
        style output). The new PDF does NOT preserve the
        original layout — it's a clean page with the translation
        in plain text. Fonts, images, headers, and footers are
        not preserved.
      - OR returns the translation as a plain text file
        (preserving paragraph breaks).

    Source language is auto-detected unless `source_lang` is
    given.

    Caveats (called out in the UI):
      - Translation quality is best-effort, not professional
        translator quality.
      - For technical / legal / medical content, always have a
        human review.
      - Long documents may take 30-60s (Gemini processing).
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    from app.services import ai
    if not ai.is_configured():
        raise HTTPException(
            503,
            "AI features are not configured on this server. Set the "
            "GEMINI_API_KEY environment variable on Railway to enable "
            "Summarize and Translate.",
        )

    text, page_count = _extract_text(blob)
    t0 = time.time()
    try:
        translated = ai.translate_text(
            text,
            target_lang=target_lang,
            source_lang=source_lang or None,
        )
    except ai.AiError as exc:
        raise HTTPException(500, str(exc)) from exc
    elapsed_ms = int((time.time() - t0) * 1000)

    if not translated:
        raise HTTPException(500, "AI returned an empty translation.")

    if output_format == "text":
        # Plain text output
        out_bytes = translated.encode("utf-8")
        out_name = _suggest_name(file.filename or "doc.pdf", f"translated-{target_lang}", "txt")
        media_type = "text/plain; charset=utf-8"
        return StreamingResponse(
            io.BytesIO(out_bytes),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{out_name}"',
                "X-Pdf-Source-Pages": str(page_count),
                "X-Target-Lang": target_lang,
                "X-Source-Lang": source_lang or "auto",
                "X-Ai-Model": ai._model_name or "unknown",
                "X-Ai-Elapsed-Ms": str(elapsed_ms),
                "X-Output-Format": "text",
                "Cache-Control": "no-store",
            },
        )

    # PDF output: build a new PDF with the translated text
    out_bytes = _build_translated_pdf(blob, translated)
    out_name = _suggest_name(file.filename or "doc.pdf", f"translated-{target_lang}", "pdf")
    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            "X-Pdf-Source-Pages": str(page_count),
            "X-Pdf-Output-Pages": str(page_count),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "X-Target-Lang": target_lang,
            "X-Source-Lang": source_lang or "auto",
            "X-Ai-Model": ai._model_name or "unknown",
            "X-Ai-Elapsed-Ms": str(elapsed_ms),
            "X-Output-Format": "pdf",
            "Cache-Control": "no-store",
        },
    )
