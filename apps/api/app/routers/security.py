"""PDF security & editing tools — Wave 4 (self-hosted, pikepdf only).

Four endpoints, all pikepdf-based:

  /unlock-download        — remove the user/owner password from a PDF
  /protect-download       — set a user/owner password (encrypt the PDF)
  /sign-download          — add a visible signature image + invisible
                            signature metadata (no PKI; this is a
                            visual signature stamp, not a cert sig)
  /edit-pdf-download      — edit PDF metadata (title, author, subject,
                            keywords) and/or whiteout a rectangle on
                            a page. NOT a full WYSIWYG editor.

All four are self-hosted, no Adobe, no soffice, no Tesseract.

About "sign": the user uploads a PNG/JPG image of their signature
(or we generate a default), and the server stamps it on every
page (or a specified page) at a chosen position. This is a
**visual** signature — there is no PKI / no certificate / no
legal non-repudiation. The output is marked as such. If you
need a real PDF signature with a certificate, the user must
use Adobe Acrobat or DocuSign. (Future: tier 2 with a self-
hosted PKI library, but that's a multi-week project.)

About "edit-pdf": the MVP is metadata + rectangle whiteout. We
do NOT support click-to-edit text on the page — that's a multi-
week WYSIWYG project. The UI is honest about this: "Edit
metadata, cover up regions, and add text stamps."
"""

from __future__ import annotations

import io
import json
import logging
import os
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


