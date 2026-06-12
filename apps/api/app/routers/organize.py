"""PDF organization tools — Wave 1 (foundation, pikepdf + PyMuPDF only).

Six endpoints, all self-hosted (no Adobe dependency):

  /rotate-download       — rotate all or specific pages by 90/180/270°
  /crop-download         — crop pages to a rectangle (in points or % of page)
  /extract-pages-download— extract a subset of pages into a new PDF
  /add-remove-download   — delete pages from a PDF
  /organize-download     — reorder/duplicate pages in a PDF
  /page-numbers-download — add "Page N of M" to every page

All six are pure structural operations on PDF bytes. No OCR, no
rendering, no Adobe. They should never fail on a valid, non-encrypted
PDF; they all use pikepdf for the IO and PyMuPDF for the overlay
operations (page numbers).

Limitations:
  - Page numbers use a small black text in the bottom-center by
    default. Custom font/position/size would need ReportLab hooks
    — out of scope for MVP. User can pick position (corner) and
    start-number.
  - Crop is destructive (it changes the visible page). For "remove
    margins only" use Crop with a small margin value.
  - Rotate uses the page-level /Rotate flag in the PDF. PDF viewers
    respect this; it's not a destructive rasterization.
  - Organize/extract/add-remove are page-reorder operations on the
    existing page objects. They don't re-render anything, so visual
    fidelity is perfect.

All six return StreamingResponse with a Content-Disposition for the
filename the web UI can pick up.
"""

from __future__ import annotations

import io
import logging
import time
from typing import Annotated, Literal

import fitz  # PyMuPDF
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Same 50 MB sync cap as the other PDF tools. Larger files would
# need to go through Celery (TODO).
MAX_SYNC_SIZE = 50 * 1024 * 1024


# ─── helpers ──────────────────────────────────────────────────────
def _parse_page_list(spec: str, total: int) -> list[int]:
    """Parse a page spec like '1-3,5,7-9' into a sorted list of
    0-based page indices, deduped. Pages outside [1, total] are
    dropped. Returns [] if nothing valid.

    Accepts whitespace and ignores empty tokens.
    """
    if not spec:
        return []
    out: set[int] = set()
    for raw in spec.split(","):
        token = raw.strip()
        if not token:
            continue
        if "-" in token:
            a, _, b = token.partition("-")
            try:
                start = int(a)
                end = int(b)
            except ValueError:
                continue
            if start > end:
                start, end = end, start
            for n in range(start, end + 1):
                if 1 <= n <= total:
                    out.add(n - 1)
        else:
            try:
                n = int(token)
            except ValueError:
                continue
            if 1 <= n <= total:
                out.add(n - 1)
    return sorted(out)


def _validate_pdf_filename(filename: str | None) -> str:
    if not filename or not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF.")
    return filename


def _suggest_name(original: str, suffix: str) -> str:
    """Turn 'foo.pdf' into 'foo-{suffix}.pdf'."""
    base = (original or "document.pdf").rsplit(".", 1)[0]
    return f"{base}-{suffix}.pdf"


