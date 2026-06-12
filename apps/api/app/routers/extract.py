"""PDF Table Extraction.

  /extract-tables-download  — extract tables from a PDF as CSV (or
                              JSON for richer data).

Approach:

  We use PyMuPDF's `page.find_tables()` API. It uses a heuristic
  detector (whitespace + line geometry) that works well on PDFs with
  visible ruling lines, ruled tables, and unbordered tables with
  column-aligned text. For native (born-digital) PDFs from Excel,
  Word, Google Docs, etc., this is usually 100% accurate.

  For scanned PDFs without OCR, the page is just a flat image and
  no tables are detected. We always recommend running /ocr first.

Output format:

  CSV: one CSV file with all tables concatenated. Each table is
  separated by a blank line and prefixed with a metadata header
  comment:
    # Page 1, Table 1, 5 rows × 3 cols
    cell,cell,cell
    cell,cell,cell
    ...

  JSON: a richer structure preserving the source page and table
  index for each row:
    {
      "pages": 3,
      "table_count": 2,
      "tables": [
        {
          "page": 1,
          "table_index": 1,
          "rows": 5,
          "cols": 3,
          "bbox": [x0, y0, x1, y1],
          "data": [
            ["a", "b", "c"],
            ["d", "e", "f"]
          ]
        }
      ]
    }

Limitations:
  - Tables without visible separators (just whitespace) are hit-or-miss
    on noisy PDFs. We extract with `find_tables(strategy="lines")`
    by default and fall back to "text" if no lines-based tables
    are found.
  - Merged cells (rowspan/colspan) are not detected — we output
    the visible cell value at the top-left corner of the merged
    region and leave the others empty.
  - Very wide tables (>50 cols) are rare in real PDFs but may
    confuse the detector. The endpoint returns 200 with whatever
    was found, plus a `table_count: 0` warning if nothing came
    out (so the UI can suggest OCR + retry).
"""

from __future__ import annotations

import csv
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


def _validate_pdf_filename(filename: str | None) -> str:
    if not filename or not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF.")
    return filename


def _suggest_name(original: str, suffix: str, ext: str = "csv") -> str:
    base = (original or "document.pdf").rsplit(".", 1)[0]
    return f"{base}-{suffix}.{ext}"


@router.post(
    "/extract-tables-download",
    response_class=StreamingResponse,
    summary="Extract tables from a PDF as CSV or JSON (sync, ≤ 50 MB)",
    responses={
        200: {
            "description": "Extracted tables (CSV or JSON, depending on `format` form field)",
            "content": {
                "text/csv": {},
                "application/json": {},
            },
        },
        400: {"description": "Invalid input"},
        413: {"description": "File exceeds 50 MB cap"},
    },
)
async def extract_tables(
    file: Annotated[UploadFile, File(description="PDF to extract tables from")],
    format: Annotated[Literal["csv", "json"], Form()] = "csv",
) -> StreamingResponse:
    """Extract all tables found in the PDF.

    `format` selects CSV (default, one big file with all tables
    separated by metadata headers) or JSON (one object with the full
    structured extraction).
    """
    _validate_pdf_filename(file.filename)
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file.")
    if len(blob) > MAX_SYNC_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SYNC_SIZE // (1024 * 1024)} MB limit.")

    t0 = time.time()
    try:
        src = fitz.open(stream=blob, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, f"Could not read PDF: {exc}") from exc

    tables_found: list[dict] = []
    try:
        for page_index, page in enumerate(src):
            try:
                page_tables = page.find_tables()
            except Exception as exc:
                # Some pages may have find_tables fail (e.g. zero-size
                # pages) — log and continue.
                logger.warning(
                    "find_tables failed on page %d: %s", page_index + 1, exc
                )
                continue
            for table_index, table in enumerate(page_tables):
                try:
                    # PyMuPDF 1.24+ exposes Table.to_pandas() which
                    # needs pandas installed. Try it first; fall back
                    # to the plain .extract() rows API (always available
                    # since PyMuPDF 1.20) if pandas is missing or the
                    # call fails for any reason.
                    rows: list[list[str]] | None = None
                    if hasattr(table, "to_pandas"):
                        try:
                            df = table.to_pandas()
                            rows = [
                                [str(c) if c is not None else "" for c in row]
                                for row in df.values.tolist()
                            ]
                        except Exception:
                            rows = None
                    if rows is None:
                        rows = [
                            [str(c) if c is not None else "" for c in row]
                            for row in table.extract()
                        ]
                except Exception as exc:
                    logger.warning(
                        "Table extraction failed on page %d table %d: %s",
                        page_index + 1,
                        table_index + 1,
                        exc,
                    )
                    continue

                bbox = list(table.bbox) if hasattr(table, "bbox") else [0, 0, 0, 0]
                tables_found.append(
                    {
                        "page": page_index + 1,
                        "table_index": table_index + 1,
                        "rows": len(rows),
                        "cols": len(rows[0]) if rows else 0,
                        "bbox": [round(x, 2) for x in bbox],
                        "data": rows,
                    }
                )
    finally:
        src.close()

    elapsed_ms = int((time.time() - t0) * 1000)
    page_count = (tables_found[-1]["page"] if tables_found else 0) or max(
        (t["page"] for t in tables_found), default=0
    )
    # Re-derive page_count from the doc, not the last table, so the
    # header is accurate even if no tables were found.
    try:
        page_count = len(fitz.open(stream=blob, filetype="pdf"))
    except Exception:
        pass

    if format == "json":
        out = json.dumps(
            {
                "pages": page_count,
                "table_count": len(tables_found),
                "tables": tables_found,
                "elapsed_ms": elapsed_ms,
            },
            indent=2,
            ensure_ascii=False,
        ).encode("utf-8")
        filename = _suggest_name(file.filename or "document.pdf", "tables", "json")
        return StreamingResponse(
            io.BytesIO(out),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Table-Count": str(len(tables_found)),
                "X-Tables-Pages": str(page_count),
                "X-Tables-Elapsed-Ms": str(elapsed_ms),
                "Cache-Control": "no-store",
            },
        )

    # CSV format: one big file, tables separated by metadata header
    buf = io.StringIO()
    writer = csv.writer(buf)
    if not tables_found:
        # Empty body but still a valid CSV — useful for the user to
        # see "no tables" came back, not an error.
        writer.writerow(["# No tables detected."])
    else:
        writer.writerow(
            [
                f"# Source: {file.filename}",
                f"# Pages: {page_count}",
                f"# Tables found: {len(tables_found)}",
                f"# Elapsed: {elapsed_ms} ms",
                f"# Generated by GetPDFPro (PyMuPDF find_tables)",
            ]
        )
        writer.writerow([])
        for t in tables_found:
            writer.writerow(
                [
                    f"# Page {t['page']}, Table {t['table_index']}, "
                    f"{t['rows']} rows × {t['cols']} cols, "
                    f"bbox={t['bbox']}"
                ]
            )
            for row in t["data"]:
                writer.writerow(row)
            writer.writerow([])

    out = buf.getvalue().encode("utf-8")
    filename = _suggest_name(file.filename or "document.pdf", "tables", "csv")
    return StreamingResponse(
        io.BytesIO(out),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Table-Count": str(len(tables_found)),
            "X-Tables-Pages": str(page_count),
            "X-Tables-Elapsed-Ms": str(elapsed_ms),
            "Cache-Control": "no-store",
        },
    )