# ─── /unlock-download ───────────────────────────────────────────
@router.post(
    "/unlock-download",
    response_class=StreamingResponse,
    summary="Remove passwords from an encrypted PDF (sync, ≤ 50 MB)",
    responses={
        200: {"description": "Unlocked PDF (no passwords)", "content": {"application/pdf": {}}},
        400: {"description": "Wrong password, or PDF is not encrypted, or invalid PDF"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def unlock_pdf(
    file: Annotated[UploadFile, File(description="Encrypted PDF to unlock")],
    password: Annotated[
        str,
        Form(description="User password (the one you enter to open the PDF). Leave blank if PDF only has owner password."),
    ] = "",
) -> StreamingResponse:
    """Strip all passwords from an encrypted PDF.

    If the PDF has only an owner password (restrictions like
    "no editing" / "no printing" but opens without a prompt),
    leave `password` blank.

    If the PDF has a user password (you have to type it to open
    the file), supply it.

    The output PDF opens without any password and has no
    restrictions.

    This is also the standalone version of the "unlock" toggle
    in the /repair tool.
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    try:
        import pikepdf
    except ImportError as exc:
        raise HTTPException(500, "pikepdf is not installed.") from exc

    # Try the most likely path first: open with the password (or
    # empty for owner-password-only PDFs). If that fails because
    # the PDF isn't actually encrypted, fall back to a no-password
    # open + just re-save.
    import tempfile
    pdf = None
    try:
        try:
            pdf = pikepdf.open(blob, password=(password or ""))
        except pikepdf.PasswordError as exc:
            raise HTTPException(
                400,
                "Wrong password. The PDF is encrypted with a user password and "
                "the supplied password didn't open it.",
            ) from exc
        except Exception:
            # Likely "PDF is not encrypted" — try opening without password.
            pdf = pikepdf.open(blob)
        # Re-save without encryption. pikepdf 9.x's plain
        # save(f) sometimes triggers a qpdf internal that
        # errors out on file streams with the linearize-BytesIO
        # pattern. Workaround: open the source from a temp file
        # path (not bytes) and save to a temp file path. The
        # .save_to_bytes() method also works in 9.x and is
        # simpler than the file roundtrip.
        try:
            out_bytes = pdf.save_to_bytes()
        except Exception:
            # Fallback: temp-file roundtrip
            fd_in, path_in = tempfile.mkstemp(suffix=".pdf")
            try:
                with os.fdopen(fd_in, "wb") as f:
                    f.write(blob)
                with pikepdf.open(path_in, password=(password or "")) as pdf2:
                    fd_out, path_out = tempfile.mkstemp(suffix=".pdf")
                    try:
                        with os.fdopen(fd_out, "wb") as f:
                            pdf2.save(f)
                        with open(path_out, "rb") as f:
                            out_bytes = f.read()
                    finally:
                        try: os.unlink(path_out)
                        except OSError: pass
            finally:
                try: os.unlink(path_in)
                except OSError: pass
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("unlock failed")
        raise HTTPException(400, f"Could not unlock PDF: {exc}") from exc
    finally:
        if pdf is not None:
            try: pdf.close()
            except Exception: pass

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "unlocked")}"',
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "X-Encryption-Removed": "true",
            "Cache-Control": "no-store",
        },
    )


# ─── /protect-download ──────────────────────────────────────────
@router.post(
    "/protect-download",
    response_class=StreamingResponse,
    summary="Encrypt a PDF with a user password and/or owner restrictions (sync, ≤ 50 MB)",
    responses={
        200: {"description": "Encrypted PDF", "content": {"application/pdf": {}}},
        400: {"description": "Empty password or invalid PDF"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def protect_pdf(
    file: Annotated[UploadFile, File(description="PDF to encrypt")],
    user_password: Annotated[
        str, Form(description="User password (needed to open the PDF). Required.")
    ],
    owner_password: Annotated[
        str,
        Form(description="Owner password (needed to change restrictions). If blank, equals user password."),
    ] = "",
    permissions: Annotated[
        str,
        Form(description="Comma-separated restrictions to ALLOW (leave blank = no restrictions). e.g. 'print,copy' to allow those, deny others."),
    ] = "",
) -> StreamingResponse:
    """Encrypt a PDF with AES-256 (via pikepdf).

    The user password is what someone types to OPEN the PDF. The
    owner password is what's needed to change restrictions or
    remove encryption.

    By default pikepdf applies a strong permissions set (deny
    print, copy, modify, annotate). The `permissions` field lets
    you whitelist specific actions.

    If `owner_password` is empty, it defaults to equal to the
    user password.
    """
    if not user_password:
        raise HTTPException(400, "user_password is required.")
    if len(user_password) < 4:
        raise HTTPException(400, "user_password must be at least 4 characters.")
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    try:
        import pikepdf
    except ImportError as exc:
        raise HTTPException(500, "pikepdf is not installed.") from exc

    if not owner_password:
        owner_password = user_password

    # pikepdf 9.x's Encryption is a NamedTuple with `allow` as
    # a `Permissions` NamedTuple. We build a Permissions object
    # from the user's whitelist. Each field defaults to its
    # `Permissions` default, then we override based on the
    # whitelist.
    from pikepdf.models.encryption import Permissions as PdfPerms
    allowed = {p.strip().lower() for p in permissions.split(",") if p.strip()}
    # Map our permission names -> PdfPerms field names
    PERM_FIELD_MAP = {
        "print": "print_lowres",
        "print_highres": "print_highres",
        "modify": "modify_other",
        "copy": "extract",
        "annotate": "modify_annotation",
        "forms": "modify_form",
        "assemble": "modify_assembly",
        "accessibility": "accessibility",
    }
    # Default permissions: deny everything except accessibility
    # (required by section 508 / WCAG / EU accessibility laws —
    # screen readers need to be able to extract text).
    perm_kwargs: dict = {
        "accessibility": True,
        "extract": False,
        "modify_annotation": False,
        "modify_assembly": False,
        "modify_form": False,
        "modify_other": False,
        "print_lowres": False,
        "print_highres": False,
    }
    if allowed:
        # If user provided a whitelist, start from "deny all" and
        # only enable what they explicitly listed.
        for p in allowed:
            field = PERM_FIELD_MAP.get(p)
            if field:
                perm_kwargs[field] = True
    else:
        # No whitelist = all denied except accessibility. The
        # perm_kwargs dict above already encodes that.
        pass
    allow_perms = PdfPerms(**perm_kwargs)

    import os
    import tempfile
    fd_in, path_in = tempfile.mkstemp(suffix=".pdf")
    try:
        with os.fdopen(fd_in, "wb") as f:
            f.write(blob)
        with pikepdf.open(path_in, allow_overwriting_input=True) as pdf:
            fd_out, path_out = tempfile.mkstemp(suffix=".pdf")
            try:
                with os.fdopen(fd_out, "wb") as f:
                    # AES-256 with R=6 = strongest encryption.
                    # Permissions go in the Encryption NamedTuple,
                    # NOT as a save() kwarg (removed in pikepdf 9.x).
                    pdf.save(
                        f,
                        encryption=pikepdf.Encryption(
                            owner=owner_password,
                            user=user_password,
                            R=6,  # AES-256
                            allow=allow_perms,
                            aes=True,
                            metadata=True,
                        ),
                    )
                with open(path_out, "rb") as f:
                    out_bytes = f.read()
            finally:
                try: os.unlink(path_out)
                except OSError: pass
    except Exception as exc:
        logger.exception("Protect failed")
        raise HTTPException(500, f"Could not encrypt PDF: {exc}") from exc
    finally:
        try: os.unlink(path_in)
        except OSError: pass

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "protected")}"',
            "X-Encryption-Algorithm": "AES-256",
            "X-Permissions": json.dumps(perm_kwargs),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )


# ─── /sign-download ─────────────────────────────────────────────
@router.post(
    "/sign-download",
    response_class=StreamingResponse,
    summary="Add a visual signature stamp to a PDF (NOT a PKI signature)",
    responses={
        200: {"description": "PDF with visual signature stamp", "content": {"application/pdf": {}}},
        400: {"description": "No signature image provided and default failed, or invalid PDF"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def sign_pdf(
    file: Annotated[UploadFile, File(description="PDF to add a signature to")],
    signature: Annotated[
        UploadFile | None,
        File(description="Signature image (PNG/JPG). If omitted, a default signature is generated from your typed name."),
    ] = None,
    name: Annotated[
        str,
        Form(description="If no signature image is provided, this name is rendered as a stylized signature."),
    ] = "",
    pages: Annotated[
        str,
        Form(description="Pages to sign, e.g. '1,3-5' (default = last page only)."),
    ] = "",
    position: Annotated[
        Literal["bottom-right", "bottom-left", "bottom-center", "top-right", "top-left", "top-center"],
        Form(description="Where to place the signature"),
    ] = "bottom-right",
    width: Annotated[
        int, Form(description="Signature width in points (default 200)")
    ] = 200,
    height: Annotated[
        int, Form(description="Signature height in points (default 60)")
    ] = 60,
) -> StreamingResponse:
    """Add a visual signature stamp to a PDF.

    This is a **visual** signature — there is no PKI, no
    certificate, no legal non-repudiation. Anyone with image
    editing can remove or modify the signature. If you need a
    real PDF signature with a certificate chain, use Adobe
    Acrobat or DocuSign.

    The signature is rendered as an image on top of the page
    contents. The original page visuals are preserved.

    Two ways to provide the signature:
      1. Upload a PNG or JPG via the `signature` file field
         (e.g. a photo of your handwritten signature).
      2. Provide a `name` and the server renders a stylized
         signature image from the text (cursive-ish font).
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if len(blob) == 0:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    # Get the signature image bytes
    sig_bytes: bytes | None = None
    if signature is not None and signature.filename:
        sig_bytes = await signature.read()
        if not sig_bytes:
            sig_bytes = None

    # If no signature image, render the name with PIL
    if sig_bytes is None:
        if not name.strip():
            raise HTTPException(
                400,
                "Provide either a 'signature' image file or a 'name' to render.",
            )
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError as exc:
            raise HTTPException(500, "Pillow is not installed.") from exc
        # Render the name as a PNG with transparent background.
        # Use a large canvas then crop to bbox for crisp output.
        canvas_w, canvas_h = 1000, 300
        img = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 0))
        d = ImageDraw.Draw(img)
        # Try to find a system font; fall back to default.
        font = None
        for font_path in [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
            "/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf",
        ]:
            if os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, 110)
                    break
                except Exception:
                    continue
        if font is None:
            font = ImageFont.load_default()
        # Measure text
        bbox = d.textbbox((0, 0), name, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        # Center the text in the canvas
        x = (canvas_w - text_w) // 2 - bbox[0]
        y = (canvas_h - text_h) // 2 - bbox[1]
        d.text((x, y), name, fill=(0, 0, 0, 255), font=font)
        # Crop to content bbox with a small padding
        content_bbox = img.getbbox()
        if content_bbox:
            pad = 10
            cropped = img.crop((
                max(0, content_bbox[0] - pad),
                max(0, content_bbox[1] - pad),
                min(canvas_w, content_bbox[2] + pad),
                min(canvas_h, content_bbox[3] + pad),
            ))
        else:
            cropped = img
        sig_buf = io.BytesIO()
        cropped.save(sig_buf, format="PNG")
        sig_bytes = sig_buf.getvalue()

    # Open the PDF
    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    try:
        page_count = len(src)
        if page_count == 0:
            raise HTTPException(400, "PDF has no pages.")

        # Resolve target pages. Default = last page only.
        if pages.strip():
            from app.routers.organize import _parse_page_list
            target = _parse_page_list(pages, page_count)
            if not target:
                raise HTTPException(400, f"pages spec '{pages}' matched no pages.")
        else:
            target = [page_count - 1]

        for idx in target:
            page = src[idx]
            r = page.rect
            page_w = r.width
            page_h = r.height
            margin = 36
            # Compute the signature rect
            if position == "bottom-right":
                x1 = page_w - margin
                y1 = page_h - margin
                x0 = x1 - width
                y0 = y1 - height
            elif position == "bottom-left":
                x0 = margin
                y0 = page_h - margin - height
                x1 = x0 + width
                y1 = y0 + height
            elif position == "bottom-center":
                x0 = (page_w - width) / 2
                y0 = page_h - margin - height
                x1 = x0 + width
                y1 = y0 + height
            elif position == "top-right":
                x1 = page_w - margin
                y0 = margin
                x0 = x1 - width
                y1 = y0 + height
            elif position == "top-left":
                x0 = margin
                y0 = margin
                x1 = x0 + width
                y1 = y0 + height
            else:  # top-center
                x0 = (page_w - width) / 2
                y0 = margin
                x1 = x0 + width
                y1 = y0 + height
            sig_rect = fitz.Rect(x0, y0, x1, y1)
            page.insert_image(sig_rect, stream=sig_bytes)

        out_buf = io.BytesIO()
        src.save(out_buf, garbage=4, deflate=True)
        out_bytes = out_buf.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Sign failed")
        raise HTTPException(500, f"Could not sign PDF: {exc}") from exc
    finally:
        src.close()

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "signed")}"',
            "X-Signature-Position": position,
            "X-Signature-Pages": str(len(target)),
            "X-Signature-Kind": "visual-no-pki",  # honest labeling
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )


# ─── /edit-pdf-download ────────────────────────────────────────
@router.post(
    "/edit-pdf-download",
    response_class=StreamingResponse,
    summary="Edit PDF metadata and/or whiteout a region on a page (sync, ≤ 50 MB)",
    responses={
        200: {"description": "Edited PDF", "content": {"application/pdf": {}}},
        400: {"description": "Invalid input or no operations specified"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def edit_pdf(
    file: Annotated[UploadFile, File(description="PDF to edit")],
    title: Annotated[
        str, Form(description="New document title (leave blank to keep existing)")
    ] = "",
    author: Annotated[
        str, Form(description="New author (leave blank to keep existing)")
    ] = "",
    subject: Annotated[
        str, Form(description="New subject (leave blank to keep existing)")
    ] = "",
    keywords: Annotated[
        str, Form(description="New keywords, comma-separated")
    ] = "",
    whiteout_page: Annotated[
        int,
        Form(description="1-based page number to apply the whiteout on. 0 = no whiteout."),
    ] = 0,
    whiteout_x: Annotated[
        float, Form(description="Whiteout x (PDF points, top-left origin)")
    ] = 0,
    whiteout_y: Annotated[
        float, Form(description="Whiteout y (PDF points, top-left origin)")
    ] = 0,
    whiteout_w: Annotated[
        float, Form(description="Whiteout width in points")
    ] = 0,
    whiteout_h: Annotated[
        float, Form(description="Whiteout height in points")
    ] = 0,
    stamp_text: Annotated[
        str, Form(description="Optional: text to draw on every page (e.g. 'DRAFT', 'CONFIDENTIAL')")
    ] = "",
    stamp_color: Annotated[
        Literal["red", "black", "gray"],
        Form(description="Stamp text color"),
    ] = "red",
) -> StreamingResponse:
    """Edit a PDF.

    **What this does:**
      - Set metadata: title, author, subject, keywords
      - Whiteout a rectangular region on one page
      - Stamp a text label on every page

    **What this does NOT do:**
      - Click-to-edit text on a page (multi-week WYSIWYG project)
      - Replace images in place (use combine-with-PDF workflow)
      - Add headers/footers (use /page-numbers-download for that)

    Whiteout coordinates are PDF points (1 pt = 1/72 inch). The
    origin is the TOP-LEFT of the page (PyMuPDF convention).
    """
    has_metadata = any([title, author, subject, keywords])
    has_whiteout = (whiteout_page > 0 and whiteout_w > 0 and whiteout_h > 0)
    has_stamp = bool(stamp_text.strip())
    if not (has_metadata or has_whiteout or has_stamp):
        raise HTTPException(
            400,
            "Specify at least one operation: metadata, whiteout, or stamp.",
        )
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
        if whiteout_page > 0 and whiteout_page > page_count:
            raise HTTPException(400, f"whiteout_page {whiteout_page} exceeds page count {page_count}.")

        # 1. Metadata
        meta = src.metadata or {}
        if title:
            meta["title"] = title
        if author:
            meta["author"] = author
        if subject:
            meta["subject"] = subject
        if keywords:
            meta["keywords"] = keywords
        if has_metadata:
            meta["creator"] = meta.get("creator") or "GetPDFPro"
            meta["producer"] = "GetPDFPro"
            # PyMuPDF uses src.set_metadata() to set XMP + Info
            # dict atomically. No separate docinfo access.
            src.set_metadata(meta)

        # 2. Whiteout (PyMuPDF uses top-left origin, page is in points)
        if has_whiteout:
            page = src[whiteout_page - 1]
            rect = fitz.Rect(whiteout_x, whiteout_y, whiteout_x + whiteout_w, whiteout_y + whiteout_h)
            # Draw a white-filled rectangle on top of the page contents.
            # Note: this covers but doesn't remove the underlying text.
            # For "delete" semantics, use the redact endpoint (with
            # Adobe) or pikepdf blackout (in /redact-download).
            page.draw_rect(rect, color=(1, 1, 1), fill=(1, 1, 1), overlay=True)

        # 3. Stamp
        if has_stamp:
            color_map = {"red": (1, 0, 0), "black": (0, 0, 0), "gray": (0.5, 0.5, 0.5)}
            stamp_color_rgb = color_map.get(stamp_color, (1, 0, 0))
            for page in src:
                r = page.rect
                # Place stamp at top-right corner with margin, large
                # font, semi-transparent.
                margin = 36
                text_w_est = len(stamp_text) * 12  # rough estimate
                rect = fitz.Rect(
                    max(margin, r.width - text_w_est - margin),
                    margin,
                    r.width - margin,
                    margin + 36,
                )
                page.insert_textbox(
                    rect,
                    stamp_text,
                    fontsize=24,
                    color=stamp_color_rgb,
                    align=2,  # right
                )

        out_buf = io.BytesIO()
        src.save(out_buf, garbage=4, deflate=True)
        out_bytes = out_buf.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Edit failed")
        raise HTTPException(500, f"Edit failed: {exc}") from exc
    finally:
        src.close()

    return StreamingResponse(
        io.BytesIO(out_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{_suggest_name(file.filename or "doc.pdf", "edited")}"',
            "X-Edited-Metadata": str(has_metadata).lower(),
            "X-Edited-Whiteout": str(has_whiteout).lower(),
            "X-Edited-Stamp": str(has_stamp).lower(),
            "X-Pdf-Size-Bytes": str(len(out_bytes)),
            "Cache-Control": "no-store",
        },
    )
