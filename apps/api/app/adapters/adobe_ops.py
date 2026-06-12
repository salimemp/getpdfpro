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

from .adobe import (
    ADOBE_API_BASE,
    ADOBE_AUTH_URL,
    ADOBE_V2_API_BASE,
    ADOBE_V2_AUTH_URL,
)


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
# V2 (regional) auth — separate cache so tokens issued by
# different hosts don't share a slot. See `_get_access_token_v2`.
_v2_token: str | None = None
_v2_token_expires_at: float = 0.0
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


async def _upload_asset(
    token: str,
    pdf_bytes: bytes,
    filename: str = "input.pdf",
    mime_type: str = "application/pdf",
    host: str = ADOBE_API_BASE,
) -> str:
    """Upload bytes to Adobe asset storage. Both the legacy and
    V2 (regional) hosts expose `/assets` and use the same
    presigned-S3 upload flow. The presigned URL itself is on
    AWS S3, not Adobe's host, so the actual PUT is
    host-agnostic.

    `host` defaults to the legacy `ADOBE_API_BASE`. V2 callers
    (the 5 Office conversions) pass `ADOBE_V2_API_BASE` so the
    asset is created in the same region as the operation that
    will use it. Asset IDs are global (URNs like
    `urn:aaid:AS:UE1:...`) so the cross-host case technically
    works, but keeping host = token-host is safer.
    """
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{host}/assets",
            headers={
                "Authorization": f"Bearer {token}",
                "x-api-key": _client_id or "",
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
            # Use the same MIME type we declared when creating
            # the asset. The presigned URL is generated for this
            # specific Content-Type, and a mismatch causes
            # SignatureDoesNotMatch (403).
            headers={"Content-Type": mime_type},
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

    IMPORTANT: the X-DCSDK-OPS-INFO header is required by
    Adobe's API gateway to route the request to the right
    internal handler. Without it, Adobe treats the request as
    an 'external storage' request and rejects it with
    INVALID_REQUEST_FORMAT. This header is what the official
    Python SDK sends on every operation call (see
    OperationHeaderInfoEndpointMap in the SDK source).
    """
    # Map op_path to the header info string the SDK uses.
    # createpdf and exportpdf are the only two we need for v1;
    # the others (createpdfa, redact, compare, extractpdf) use
    # their own paths and the same header scheme.
    op_info = {
        "/operation/createpdf": "Create PDF Operation",
        "/operation/exportpdf": "Export PDF Operation",
        "/operation/createpdfa": "PDF Watermark Operation",  # placeholder, not in v1
    }.get(op_path, "PDF Services Operation")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{ADOBE_API_BASE}{op_path}",
            headers={
                "Authorization": f"Bearer {token}",
                # Lowercase header names — Adobe's gateway is
                # case-sensitive. The official SDK uses lowercase.
                "x-api-key": _client_id or "",
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
                # Identifies us as the official Python SDK.
                # Without this, Adobe treats the request as
                # an unknown client and routes it to the
                # 'external storage' fallback which expects
                # different field names.
                "x-api-app-info": "python-pdfservices-sdk-4.2.0",
                # The header Adobe uses to route the request
                # to the right internal handler.
                "x-dcsdk-ops-info": op_info,
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
                    "x-api-key": _client_id or "",
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


async def _get_access_token_v2() -> str:
    """OAuth 2.0 client-credentials grant against the V2 regional
    host (`pdf-services-ue1.adobe.io`). Used by the Office
    conversion operations (createpdf, exportpdf) which are NOT
    routed on the legacy host.

    NOTE: unlike the legacy IMS endpoint
    (`ims-na1.adobelogin.com/ims/token/v3`), the V2 endpoint
    is stricter about what it accepts in the POST body. The
    official SDK only sends `client_id` and `client_secret`
    — no `grant_type`, no `scope`. Adding those fields
    returns 400 INVALID_REQUEST_FORMAT. Source:
    `adobe/pdfservices/operation/internal/auth/service_principal_authenticator.py`
    line 71-72:
        access_token_request_payload = {"client_id": ...,
                                        "client_secret": ...}

    The token is cached separately from the legacy `_token`
    since tokens issued by different hosts can have different
    scopes (in practice they don't, but we keep them separate
    to be safe). The SDK does the same — one token cache per
    ExecutionContext, never mixed across regions.
    """
    global _v2_token, _v2_token_expires_at
    if _v2_token and time.time() < _v2_token_expires_at:
        return _v2_token
    if not is_configured():
        raise AdobeOpError(
            "Adobe PDF Services is not configured. Set ADOBE_CLIENT_ID and "
            "ADOBE_CLIENT_SECRET in your environment.",
            retryable=False,
        )
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            ADOBE_V2_AUTH_URL,
            data={
                "client_id": _client_id,
                "client_secret": _client_secret,
            },
            headers={"Accept": "application/json, text/plain, */*"},
        )
    if resp.status_code != 200:
        raise AdobeOpError(
            f"Adobe V2 auth failed ({resp.status_code}): {resp.text[:200]}",
            retryable=True,
        )
    body = resp.json()
    token = body.get("access_token")
    expires_in = body.get("expires_in", 3600)
    if not token:
        raise AdobeOpError(
            f"Adobe V2 auth returned no access_token: {body}",
            retryable=True,
        )
    _v2_token = token
    _v2_token_expires_at = time.time() + max(60, expires_in - 60)
    return token


async def _submit_v2_and_poll(
    token: str,
    op_path: str,
    body: dict,
    ops_info: str,
    timeout_s: int = 180,
) -> dict:
    """Submit an operation against the V2 regional host and poll.

    This is the V2 (regional) counterpart of `_submit_and_poll`.
    Two material differences from the legacy helper:

    1. **Host**: uses `ADOBE_V2_API_BASE` (`pdf-services-ue1.adobe.io`).
       The legacy host (`pdf-services.adobe.io`) returns
       400 INVALID_REQUEST_FORMAT for `/operation/createpdf` and
       `/operation/exportpdf` because those routes are not
       registered on the legacy gateway.

    2. **Body shape**: params are at the TOP LEVEL of the JSON
       body, not nested in `params: {...}` or wrapped in
       `json: "{...}"`. The official SDK's
       `CreatePDFInternalAssetRequest.to_json()` and
       `ExportPDFInternalAssetRequest.to_json()` produce exactly
       this flat shape (see the SDK's `JSONHintEncoder`).

    The `ops_info` argument is the EXACT string the SDK sends
    in the `x-dcsdk-ops-info` header for this operation. From
    the SDK source `service_constants.py`:
      CREATE_PDF               = "CREATE_PDF"
      EXPORT_PDF_OPERATION_NAME = "EXPORT_PDF"
    These are the enum-name strings, NOT the human-readable
    values from `OperationHeaderInfoEndpointMap` (which has
    "Create PDF Operation" / "Export PDF Operation" — those
    are used for logging only, NOT the wire header).
    """
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{ADOBE_V2_API_BASE}{op_path}",
            headers={
                "Authorization": f"Bearer {token}",
                "x-api-key": _client_id or "",
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
                # Identifies us as the official Python SDK.
                "x-api-app-info": "python-pdfservices-sdk-4.2.0",
                # The header Adobe uses to route the request to
                # the right internal handler. Value MUST match
                # the constant in `service_constants.py` exactly.
                "x-dcsdk-ops-info": ops_info,
            },
            content=json.dumps(body),
        )
    if resp.status_code not in (200, 201, 202):
        text = resp.text[:200]
        if resp.status_code in (402, 429):
            raise AdobeOpError(
                f"Adobe V2 free tier exhausted ({resp.status_code}): {text}",
                retryable=False,
            )
        raise AdobeOpError(
            f"Adobe V2 op {op_path} failed ({resp.status_code}): {text}",
            retryable=True,
        )
    poll_url = resp.headers.get("location") or resp.headers.get("Location")
    if not poll_url:
        try:
            return resp.json()
        except Exception:
            raise AdobeOpError(
                f"Adobe V2 op {op_path} returned no polling URL: {resp.text[:200]}",
                retryable=True,
            )
    deadline = time.time() + timeout_s
    async with httpx.AsyncClient(timeout=30) as client:
        while time.time() < deadline:
            poll = await client.get(
                poll_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "x-api-key": _client_id or "",
                },
            )
            if poll.status_code == 200:
                body = poll.json()
                status = (body.get("status") or "").upper()
                if status in ("DONE", "COMPLETED", "SUCCEEDED"):
                    return body
                if status in ("FAILED", "ERROR"):
                    raise AdobeOpError(
                        f"Adobe V2 op {op_path} job failed: {body}",
                        retryable=False,
                    )
            await _sleep(2)
    raise AdobeOpError(
        f"Adobe V2 op {op_path} timed out after {timeout_s}s",
        retryable=True,
    )


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

    Uses the V2 (regional) host and the SDK's flat body shape:
    `{assetID, createTaggedPDF, documentLanguage}`. The legacy
    host returns 400 INVALID_REQUEST_FORMAT for this operation
    and the legacy `json/params` wrapper body is not accepted
    on the regional host.
    """
    mime = ADOBE_CREATE_PDF_MIME.get(source_format)
    if not mime:
        raise AdobeOpError(
            f"Unsupported source_format: {source_format!r}. "
            f"Use one of: {list(ADOBE_CREATE_PDF_MIME)}",
            retryable=False,
        )
    t0 = time.time()
    token = await _get_access_token_v2()
    asset_id = await _upload_asset(
        token, input_bytes, f"{filename}.{source_format}", mime,
        host=ADOBE_V2_API_BASE,
    )
    body = await _submit_v2_and_poll(
        token,
        "/operation/createpdf",
        {
            "assetID": asset_id,
            "createTaggedPDF": False,
            "documentLanguage": "en-US",
        },
        ops_info="CREATE_PDF",  # ServiceConstants.CREATE_OPERATION_NAME
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

    Uses the V2 (regional) host and the SDK's flat body shape:
    `{assetID, targetFormat, ocrLang}`. Same reasoning as
    `create_pdf_from_office` above.
    """
    if target_format not in ("docx", "pptx", "xlsx"):
        raise AdobeOpError(
            f"Unsupported target_format: {target_format!r}. "
            f"Use 'docx', 'pptx', or 'xlsx'.",
            retryable=False,
        )
    t0 = time.time()
    token = await _get_access_token_v2()
    asset_id = await _upload_asset(
        token, pdf_bytes, "input.pdf", "application/pdf",
        host=ADOBE_V2_API_BASE,
    )
    body = await _submit_v2_and_poll(
        token,
        "/operation/exportpdf",
        {
            "assetID": asset_id,
            "targetFormat": target_format,
            "ocrLang": "en-US",
        },
        ops_info="EXPORT_PDF",  # ServiceConstants.EXPORT_PDF_OPERATION_NAME
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
