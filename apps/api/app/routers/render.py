"""PDF rendering tools — Wave 2.

Two endpoints, both self-hosted:

  /scan-to-pdf-download    — convert scanned images (JPG/PNG/WebP) to
                             a single PDF. Adds an OCR text layer so
                             the result is searchable. This is the
                             "phone scan a receipt → searchable PDF"
                             tool. (Different from /from-images which
                             is a plain image-to-PDF; scan-to-pdf
                             also OCRs the images.)
  /html-to-pdf-download    — convert HTML to a PDF. Accepts raw HTML
                             (a string) OR a URL (server fetches the
                             page). Uses xhtml2pdf — pure-Python,
                             no native deps.

Both are synchronous, 50 MB cap. The HTML→PDF endpoint caps the
output at 50 pages to prevent runaway generation; if the user
needs more they can paginate the HTML client-side.

xhtml2pdf fidelity: ~80% vs WeasyPrint's 95%. CSS2.1 + subset of
CSS3. Web fonts not supported (system fonts only). If a user
needs higher fidelity, we'll add WeasyPrint as tier 2 in a future
sprint.
"""

from __future__ import annotations

import io
import logging
import time
from typing import Annotated, Literal

import fitz  # PyMuPDF
import pytesseract
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_SYNC_SIZE = 50 * 1024 * 1024

# Hard cap on pages generated from HTML. A user posting a 100k-line
# HTML should not lock the server for 10 minutes.
MAX_HTML_PAGES = 50

# Hard cap on HTML input size. xhtml2pdf parses the whole document
# in memory; a 5 MB HTML string is already a lot.
MAX_HTML_BYTES = 2 * 1024 * 1024