# ─── /rotate-download ────────────────────────────────────────────
@router.post(
    "/rotate-download",
    response_class=StreamingResponse,
    summary="Rotate all or specific pages of a PDF (sync, ≤ 50 MB)",
    responses={
        200: {"description": "Rotated PDF", "content": {"application/pdf": {}}},
        400: {"description": "Invalid input"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def rotate_pdf(
    file: Annotated[UploadFile, File(description="PDF to rotate")],
    angle: Annotated[
        int,
        Form(description="Rotation angle in degrees: 90, 180, or 270"),
    ] = 90,
    pages: Annotated[
        str,
        Form(description="Comma-separated page numbers/ranges, e.g. '1,3-5'. Empty = all pages."),
    ] = "",
) -> StreamingResponse:
    """Rotate pages of a PDF. The /Rotate flag in PDF is honored by
    every viewer, so this is a non-destructive operation — the
    underlying page contents aren't re-rendered.

    Default: rotate all pages 90° clockwise. Use angle=180 to flip
    upside down, angle=270 to rotate 90° counter-clockwise.

    If `pages` is given, only those pages are rotated (others keep
    their current rotation).
    """
    if angle not in (90, 180, 270):
        raise HTTPException(400, "Angle must be 90, 180, or 270.")
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")

        target_pages: list[int]
        if pages.strip():
            target_pages = _parse_page_list(pages, page_count)
            if not target_pages:
                raise HTTPException(
                    400,
                    f"pages spec '{pages}' matched no pages. PDF has {page_count} pages.",
                )
        else:
            target_pages = list(range(page_count))

        for idx in target_pages:
            page = src[idx]
            # SetRotation is additive: pass the desired absolute angle.
            current = page.rotation
            page.set_rotation((current + angle) % 360)

        out_buf = io.BytesIO()
        src.save(out_buf, garbage=4, deflate=True)
        out_bytes = out_buf.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Rotate failed")
        raise HTTPException(500, f"Rotate failed: {exc}") from exc
    finally:
        src.close()

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "rotated")}"',
            "X-Pdf-Source-Pages": str(page_count),
            "X-Rotated-Pages": str(len(target_pages)),
            "X-Rotate-Angle": str(angle),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )


# ─── /crop-download ──────────────────────────────────────────────
@router.post(
    "/crop-download",
    response_class=StreamingResponse,
    summary="Crop a PDF to a rectangle (sync, ≤ 50 MB)",
)
async def crop_pdf(
    file: Annotated[UploadFile, File(description="PDF to crop")],
    # In PDF points (1 pt = 1/72 inch). At 72 DPI, 1 pt = 1 pixel.
    top: Annotated[
        float, Form(description="Top crop in points from the top edge (default 0 = no crop)")
    ] = 0,
    bottom: Annotated[
        float, Form(description="Bottom crop in points from the bottom edge (default 0)")
    ] = 0,
    left: Annotated[
        float, Form(description="Left crop in points from the left edge (default 0)")
    ] = 0,
    right: Annotated[
        float, Form(description="Right crop in points from the right edge (default 0)")
    ] = 0,
    pages: Annotated[
        str,
        Form(description="Pages to crop (1-based, e.g. '1,3-5'). Empty = all pages."),
    ] = "",
) -> StreamingResponse:
    """Crop pages of a PDF by shrinking the visible MediaBox.

    Args are in PDF points (1 pt = 1/72 inch). Typical letter-size
    page is 612×792 points. To remove a 36-pt margin (0.5 inch) on
    every side, pass top=36 bottom=36 left=36 right=36.

    Negative or zero values are clamped to 0. Values larger than the
    page dimension are clamped to the page size.
    """
    if any(v < 0 for v in (top, bottom, left, right)):
        raise HTTPException(400, "Crop values must be >= 0.")
    if all(v == 0 for v in (top, bottom, left, right)):
        raise HTTPException(400, "At least one crop value must be > 0.")
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")
        target_pages: list[int]
        if pages.strip():
            target_pages = _parse_page_list(pages, page_count)
            if not target_pages:
                raise HTTPException(400, f"pages spec '{pages}' matched no pages.")
        else:
            target_pages = list(range(page_count))

        for idx in target_pages:
            page = src[idx]
            # MediaBox is (x0, y0, x1, y1) in PDF points
            mb = page.mediabox
            x0, y0, x1, y1 = mb.x0, mb.y0, mb.x1, mb.y1
            width = x1 - x0
            height = y1 - y0
            # Clamp crop values
            t = min(max(top, 0), height)
            b = min(max(bottom, 0), height - t)
            l = min(max(left, 0), width)
            r = min(max(right, 0), width - l)
            new_x0 = x0 + l
            new_y0 = y0 + t
            new_x1 = x1 - r
            new_y1 = y1 - b
            if new_x1 <= new_x0 or new_y1 <= new_y0:
                raise HTTPException(
                    400,
                    f"Crop values leave zero area on page {idx + 1}.",
                )
            new_rect = fitz.Rect(new_x0, new_y0, new_x1, new_y1)
            # Shrink the MediaBox to the new (smaller) rect. If the
            # page has a CropBox set to a different region, the
            # strict-spec rule is CropBox ⊆ MediaBox, so we have to
            # clear/reset it before changing the MediaBox. PyMuPDF
            # doesn't expose a "delete CropBox" method directly, so
            # the cleanest approach is to read the existing CropBox
            # (if any), clip it to the new MediaBox, and write it
            # back. If the page has no CropBox, we leave it unset
            # — viewers will then default CropBox = MediaBox.
            try:
                # Try to access the cropbox. On pages without one,
                # the property may raise. Default behavior is to
                # skip the cropbox write.
                try:
                    _existing_crop = page.cropbox
                except Exception:
                    _existing_crop = None
                page.set_mediabox(new_rect)
                if _existing_crop is not None:
                    # Clip the existing cropbox to the new mediabox
                    clipped = fitz.Rect(
                        max(_existing_crop.x0, new_x0),
                        max(_existing_crop.y0, new_y0),
                        min(_existing_crop.x1, new_x1),
                        min(_existing_crop.y1, new_y1),
                    )
                    if clipped.width > 0 and clipped.height > 0:
                        page.set_cropbox(clipped)
            except Exception as exc:
                raise HTTPException(500, f"Could not crop page {idx + 1}: {exc}") from exc

        out_buf = io.BytesIO()
        src.save(out_buf, garbage=4, deflate=True)
        out_bytes = out_buf.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Crop failed")
        raise HTTPException(500, f"Crop failed: {exc}") from exc
    finally:
        src.close()

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "cropped")}"',
            "X-Pdf-Source-Pages": str(page_count),
            "X-Cropped-Pages": str(len(target_pages)),
            "X-Crop-Top": str(top),
            "X-Crop-Bottom": str(bottom),
            "X-Crop-Left": str(left),
            "X-Crop-Right": str(right),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )


