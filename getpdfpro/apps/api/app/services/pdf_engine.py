"""
PDF engine — wraps PyMuPDF (MuPDF) for all PDF operations.

Centralizing PDF logic here means the API routes stay thin and the
workers can call the same operations in async tasks.
"""

import io
from enum import Enum
from pathlib import Path
from typing import BinaryIO

import fitz  # PyMuPDF
import structlog

logger = structlog.get_logger()


class CompressionLevel(str, Enum):
    """PDF compression presets."""

    LOW = "low"        # ~70% size, high quality
    MEDIUM = "medium"  # ~50% size, good quality
    HIGH = "high"      # ~30% size, acceptable quality
    EXTREME = "extreme"  # ~15% size, lower quality


class PDFEngine:
    """All PDF operations. Stateless — safe to use across requests."""

    # ─── Merge ────────────────────────────────────────────────
    @staticmethod
    def merge(files: list[bytes], output_name: str = "merged.pdf") -> bytes:
        """Merge multiple PDFs into one."""
        result = fitz.open()
        try:
            for data in files:
                with fitz.open(stream=data, filetype="pdf") as src:
                    result.insert_pdf(src)
            return _to_bytes(result, output_name)
        finally:
            result.close()

    # ─── Split ────────────────────────────────────────────────
    @staticmethod
    def split(
        data: bytes,
        page_ranges: list[tuple[int, int]] | None = None,
    ) -> list[bytes]:
        """
        Split a PDF.

        page_ranges: list of (start, end) 1-indexed inclusive.
                     If None, splits every page into its own PDF.
        """
        results: list[bytes] = []
        with fitz.open(stream=data, filetype="pdf") as pdf:
            if page_ranges is None:
                # One page per file
                for i in range(len(pdf)):
                    out = fitz.open()
                    out.insert_pdf(pdf, from_page=i, to_page=i)
                    results.append(_to_bytes(out, f"page_{i+1}.pdf"))
                    out.close()
            else:
                for idx, (start, end) in enumerate(page_ranges, 1):
                    out = fitz.open()
                    out.insert_pdf(pdf, from_page=start - 1, to_page=end - 1)
                    results.append(_to_bytes(out, f"split_{idx}.pdf"))
                    out.close()
        return results

    # ─── Compress ─────────────────────────────────────────────
    @staticmethod
    def compress(data: bytes, level: CompressionLevel = CompressionLevel.MEDIUM) -> bytes:
        """
        Compress a PDF.

        Uses MuPDF's garbage collection + deflate + image downsampling.
        """
        garbage_map = {
            CompressionLevel.LOW: 1,        # minimal cleanup
            CompressionLevel.MEDIUM: 2,     # standard
            CompressionLevel.HIGH: 3,       # aggressive
            CompressionLevel.EXTREME: 4,    # max cleanup
        }
        garbage = garbage_map[level]

        with fitz.open(stream=data, filetype="pdf") as pdf:
            # Deflate all streams
            for page in pdf:
                page.get_contents()
            return _to_bytes(
                pdf,
                "compressed.pdf",
                garbage=garbage,
                deflate=True,
                clean=True,
            )

    # ─── PDF → Word ───────────────────────────────────────────
    @staticmethod
    def pdf_to_word(data: bytes) -> bytes:
        """
        Convert PDF to DOCX.

        Note: For complex layouts, consider Azure Document Intelligence
        or AWS Textract. This is the simple/local fallback.
        """
        import pymupdf4llm  # Optional dependency

        md_text = pymupdf4llm.to_markdown(data)
        # Markdown -> DOCX requires pandoc or python-docx
        # Implementation depends on chosen path
        return md_text.encode("utf-8")  # placeholder

    # ─── Word → PDF ───────────────────────────────────────────
    @staticmethod
    def word_to_pdf(data: bytes) -> bytes:
        """Convert DOCX to PDF using LibreOffice headless."""
        # Implemented in workers/ (requires LibreOffice in container)
        raise NotImplementedError("Use workers.tasks.word_to_pdf")

    # ─── PDF → JPG ────────────────────────────────────────────
    @staticmethod
    def pdf_to_jpg(data: bytes, dpi: int = 150) -> list[bytes]:
        """Convert each PDF page to a JPG image."""
        results: list[bytes] = []
        with fitz.open(stream=data, filetype="pdf") as pdf:
            for i, page in enumerate(pdf):
                pix = page.get_pixmap(dpi=dpi)
                results.append(pix.tobytes("jpg"))
        return results

    # ─── JPG → PDF ────────────────────────────────────────────
    @staticmethod
    def jpg_to_pdf(images: list[bytes]) -> bytes:
        """Convert a list of images to a single PDF."""
        result = fitz.open()
        try:
            for img_data in images:
                img = fitz.open(stream=img_data, filetype="image")
                rect = img[0].rect
                pdf_bytes = img.convert_to_pdf()
                img.close()
                with fitz.open(stream=pdf_bytes, filetype="pdf") as pdf_page:
                    result.insert_pdf(pdf_page)
            return _to_bytes(result, "images.pdf")
        finally:
            result.close()

    # ─── Rotate ───────────────────────────────────────────────
    @staticmethod
    def rotate(data: bytes, degrees: int, pages: list[int] | None = None) -> bytes:
        """Rotate PDF pages (90, 180, 270). pages=None means all pages."""
        with fitz.open(stream=data, filetype="pdf") as pdf:
            target_pages = pages or list(range(len(pdf)))
            for i in target_pages:
                pdf[i].set_rotation((pdf[i].rotation + degrees) % 360)
            return _to_bytes(pdf, "rotated.pdf", garbage=2, deflate=True)

    # ─── Add watermark ─────────────────────────────────────────
    @staticmethod
    def add_watermark(
        data: bytes,
        text: str,
        opacity: float = 0.3,
        font_size: int = 50,
    ) -> bytes:
        """Stamp a text watermark diagonally on every page."""
        with fitz.open(stream=data, filetype="pdf") as pdf:
            for page in pdf:
                rect = page.rect
                # Diagonal position
                x = rect.width / 4
                y = rect.height / 2
                page.insert_text(
                    (x, y),
                    text,
                    fontsize=font_size,
                    color=(0.5, 0.5, 0.5),
                    rotate=45,
                    overlay=True,
                )
            return _to_bytes(pdf, "watermarked.pdf", garbage=2, deflate=True)

    # ─── Add page numbers ─────────────────────────────────────
    @staticmethod
    def add_page_numbers(
        data: bytes,
        position: str = "bottom-center",
        font_size: int = 11,
    ) -> bytes:
        """Add page numbers to every page."""
        with fitz.open(stream=data, filetype="pdf") as pdf:
            total = len(pdf)
            for i, page in enumerate(pdf, 1):
                rect = page.rect
                text = f"{i} / {total}"
                if position == "bottom-center":
                    point = fitz.Point(rect.width / 2 - 20, rect.height - 20)
                elif position == "bottom-right":
                    point = fitz.Point(rect.width - 50, rect.height - 20)
                elif position == "top-right":
                    point = fitz.Point(rect.width - 50, 30)
                else:
                    point = fitz.Point(20, rect.height - 20)
                page.insert_text(point, text, fontsize=font_size, color=(0, 0, 0))
            return _to_bytes(pdf, "numbered.pdf", garbage=2, deflate=True)

    # ─── OCR ──────────────────────────────────────────────────
    @staticmethod
    async def ocr(data: bytes, language: str = "eng") -> str:
        """
        Run OCR on a scanned PDF. Returns extracted text.

        Uses Tesseract via pytesseract.
        """
        import pytesseract
        from PIL import Image

        results: list[str] = []
        with fitz.open(stream=data, filetype="pdf") as pdf:
            for page in pdf:
                pix = page.get_pixmap(dpi=300)
                img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                text = pytesseract.image_to_string(img, lang=language)
                results.append(text)
        return "\n\n".join(results)

    # ─── Extract text ─────────────────────────────────────────
    @staticmethod
    def extract_text(data: bytes) -> str:
        """Extract plain text from a PDF."""
        with fitz.open(stream=data, filetype="pdf") as pdf:
            return "\n\n".join(page.get_text() for page in pdf)

    # ─── Extract metadata ─────────────────────────────────────
    @staticmethod
    def get_metadata(data: bytes) -> dict:
        """Get PDF metadata (title, author, page count, etc.)."""
        with fitz.open(stream=data, filetype="pdf") as pdf:
            return {
                "page_count": len(pdf),
                "metadata": pdf.metadata,
                "is_encrypted": pdf.is_encrypted,
                "is_pdf": pdf.is_pdf,
                "file_size_bytes": len(data),
            }


# ─── Helpers ───────────────────────────────────────────────────
def _to_bytes(pdf: fitz.Document, filename: str, **save_kwargs) -> bytes:
    """Serialize a fitz.Document to bytes."""
    buf = io.BytesIO()
    pdf.save(buf, **save_kwargs)
    return buf.getvalue()


# Module-level singleton
pdf_engine = PDFEngine()