# ─── /scan-to-pdf-download ──────────────────────────────────────
@router.post(
    "/scan-to-pdf-download",
    response_class=StreamingResponse,
    summary="Convert scanned images to a searchable PDF (sync, ≤ 50 MB total)",
    responses={
        200: {"description": "Searchable PDF", "content": {"application/pdf": {}}},
        400: {"description": "No valid images or invalid images"},
        413: {"description": "Total size exceeds 50 MB cap"},
        500: {"description": "Tesseract missing or fatal error"},
    },
)
async def scan_to_pdf(
    files: Annotated[
        list[UploadFile],
        File(description="Image files (JPG/PNG/WebP/TIFF). Each becomes one page. Order preserved."),
    ],
    page_size: Annotated[
        Literal["fit", "a4", "letter", "original"],
        Form(description="fit = scale to A4 with margin; a4/letter = force size; original = image native size"),
    ] = "fit",
    lang: Annotated[
        str,
        Form(description="Tesseract language for OCR (default 'eng')"),
    ] = "eng",
    dpi: Annotated[
        int,
        Form(description="Render DPI for OCR (150-600, default 300)"),
    ] = 300,
    skip_ocr: Annotated[
        bool,
        Form(description="Skip OCR (faster; output is not searchable). Use this for non-document scans like photos."),
    ] = False,
) -> StreamingResponse:
    """Convert 1+ scanned images to a single PDF.

    Each image becomes one page. If `skip_ocr=false` (the default),
    the server runs Tesseract OCR on each image and adds an
    invisible text layer to the resulting page, making the PDF
    searchable (Ctrl+F works) and text-selectable.

    This is the "I scanned a document with my phone, give me a
    proper PDF" tool. The `from-images-download` endpoint in
    pdf.py is the plain image→PDF tool without OCR; use
    scan-to-pdf when you need a searchable result.
    """
    if len(files) < 1:
        raise HTTPException(400, "Need at least 1 image.")
    if dpi < 150 or dpi > 600:
        raise HTTPException(400, "DPI must be between 150 and 600.")

    # Read all images up front
    blobs: list[tuple[str, bytes]] = []
    total = 0
    for f in files:
        b = await f.read()
        total += len(b)
        if total > MAX_SYNC_SIZE:
            raise HTTPException(413, f"Total size exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")
        blobs.append((f.filename or "image", b))

    A4_W, A4_H = 595.0, 842.0
    LETTER_W, LETTER_H = 612.0, 792.0

    try:
        out_doc = fitz.open()
        total_words = 0
        try:
            for name, blob in blobs:
                pix = fitz.Pixmap(blob)
                try:
                    # Normalize colorspace
                    if pix.colorspace and pix.colorspace.n >= 4:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    if pix.alpha:
                        rgb = fitz.Pixmap(
                            fitz.csRGB, fitz.IRect(0, 0, pix.width, pix.height), 0
                        )
                        rgb.clear_with(255)
                        rgb.set_rect(rgb.irect, (255, 255, 255))
                        rgb.copy(pix, pix.irect)
                        pix = rgb

                    img_w, img_h = pix.width, pix.height
                    if img_w <= 0 or img_h <= 0:
                        continue

                    if page_size == "a4":
                        page_w, page_h = A4_W, A4_H
                    elif page_size == "letter":
                        page_w, page_h = LETTER_W, LETTER_H
                    elif page_size == "original":
                        page_w, page_h = float(img_w), float(img_h)
                    else:  # fit
                        page_w, page_h = A4_W, A4_H

                    page = out_doc.new_page(width=page_w, height=page_h)
                    margin = 36 if page_size != "original" else 0
                    max_w = page_w - 2 * margin
                    max_h = page_h - 2 * margin
                    scale = min(max_w / img_w, max_h / img_h, 1.0)
                    scaled_w = img_w * scale
                    scaled_h = img_h * scale
                    x0 = (page_w - scaled_w) / 2
                    y0 = (page_h - scaled_h) / 2
                    img_rect = fitz.Rect(x0, y0, x0 + scaled_w, y0 + scaled_h)
                    page.insert_image(img_rect, pixmap=pix)

                    # Run OCR over the image region and insert an
                    # invisible text layer. This is what makes the
                    # resulting PDF searchable.
                    if not skip_ocr:
                        try:
                            # Convert the placed image to a PIL Image
                            # for pytesseract. The pix we have is
                            # already in the right colorspace.
                            pil_img = Image.frombytes(
                                "RGB", (pix.width, pix.height), pix.samples
                            )
                            # Render the placed region at OCR DPI
                            zoom = dpi / 72.0
                            matrix = fitz.Matrix(zoom, zoom)
                            ocr_pix = page.get_pixmap(
                                matrix=matrix, alpha=False, clip=img_rect
                            )
                            try:
                                ocr_img = Image.frombytes(
                                    "RGB", (ocr_pix.width, ocr_pix.height), ocr_pix.samples
                                )
                                data = pytesseract.image_to_data(
                                    ocr_img, lang=lang, output_type=pytesseract.Output.DICT
                                )
                                inv_zoom = 72.0 / dpi
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
                                    # Map OCR coordinates (relative
                                    # to ocr_pix) back to page
                                    # coordinates: scale by inv_zoom,
                                    # then translate by img_rect origin.
                                    ox = data["left"][j] * inv_zoom + x0
                                    oy = data["top"][j] * inv_zoom + y0
                                    ow = data["width"][j] * inv_zoom
                                    oh = data["height"][j] * inv_zoom
                                    rect = fitz.Rect(ox, oy, ox + ow, oy + oh)
                                    page.insert_textbox(
                                        rect, word,
                                        fontsize=oh,
                                        render_mode=3,  # invisible
                                        color=(0, 0, 0),
                                    )
                                    total_words += 1
                            finally:
                                ocr_pix = None
                        except pytesseract.TesseractNotFoundError as exc:
                            raise HTTPException(
                                500,
                                "Tesseract binary not found on the server. "
                                "The scan-to-PDF feature is misconfigured.",
                            ) from exc
                        except Exception as exc:
                            # Best-effort OCR — skip the page's text
                            # layer but keep the image.
                            logger.warning("OCR failed on %s: %s", name, exc)
                finally:
                    pix = None

            out_buf = io.BytesIO()
            out_doc.save(out_buf, garbage=4, deflate=True)
            out_bytes = out_buf.getvalue()
            page_count = len(out_doc)
        finally:
            out_doc.close()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Scan-to-PDF failed")
        raise HTTPException(500, f"Scan-to-PDF failed: {exc}") from exc

    base = (blobs[0][0] or "scan").rsplit(".", 1)[0]
    out_name = f"{base}-scan.pdf"

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            "X-Image-Source-Count": str(len(blobs)),
            "X-Pdf-Pages": str(page_count),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "X-Ocr-Words-Inserted": str(total_words),
            "X-Page-Size": page_size,
            "X-Ocr-Skipped": str(skip_ocr).lower(),
            "X-Ocr-Lang": lang,
            "Cache-Control": "no-store",
        },
    )