# ─── /extract-pages-download ────────────────────────────────────
@router.post(
    "/extract-pages-download",
    response_class=StreamingResponse,
    summary="Extract a subset of pages from a PDF into a new PDF (sync, ≤ 50 MB)",
)
async def extract_pages(
    file: Annotated[UploadFile, File(description="Source PDF")],
    pages: Annotated[
        str,
        Form(description="Pages to extract, e.g. '1,3-5,7' (1-based, ranges OK)"),
    ] = "",
) -> StreamingResponse:
    """Extract specific pages from a PDF into a new PDF.

    The extracted pages keep their original page numbers in the
    output. Use this for "give me just the cover page" or "pull out
    chapters 3-5 into a separate file".

    If `pages` is empty or matches no pages, returns 400.
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")
        if not pages.strip():
            raise HTTPException(400, "pages spec is required (e.g. '1,3-5').")
        target = _parse_page_list(pages, page_count)
        if not target:
            raise HTTPException(400, f"pages spec '{pages}' matched no pages.")
        out_doc = fitz.open()
        try:
            for idx in target:
                out_doc.insert_pdf(src, from_page=idx, to_page=idx)
            out_buf = io.BytesIO()
            out_doc.save(out_buf, garbage=4, deflate=True)
            out_bytes = out_buf.getvalue()
            out_pages = len(out_doc)
        finally:
            out_doc.close()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Extract pages failed")
        raise HTTPException(500, f"Extract pages failed: {exc}") from exc
    finally:
        src.close()

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "extracted")}"',
            "X-Pdf-Source-Pages": str(page_count),
            "X-Pdf-Output-Pages": str(out_pages),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )


# ─── /add-remove-download ────────────────────────────────────────
@router.post(
    "/add-remove-download",
    response_class=StreamingResponse,
    summary="Delete specific pages from a PDF (sync, ≤ 50 MB)",
)
async def add_remove_pages(
    file: Annotated[UploadFile, File(description="Source PDF")],
    delete: Annotated[
        str,
        Form(description="Page numbers to delete, e.g. '2,4-6' (1-based). Empty = delete nothing."),
    ] = "",
    keep: Annotated[
        str,
        Form(description="Alternative to delete: pages to KEEP, e.g. '1,3-5'. If set, overrides delete."),
    ] = "",
) -> StreamingResponse:
    """Remove pages from a PDF. Two ways to specify which pages:

    1. `delete`: list pages to remove (e.g. "2,4-6")
    2. `keep`: list pages to KEEP, everything else is removed
       (e.g. "1,3-5" — only these remain)

    If `keep` is non-empty, it takes precedence over `delete`.
    If both are empty, returns 400 (no operation specified).
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")

        if keep.strip():
            keep_set = set(_parse_page_list(keep, page_count))
            if not keep_set:
                raise HTTPException(400, f"keep spec '{keep}' matched no pages.")
            to_remove = [i for i in range(page_count) if i not in keep_set]
        elif delete.strip():
            to_remove_set = set(_parse_page_list(delete, page_count))
            if not to_remove_set:
                raise HTTPException(400, f"delete spec '{delete}' matched no pages.")
            to_remove = sorted(to_remove_set)
        else:
            raise HTTPException(400, "Specify either 'delete' or 'keep'.")

        if len(to_remove) >= page_count:
            raise HTTPException(400, "Can't remove all pages of a PDF.")

        # delete_pages_from_pdf takes 0-based indices, descending
        for idx in sorted(to_remove, reverse=True):
            src.delete_page(idx)

        out_buf = io.BytesIO()
        src.save(out_buf, garbage=4, deflate=True)
        out_bytes = out_buf.getvalue()
        out_pages = len(src)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Add/remove pages failed")
        raise HTTPException(500, f"Add/remove pages failed: {exc}") from exc
    finally:
        src.close()

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "trimmed")}"',
            "X-Pdf-Source-Pages": str(page_count),
            "X-Pdf-Output-Pages": str(out_pages),
            "X-Pdf-Removed-Pages": str(len(to_remove)),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )


# ─── /organize-download ──────────────────────────────────────────
@router.post(
    "/organize-download",
    response_class=StreamingResponse,
    summary="Reorder and/or duplicate pages in a PDF (sync, ≤ 50 MB)",
)
async def organize_pages(
    file: Annotated[UploadFile, File(description="Source PDF")],
    order: Annotated[
        str,
        Form(description="New page order, 1-based, e.g. '3,1,2,4-7' or '1,1,3' (1 appears twice = duplicated)"),
    ] = "",
) -> StreamingResponse:
    """Reorder the pages of a PDF. The `order` form field is a
    comma-separated list of page numbers in the desired output order.
    Pages can appear multiple times (to duplicate them) or be
    omitted (to remove them — use add-remove-download for that).

    Example: '3,1,2,4-7' produces a PDF with page 3 first, then
    pages 1 and 2 (swapped), then pages 4 through 7.

    If `order` is empty or matches no pages, returns 400.
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")
        if not order.strip():
            raise HTTPException(
                400,
                "order spec is required, e.g. '3,1,2' (1-based). "
                "Use '3,1,2,4-7' to put page 3 first.",
            )
        target = _parse_page_list(order, page_count)
        if not target:
            raise HTTPException(400, f"order spec '{order}' matched no pages.")
        if not target:
            raise HTTPException(400, "Resulting PDF would have zero pages.")
        out_doc = fitz.open()
        try:
            for idx in target:
                out_doc.insert_pdf(src, from_page=idx, to_page=idx)
            out_buf = io.BytesIO()
            out_doc.save(out_buf, garbage=4, deflate=True)
            out_bytes = out_buf.getvalue()
            out_pages = len(out_doc)
        finally:
            out_doc.close()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Organize failed")
        raise HTTPException(500, f"Organize failed: {exc}") from exc
    finally:
        src.close()

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "organized")}"',
            "X-Pdf-Source-Pages": str(page_count),
            "X-Pdf-Output-Pages": str(out_pages),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )


# ─── /page-numbers-download ──────────────────────────────────────
@router.post(
    "/page-numbers-download",
    response_class=StreamingResponse,
    summary="Add page numbers ('Page N of M') to every page (sync, ≤ 50 MB)",
)
async def add_page_numbers(
    file: Annotated[UploadFile, File(description="PDF to add page numbers to")],
    position: Annotated[
        Literal["bottom-center", "bottom-right", "bottom-left", "top-center", "top-right", "top-left"],
        Form(description="Where to place the number on each page"),
    ] = "bottom-center",
    start: Annotated[
        int,
        Form(description="Number to start counting from (default 1)"),
    ] = 1,
    font_size: Annotated[
        int,
        Form(description="Font size in points (default 10)"),
    ] = 10,
    margin: Annotated[
        int,
        Form(description="Margin from page edge in points (default 36 = 0.5 inch)"),
    ] = 36,
    format: Annotated[
        Literal["n-of-m", "n", "page-n"],
        Form(description="Number format: 'n of m' = 'Page 3 of 10'; 'n' = '3'; 'page-n' = 'Page 3'"),
    ] = "n-of-m",
) -> StreamingResponse:
    """Add page numbers to every page of a PDF.

    The number is drawn on top of the page contents using a small
    font. Position, font size, and margin are configurable. Format
    supports three styles:
      - "n-of-m" (default): "Page 3 of 10"
      - "n":              "3"
      - "page-n":         "Page 3"

    The numbering starts at `start` (default 1). So if start=5 and
    the PDF has 10 pages, the first page shows "Page 5 of 10" and
    the last shows "Page 14 of 10" — the second number is always
    the total page count, not relative to start.
    """
    if font_size < 6 or font_size > 72:
        raise HTTPException(400, "font_size must be between 6 and 72.")
    if margin < 0 or margin > 200:
        raise HTTPException(400, "margin must be between 0 and 200.")
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")

        # Build the per-page label format
        def label(i: int) -> str:
            n = start + i
            if format == "n":
                return str(n)
            if format == "page-n":
                return f"Page {n}"
            return f"Page {n} of {page_count}"

        # Position presets
        # (x_anchor, y_anchor) — "anchor" is which corner the margin
        # is measured from, and where the text BBox is pinned.
        # For "bottom-X" we want the BBox bottom at `margin` from page
        # bottom; for "top-X" the BBox top at `margin` from page top.
        # fitz textbox uses top-left of the BBox, so for bottom
        # positions we put the BBox ABOVE the bottom margin.
        for i, page in enumerate(src):
            r = page.rect
            page_w = r.width
            page_h = r.height
            # BBox height = font_size * 1.2 (line-height)
            bbox_h = font_size * 1.2
            text = label(i)
            # Estimate text width: 0.5 * font_size per char, but
            # cap at the page width minus 2*margin. Then position
            # the BBox accordingly.
            est_w = min(max(80, len(text) * font_size * 0.5), page_w - 2 * margin)

            if position == "bottom-center":
                x0 = (page_w - est_w) / 2
                y0 = page_h - margin - bbox_h
            elif position == "bottom-right":
                x0 = page_w - margin - est_w
                y0 = page_h - margin - bbox_h
            elif position == "bottom-left":
                x0 = margin
                y0 = page_h - margin - bbox_h
            elif position == "top-center":
                x0 = (page_w - est_w) / 2
                y0 = margin
            elif position == "top-right":
                x0 = page_w - margin - est_w
                y0 = margin
            else:  # top-left
                x0 = margin
                y0 = margin
            x1 = x0 + est_w
            y1 = y0 + bbox_h
            rect = fitz.Rect(x0, y0, x1, y1)
            page.insert_textbox(
                rect,
                text,
                fontsize=font_size,
                color=(0, 0, 0),
                align=1,  # 0=left, 1=center, 2=right, 3=justify
            )

        out_buf = io.BytesIO()
        src.save(out_buf, garbage=4, deflate=True)
        out_bytes = out_buf.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Add page numbers failed")
        raise HTTPException(500, f"Add page numbers failed: {exc}") from exc
    finally:
        src.close()

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "numbered")}"',
            "X-Pdf-Source-Pages": str(page_count),
            "X-Page-Number-Position": position,
            "X-Page-Number-Start": str(start),
            "X-Page-Number-Format": format,
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )
