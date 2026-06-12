"""Adobe PDF Services — extended operations (PDF/A, redact, compare, forms).

The base `AdobeAdapter` in adobe.py handles PDF → Office conversion
(exportpdf). This module extends the same OAuth + asset upload pattern
to four more Adobe API operations:

  - pdf_to_pdfa:        /operation/createpdfa (PDF → PDF/A-2b)
  - redact:             /operation/redact (apply redaction marks)
  - compare:            /operation/documentcompare (visual diff)
  - extract_forms:      /operation/extractpdf (form field data extraction)

Each operation follows the same flow:
  1. Get an access token (cached in module-level state).
  2. Upload the input PDF(s) as assets.
  3. POST to the operation endpoint with the asset IDs.
  4. Poll the result location.
  5. Download the output PDF (or JSON for compare/forms).

Reference: https://developer.adobe.com/document-services/docs/apis/

Note on free tier: Adobe's free tier is 500 Document Transactions
(DT) per month. Each of these operations is 1 DT. So with 5 adapters
(exportpdf, pdfa, redact, compare, extractpdf) using the same quota,
we have ~100 calls/month for free. Heavy users will need to upgrade
their Adobe account, or the cascade falls through to self-hosted
fallbacks (pikepdf for PDF/A, manual redaction for redact, etc.).
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import get_settings

from .adobe import ADOBE_API_BASE, ADOBE_AUTH_URL


@dataclass
class AdobeOpResult:
    """Result of an extended Adobe PDF operation."""

    bytes: bytes
    mime_type: str
    file_extension: str
    elapsed_ms: int
    cost_usd: float = 0.0
    extra: dict[str, Any] | None = None  # e.g. compare report data


class AdobeOpError(Exception):
    """Raised when an Adobe extended operation fails."""

    def __init__(
        self,
        message: str,
        retryable: bool = True,
        cause: Exception | None = None,
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.cause = cause


# ─── Auth (module-level, shared with AdobeAdapter) ──────────────
_token: str | None = None
_token_expires_at: float = 0.0
_client_id: str | None = None
_client_secret: str | None = None


def is_configured() -> bool:
    """Return True if Adobe credentials are set in env/config."""
    global _client_id, _client_secret
    if _client_id is None:
        s = get_settings()
        _client_id = s.adobe_client_id
        _client_secret = s.adobe_client_secret
    return bool(_client_id) and bool(_client_secret)


async def _get_access_token() -> str:
    global _token, _token_expires_at
    if _token and time.time() < _token_expires_at:
        return _token
    if not is_configured():
        raise AdobeOpError(
            "Adobe PDF Services is not configured. Set ADOBE_CLIENT_ID and "
            "ADOBE_CLIENT_SECRET in your environment.",
            retryable=False,
        )
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            ADOBE_AUTH_URL,
            data={
                "client_id": _client_id,
                "client_secret": _client_secret,
                "grant_type": "client_credentials",
                "scope": "openid,AdobeID,DCAPI",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        raise AdobeOpError(
            f"Adobe auth failed ({resp.status_code}): {resp.text[:200]}",
            retryable=True,
        )
    body = resp.json()
    token = body.get("access_token")
    expires_in = body.get("expires_in", 3600)
    if not token:
        raise AdobeOpError(
            f"Adobe auth returned no access_token: {body}",
            retryable=True,
        )
    _token = token
    _token_expires_at = time.time() + max(60, expires_in - 60)
    return token


async def _upload_asset(token: str, pdf_bytes: bytes, filename: str = "input.pdf", mime_type: str = "application/pdf") -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{ADOBE_API_BASE}/assets",
            headers={
                "Authorization": f"Bearer {token}",
                "X-API-Key": _client_id or "",
                "Content-Type": "application/json",
            },
            content=json.dumps({"mediaType": mime_type}),
        )
    if resp.status_code not in (200, 201):
        raise AdobeOpError(
            f"Adobe asset create failed ({resp.status_code}): {resp.text[:200]}",
            retryable=True,
        )
    body = resp.json()
    asset_id = body.get("assetID") or body.get("assetId")
    upload_uri = body.get("uploadUri") or body.get("uploadURI")
    if not asset_id or not upload_uri:
        raise AdobeOpError(
            f"Adobe asset create returned no assetID/uploadUri: {body}",
            retryable=True,
        )
    async with httpx.AsyncClient(timeout=120) as client:
        put = await client.put(
            upload_uri,
            headers={"Content-Type": "application/pdf"},
            content=pdf_bytes,
        )
    if put.status_code not in (200, 201, 204):
        raise AdobeOpError(
            f"Adobe asset upload failed ({put.status_code}): {put.text[:200]}",
            retryable=True,
        )
    return asset_id


async def _submit_and_poll(
    token: str,
    op_path: str,
    body: dict,
    timeout_s: int = 180,
) -> dict:
    """Submit an Adobe operation and poll the result location.

    Returns the final JSON body of the result.
    """
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{ADOBE_API_BASE}{op_path}",
            headers={
                "Authorization": f"Bearer {token}",
                "X-API-Key": _client_id or "",
                "Content-Type": "application/json",
            },
            content=json.dumps(body),
        )
    if resp.status_code not in (200, 201, 202):
        text = resp.text[:200]
        if resp.status_code in (402, 429):
            raise AdobeOpError(
                f"Adobe free tier exhausted ({resp.status_code}): {text}",
                retryable=False,
            )
        raise AdobeOpError(
            f"Adobe op {op_path} failed ({resp.status_code}): {text}",
            retryable=True,
        )
    poll_url = resp.headers.get("location") or resp.headers.get("Location")
    if not poll_url:
        # Some operations return the result body directly (sync)
        try:
            return resp.json()
        except Exception:
            raise AdobeOpError(
                f"Adobe op {op_path} returned no polling URL: {resp.text[:200]}",
                retryable=True,
            )
    deadline = time.time() + timeout_s
    async with httpx.AsyncClient(timeout=30) as client:
        while time.time() < deadline:
            poll = await client.get(
                poll_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-API-Key": _client_id or "",
                },
            )
            if poll.status_code == 200:
                body = poll.json()
                status = (body.get("status") or "").upper()
                if status in ("DONE", "COMPLETED", "SUCCEEDED"):
                    return body
                if status in ("FAILED", "ERROR"):
                    raise AdobeOpError(
                        f"Adobe op {op_path} job failed: {body}",
                        retryable=False,
                    )
            await _sleep(2)
    raise AdobeOpError(
        f"Adobe op {op_path} timed out after {timeout_s}s",
        retryable=True,
    )


async def _download(download_uri: str) -> bytes:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(download_uri)
    if resp.status_code != 200:
        raise AdobeOpError(
            f"Adobe result download failed ({resp.status_code})",
            retryable=True,
        )
    return resp.content


async def _sleep(seconds: float) -> None:
    import asyncio
    await asyncio.sleep(seconds)


# ─── Operations ────────────────────────────────────────────────

async def pdf_to_pdfa(pdf_bytes: bytes, conformance: str = "PDF_A_2_B") -> AdobeOpResult:
    """Convert a PDF to PDF/A-2b conformant.

    `conformance` should be one of: PDF_A_1_B, PDF_A_2_B, PDF_A_3_B.
    Default is PDF_A_2_B (most widely accepted by archival systems).
    """
    t0 = time.time()
    token = await _get_access_token()
    asset_id = await _upload_asset(token, pdf_bytes)
    body = await _submit_and_poll(
        token,
        "/operation/createpdfa",
        {
            "assetID": asset_id,
            "json": "{}",
            "params": {"conformanceLevel": conformance},
        },
    )
    asset = body.get("asset") or {}
    download_uri = asset.get("downloadUri") or asset.get("downloadURI")
    if not download_uri:
        raise AdobeOpError(
            f"Adobe PDF/A: no downloadUri in response: {body}",
            retryable=True,
        )
    out = await _download(download_uri)
    elapsed_ms = int((time.time() - t0) * 1000)
    return AdobeOpResult(
        bytes=out,
        mime_type="application/pdf",
        file_extension="pdf",
        elapsed_ms=elapsed_ms,
        extra={"conformance": conformance},
    )


async def redact(
    pdf_bytes: bytes,
    words: list[str] | None = None,
    regex: list[str] | None = None,
) -> AdobeOpResult:
    """Redact text from a PDF.

    `words` is a list of strings to redact. `regex` is a list of
    regular expression patterns to redact. At least one of `words`
    or `regex` must be provided.

    Adobe's redact operation takes a JSON of "regularExpressions" or
    "stringsToRedact" with the words/regexes. After redaction the
    underlying text is removed (not just covered with a black
    rectangle), so this is genuine redaction.
    """
    if not words and not regex:
        raise AdobeOpError(
            "Redact: provide at least one of 'words' or 'regex'.",
            retryable=False,
        )
    t0 = time.time()
    token = await _get_access_token()
    asset_id = await _upload_asset(token, pdf_bytes)
    # Adobe's redact JSON spec:
    # https://developer.adobe.com/document-services/docs/overview/pdf-services-api/howtos/redact-pdf/
    redact_config: dict = {}
    if words:
        redact_config["stringsToRedact"] = words
    if regex:
        redact_config["regularExpressionsToRedact"] = regex
    body = await _submit_and_poll(
        token,
        "/operation/redact",
        {
            "assetID": asset_id,
            "json": json.dumps(redact_config),
            "params": {},
        },
    )
    asset = body.get("asset") or {}
    download_uri = asset.get("downloadUri") or asset.get("downloadURI")
    if not download_uri:
        raise AdobeOpError(
            f"Adobe redact: no downloadUri in response: {body}",
            retryable=True,
        )
    out = await _download(download_uri)
    elapsed_ms = int((time.time() - t0) * 1000)
    return AdobeOpResult(
        bytes=out,
        mime_type="application/pdf",
        file_extension="pdf",
        elapsed_ms=elapsed_ms,
        extra={"words_redacted": len(words or []), "regex_redacted": len(regex or [])},
    )


async def compare(pdf_a: bytes, pdf_b: bytes) -> AdobeOpResult:
    """Compare two PDFs and return a comparison report.

    The result is a JSON document with structural and textual
    differences between the two PDFs. The first PDF is treated as
    the "base" version; the second is the "target" version.
    """
    t0 = time.time()
    token = await _get_access_token()
    a_id = await _upload_asset(token, pdf_a, "base.pdf")
    b_id = await _upload_asset(token, pdf_b, "target.pdf")
    body = await _submit_and_poll(
        token,
        "/operation/documentcompare",
        {
            "baseAssetID": a_id,
            "targetAssetID": b_id,
            "json": "{}",
            "params": {},
        },
        timeout_s=240,
    )
    # Compare returns a JSON report, not a PDF. Wrap the report in
    # a JSON file and surface it as the response. Caller decides
    # what to do with it.
    elapsed_ms = int((time.time() - t0) * 1000)
    # The "asset" in the compare response contains a JSON file.
    asset = body.get("asset") or {}
    download_uri = asset.get("downloadUri") or asset.get("downloadURI")
    out: bytes
    if download_uri:
        out = await _download(download_uri)
    else:
        out = json.dumps(body, indent=2).encode("utf-8")
    return AdobeOpResult(
        bytes=out,
        mime_type="application/json",
        file_extension="json",
        elapsed_ms=elapsed_ms,
        extra={"report_kind": "compare"},
    )


async def extract_forms(pdf_bytes: bytes) -> AdobeOpResult:
    """Extract form field data from a PDF (PDF Forms API).

    The result is a JSON file with one entry per form field:
    name, type, value, default, options, etc. Useful for "give me
    a CSV of all the fields in this form".
    """
    t0 = time.time()
    token = await _get_access_token()
    asset_id = await _upload_asset(token, pdf_bytes)
    body = await _submit_and_poll(
        token,
        "/operation/extractpdf",
        {
            "assetID": asset_id,
            "json": json.dumps({"elementsToExtract": ["tables", "formFields"]}),
            "params": {},
        },
        timeout_s=120,
    )
    # extractPDF returns a ZIP with a JSON inside. We unpack the
    # JSON for the caller. (When streaming back, we'll wrap in a
    # ZIP if present.)
    asset = body.get("asset") or {}
    download_uri = asset.get("downloadUri") or asset.get("downloadURI")
    if not download_uri:
        raise AdobeOpError(
            f"Adobe extract: no downloadUri in response: {body}",
            retryable=True,
        )
    out = await _download(download_uri)
    elapsed_ms = int((time.time() - t0) * 1000)
    # The output is a ZIP containing a JSON file. Try to extract
    # the JSON; if that fails, return the raw bytes.
    import io
    import zipfile
    try:
        with zipfile.ZipFile(io.BytesIO(out)) as zf:
            json_files = [n for n in zf.namelist() if n.endswith(".json")]
            if json_files:
                with zf.open(json_files[0]) as jf:
                    out = jf.read()
    except Exception:
        pass
    return AdobeOpResult(
        bytes=out,
        mime_type="application/json",
        file_extension="json",
        elapsed_ms=elapsed_ms,
        extra={"report_kind": "forms"},
    )


# ─── Office Conversions (Wave C) ───────────────────────────────
#
# Five new operations:
#   - create_pdf_from_office(input_bytes, mime_type) -> AdobeOpResult
#       Used for Word/PPT/Excel → PDF. Adobe's CreatePDFJob
#       accepts a non-PDF asset and returns a PDF. The MIME
#       type tells Adobe which Office parser to use.
#   - export_pdf_to_pptx(pdf_bytes) -> AdobeOpResult
#   - export_pdf_to_xlsx(pdf_bytes) -> AdobeOpResult
#       Same as the existing exportpdf path but with targetFormat
#       set to pptx/xlsx.
#
# Reference: https://developer.adobe.com/document-services/docs/apis/

# MIME types Adobe accepts for CreatePDFJob. We map a friendly
# label to the right mediaType.
ADOBE_CREATE_PDF_MIME: dict[str, str] = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

# MIME types returned by exportpdf for each target format.
ADOBE_EXPORT_MIME: dict[str, str] = {
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


async def create_pdf_from_office(
    input_bytes: bytes,
    source_format: str,  # "docx" | "pptx" | "xlsx"
    filename: str = "input",
) -> AdobeOpResult:
    """Convert a Word / PowerPoint / Excel file to PDF.

    `source_format` is the lowercase extension without dot.
    Adobe's CreatePDFJob auto-detects the parser based on the
    asset's MIME type.

    Returns AdobeOpResult with bytes=PDF, mime_type=application/pdf.
    """
    mime = ADOBE_CREATE_PDF_MIME.get(source_format)
    if not mime:
        raise AdobeOpError(
            f"Unsupported source_format: {source_format!r}. "
            f"Use one of: {list(ADOBE_CREATE_PDF_MIME)}",
            retryable=False,
        )
    t0 = time.time()
    token = await _get_access_token()
    asset_id = await _upload_asset(token, input_bytes, f"{filename}.{source_format}", mime)
    body = await _submit_and_poll(
        token,
        "/operation/createpdf",
        {
            "assetID": asset_id,
            "json": "{}",
            "params": {},
        },
        timeout_s=180,
    )
    asset = body.get("asset") or {}
    download_uri = asset.get("downloadUri") or asset.get("downloadURI")
    if not download_uri:
        raise AdobeOpError(
            f"Adobe createPDF: no downloadUri in response: {body}",
            retryable=True,
        )
    out = await _download(download_uri)
    elapsed_ms = int((time.time() - t0) * 1000)
    return AdobeOpResult(
        bytes=out,
        mime_type="application/pdf",
        file_extension="pdf",
        elapsed_ms=elapsed_ms,
        extra={"source_format": source_format},
    )


async def export_pdf_to_office(
    pdf_bytes: bytes,
    target_format: str,  # "docx" | "pptx" | "xlsx"
) -> AdobeOpResult:
    """Convert a PDF to Word / PowerPoint / Excel.

    Adobe's exportpdf operation accepts targetFormat = "docx",
    "pptx", or "xlsx". Note: PDF → Word uses the same code path
    as our existing pdf-to-word (kept for backward compat) —
    we add PDF → PPT and PDF → Excel here.
    """
    if target_format not in ("docx", "pptx", "xlsx"):
        raise AdobeOpError(
            f"Unsupported target_format: {target_format!r}. "
            f"Use 'docx', 'pptx', or 'xlsx'.",
            retryable=False,
        )
    t0 = time.time()
    token = await _get_access_token()
    asset_id = await _upload_asset(token, pdf_bytes)
    body = await _submit_and_poll(
        token,
        "/operation/exportpdf",
        {
            "assetID": asset_id,
            "json": "{}",
            "params": {"targetFormat": target_format},
        },
        timeout_s=240,  # exportpdf can be slow for large PDFs
    )
    asset = body.get("asset") or {}
    download_uri = asset.get("downloadUri") or asset.get("downloadURI")
    if not download_uri:
        raise AdobeOpError(
            f"Adobe exportpdf({target_format}): no downloadUri: {body}",
            retryable=True,
        )
    out = await _download(download_uri)
    elapsed_ms = int((time.time() - t0) * 1000)
    return AdobeOpResult(
        bytes=out,
        mime_type=ADOBE_EXPORT_MIME[target_format],
        file_extension=target_format,
        elapsed_ms=elapsed_ms,
        extra={"target_format": target_format},
    )