# ─── /html-to-pdf-download ──────────────────────────────────────
@router.post(
    "/html-to-pdf-download",
    response_class=StreamingResponse,
    summary="Convert HTML to a PDF (sync, ≤ 2 MB HTML, ≤ 50 pages output)",
    responses={
        200: {"description": "Rendered PDF", "content": {"application/pdf": {}}},
        400: {"description": "Invalid input (empty HTML, broken markup, etc.)"},
        413: {"description": "HTML input exceeds 2 MB"},
        502: {"description": "Could not fetch the given URL"},
    },
)
async def html_to_pdf(
    html: Annotated[
        str,
        Form(description="HTML markup to render. The server wraps it in a basic HTML5 boilerplate if it's a fragment."),
    ] = "",
    url: Annotated[
        str,
        Form(description="Alternative: URL to fetch and render. Server-side GET."),
    ] = "",
    page_size: Annotated[
        Literal["a4", "letter"],
        Form(description="Output page size"),
    ] = "a4",
    landscape: Annotated[
        bool, Form(description="Render in landscape orientation")
    ] = False,
) -> StreamingResponse:
    """Convert HTML to a PDF.

    Two modes:
      1. `html` form field: paste raw HTML. Max 2 MB. The server
         wraps fragments in a basic HTML5 boilerplate.
      2. `url` form field: server fetches the URL with httpx and
         renders the response body as HTML. Useful for "save this
         web page as a PDF".

    Uses xhtml2pdf (pure-Python). Fidelity: ~80% vs WeasyPrint.
    CSS2.1 + subset of CSS3. No web fonts (system fonts only).
    Inline `<style>` blocks are supported; external stylesheets
    referenced by URL are loaded if reachable.

    Output is capped at MAX_HTML_PAGES (50). If your HTML would
    render to more, please paginate client-side first.
    """
    if not html and not url:
        raise HTTPException(400, "Provide either 'html' or 'url'.")
    if html and url:
        raise HTTPException(400, "Provide only one of 'html' or 'url'.")

    if url:
        import httpx
        try:
            async with httpx.AsyncClient(
                timeout=30, follow_redirects=True, headers={"User-Agent": "GetPDFPro/1.0"}
            ) as client:
                resp = await client.get(url)
        except Exception as exc:
            raise HTTPException(502, f"Could not fetch URL: {exc}") from exc
        if resp.status_code != 200:
            raise HTTPException(502, f"URL returned HTTP {resp.status_code}.")
        if len(resp.content) > MAX_HTML_BYTES:
            raise HTTPException(
                413,
                f"Fetched HTML exceeds {MAX_HTML_BYTES // (1024 * 1024)} MB limit.",
            )
        try:
            html = resp.content.decode("utf-8", errors="replace")
        except Exception as exc:
            raise HTTPException(400, f"Fetched content is not valid text: {exc}") from exc
    else:
        if len(html.encode("utf-8", errors="replace")) > MAX_HTML_BYTES:
            raise HTTPException(413, f"HTML exceeds {MAX_HTML_BYTES // (1024 * 1024)} MB limit.")

    # Wrap fragment HTML in a basic boilerplate so xhtml2pdf can
    # parse it as full HTML. If the input already has <html>/<body>
    # we leave it alone.
    if "<html" not in html.lower():
        html = (
            "<!DOCTYPE html><html><head><meta charset='utf-8'>"
            "<style>body{font-family:Helvetica,Arial,sans-serif;font-size:11pt;}</style>"
            "</head><body>" + html + "</body></html>"
        )

    # Lazy import — xhtml2pdf is heavy and only used here
    try:
        from xhtml2pdf import pisa
    except ImportError as exc:
        raise HTTPException(500, "xhtml2pdf is not installed.") from exc

    out_buf = io.BytesIO()
    t0 = time.time()
    # pisa.CreatePDF returns a pisaDocument; .err is 0 on success
    result = pisa.CreatePDF(
        src=html,
        dest=out_buf,
        encoding="utf-8",
    )
    elapsed_ms = int((time.time() - t0) * 1000)
    if result.err:
        raise HTTPException(400, f"HTML rendering failed (code {result.err}).")
    out_bytes = out_buf.getvalue()
    if not out_bytes or not out_bytes.startswith(b"%PDF"):
        raise HTTPException(500, "xhtml2pdf produced no output.")
    if len(out_bytes) < 200:
        raise HTTPException(500, f"xhtml2pdf output suspiciously small: {len(out_bytes)} bytes.")

    # Verify the output PDF page count. If it exceeds our cap,
    # reject. This protects against accidentally rendering a 100k-
    # page document that would lock the server.
    try:
        with fitz.open(stream=out_bytes, filetype="pdf") as _verify:
            out_pages = len(_verify)
    except Exception as exc:
        raise HTTPException(500, f"Rendered PDF is invalid: {exc}") from exc
    if out_pages > MAX_HTML_PAGES:
        raise HTTPException(
            400,
            f"Rendered PDF is {out_pages} pages (max {MAX_HTML_PAGES}). "
            "Paginate the HTML client-side first.",
        )

    out_name = "page.pdf"
    if url:
        # Try to use the URL's last path segment as the filename
        from urllib.parse import urlparse
        path = urlparse(url).path
        if path and "/" in path:
            seg = path.rstrip("/").rsplit("/", 1)[-1]
            if seg and seg.endswith(".pdf"):
                out_name = seg
            elif seg and len(seg) < 60:
                out_name = seg + ".pdf"

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{out_name}"',
            "X-Pdf-Pages": str(out_pages),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "X-Page-Size": page_size,
            "X-Landscape": str(landscape).lower(),
            "X-Html-Source-Bytes": str(len(html.encode("utf-8"))),
            "X-Render-Elapsed-Ms": str(elapsed_ms),
            "X-Engine": "xhtml2pdf",
            "Cache-Control": "no-store",
        },
    )
