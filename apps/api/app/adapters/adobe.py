"""Adobe PDF Services adapter — tier 1 (free, best quality).

Adobe's PDF Services API has a free tier of 500 Document Transactions
per month. "Export PDF → DOCX/XLSX/PPTX" is 1 Document Transaction
per 50 pages of input. So 500 DT ≈ 25,000 pages/month for free.

This adapter uses direct HTTP (no SDK) to keep dependencies light.
The auth flow is OAuth 2.0 Client Credentials (server-to-server):
  1. POST /ims/token/v3 with client_id+client_secret → access_token
  2. POST /assets with the PDF → asset_id + upload_uri
  3. Upload the PDF bytes to the upload_uri
  4. POST /operation/exportpdf with asset_id + output format → 200/202
  5. Poll the result location until done
  6. Download the result bytes

Reference: https://developer.adobe.com/document-services/docs/apis/#tag/PDF-Services
"""

from __future__ import annotations

import io
import json
import time
from typing import Any

import httpx

from app.config import get_settings

from . import AdapterResult, ConversionAdapter, ConversionError, OutputFormat


# Adobe's PDF Services API endpoint. The official Python SDK
# (pdfservices-sdk 4.2.0) defaults to the US regional host
# `pdf-services-ue1.adobe.io` (us-east-1). The global/unscoped
# host `pdf-services.adobe.io` ALSO serves the token endpoint
# and asset creation, and serves the legacy PDF/A, redact,
# compare, and extractpdf operations. But the Office-conversion
# operations (`/operation/createpdf`, `/operation/exportpdf`)
# are ONLY routed on the regional host — the legacy host
# returns 400 INVALID_REQUEST_FORMAT with
# "input/inputs is a required parameter for external storage
# requests" (a misleading message that actually means
# "we routed your request to the legacy/regional-fallback
# handler" — see adobe_ops.py for the v2 helper).
#
# We default to the LEGACY host here for backward compatibility
# with the 4 working operations. The 5 Office endpoints in
# `adobe_ops.py` use a separate `ADOBE_V2_API_BASE` constant
# pointing at the regional host.
#
# Reference: SDK source
# `adobe/pdfservices/operation/internal/constants/pdf_services_uri.py`
# — `URI = "https://pdf-services.adobe.io"` (legacy, no region),
#   `US_URI = "https://pdf-services-ue1.adobe.io"` (default in SDK),
#   `EU_URI = "https://pdf-services-ew1.adobe.io"` (Region.EU).
ADOBE_API_BASE = "https://pdf-services.adobe.io"
ADOBE_AUTH_URL = "https://ims-na1.adobelogin.com/ims/token/v3"
# V2 regional host (US East 1) — used by the 5 Office conversion
# operations (createpdf, exportpdf) which are NOT routed on the
# legacy host. Same OAuth flow as the legacy auth endpoint.
ADOBE_V2_API_BASE = "https://pdf-services-ue1.adobe.io"
ADOBE_V2_AUTH_URL = f"{ADOBE_V2_API_BASE}/token"

# Per-output-format Adobe format enum. (xlsx + pptx are in the
# "EXPORT_PDF_TO" enum group, see Adobe docs.)
ADOBE_FORMAT_ENUM: dict[str, str] = {
    "docx": "docx",
    "xlsx": "xlsx",
    "pptx": "pptx",
}


class AdobeAdapter:
    name = "adobe"
    description = (
        "Adobe PDF Services API. Free tier: 500 Document Transactions/month. "
        "Highest quality (95-99%)."
    )
    quality_score = 97

    def __init__(self) -> None:
        settings = get_settings()
        self.client_id = settings.adobe_client_id
        self.client_secret = settings.adobe_client_secret
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0

    async def is_available(self) -> bool:
        # Must have credentials configured. (Free-tier quota is not
        # queryable in real-time, so we just trust the credentials
        # and let the API respond with 429/402 if exhausted. The
        # cascade will then fall through to the next adapter.)
        return bool(self.client_id) and bool(self.client_secret)

    async def _get_access_token(self) -> str:
        """OAuth 2.0 client-credentials grant. Caches the token in
        memory until 60s before its stated expiry."""
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                ADOBE_AUTH_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "client_credentials",
                    "scope": "openid,AdobeID,DCAPI",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if resp.status_code != 200:
            raise ConversionError(
                f"Adobe auth failed ({resp.status_code}): {resp.text[:200]}",
                adapter_name=self.name,
                retryable=True,  # maybe a transient token issue
            )
        body = resp.json()
        token = body.get("access_token")
        expires_in = body.get("expires_in", 3600)
        if not token:
            raise ConversionError(
                f"Adobe auth returned no access_token: {body}",
                adapter_name=self.name,
                retryable=True,
            )
        # Cache with 60s safety margin
        self._access_token = token
        self._token_expires_at = time.time() + max(60, expires_in - 60)
        return token

    async def _upload_asset(self, token: str, pdf_bytes: bytes) -> str:
        """Upload the PDF to Adobe's asset storage. Returns the asset ID."""
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{ADOBE_API_BASE}/assets",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-API-Key": self.client_id,
                    "Content-Type": "application/json",
                },
                content=json.dumps({"mediaType": "application/pdf"}),
            )
        if resp.status_code not in (200, 201):
            raise ConversionError(
                f"Adobe asset creation failed ({resp.status_code}): {resp.text[:200]}",
                adapter_name=self.name,
                retryable=True,
            )
        body = resp.json()
        asset_id = body.get("assetID") or body.get("assetId")
        upload_uri = body.get("uploadUri") or body.get("uploadURI")
        if not asset_id or not upload_uri:
            raise ConversionError(
                f"Adobe asset creation returned no assetID/uploadUri: {body}",
                adapter_name=self.name,
                retryable=True,
            )

        # Upload the actual PDF bytes to the upload URI (PUT).
        async with httpx.AsyncClient(timeout=120) as client:
            put = await client.put(
                upload_uri,
                headers={"Content-Type": "application/pdf"},
                content=pdf_bytes,
            )
        if put.status_code not in (200, 201, 204):
            raise ConversionError(
                f"Adobe asset upload failed ({put.status_code}): {put.text[:200]}",
                adapter_name=self.name,
                retryable=True,
            )
        return asset_id

    async def _submit_export(
        self, token: str, asset_id: str, output_format: str
    ) -> str:
        """Start the PDF→Office export job. Returns the polling URL."""
        adobe_format = ADOBE_FORMAT_ENUM.get(output_format)
        if not adobe_format:
            raise ConversionError(
                f"Adobe doesn't support output_format={output_format!r}",
                adapter_name=self.name,
                retryable=False,
            )
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{ADOBE_API_BASE}/operation/exportpdf",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-API-Key": self.client_id,
                    "Content-Type": "application/json",
                },
                content=json.dumps(
                    {
                        "assetID": asset_id,
                        "json": "{}",
                        "params": {
                            "targetFormat": adobe_format,
                        },
                    }
                ),
            )
        if resp.status_code not in (200, 201, 202):
            # 402 Payment Required or 429 Too Many Requests means
            # we've hit the free-tier cap. Fall through to next adapter.
            err_text = resp.text[:200]
            if resp.status_code in (402, 429):
                raise ConversionError(
                    f"Adobe free tier exhausted ({resp.status_code}): {err_text}",
                    adapter_name=self.name,
                    retryable=False,  # don't loop trying Adobe
                )
            raise ConversionError(
                f"Adobe export submission failed ({resp.status_code}): {err_text}",
                adapter_name=self.name,
                retryable=True,
            )
        body = resp.json()
        poll_url = body.get("location") or body.get("Location")
        if not poll_url:
            raise ConversionError(
                f"Adobe export submission returned no polling URL: {body}",
                adapter_name=self.name,
                retryable=True,
            )
        return poll_url

    async def _poll_until_done(self, token: str, poll_url: str, timeout_s: int = 120) -> str:
        """Poll the export job. Returns the download URL when complete."""
        deadline = time.time() + timeout_s
        async with httpx.AsyncClient(timeout=30) as client:
            while time.time() < deadline:
                resp = await client.get(
                    poll_url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "X-API-Key": self.client_id,
                    },
                )
                if resp.status_code == 200:
                    body = resp.json()
                    status = (body.get("status") or "").upper()
                    if status in ("DONE", "COMPLETED", "SUCCEEDED"):
                        # Some Adobe responses return the asset directly
                        asset = body.get("asset")
                        if isinstance(asset, dict):
                            download_uri = (
                                asset.get("downloadUri") or asset.get("downloadURI")
                            )
                            if download_uri:
                                return download_uri
                        raise ConversionError(
                            f"Adobe job done but no downloadUri in response: {body}",
                            adapter_name=self.name,
                            retryable=True,
                        )
                    if status in ("FAILED", "ERROR"):
                        raise ConversionError(
                            f"Adobe export job failed: {body}",
                            adapter_name=self.name,
                            retryable=False,  # bad PDF or unsupported feature
                        )
                    # Still running — wait and retry
                elif resp.status_code == 202:
                    pass  # accepted, still processing
                else:
                    raise ConversionError(
                        f"Adobe polling failed ({resp.status_code}): {resp.text[:200]}",
                        adapter_name=self.name,
                        retryable=True,
                    )
                await _sleep(2)
        raise ConversionError(
            f"Adobe export timed out after {timeout_s}s",
            adapter_name=self.name,
            retryable=True,
        )

    async def _download_result(self, download_url: str) -> bytes:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(download_url)
        if resp.status_code != 200:
            raise ConversionError(
                f"Adobe result download failed ({resp.status_code})",
                adapter_name=self.name,
                retryable=True,
            )
        return resp.content

    async def convert(
        self,
        pdf_bytes: bytes,
        output_format: OutputFormat = "docx",
        filename_hint: str = "document.pdf",
    ) -> AdapterResult:
        t0 = time.time()
        token = await self._get_access_token()
        asset_id = await self._upload_asset(token, pdf_bytes)
        poll_url = await self._submit_export(token, asset_id, output_format)
        download_url = await self._poll_until_done(token, poll_url)
        out_bytes = await self._download_result(download_url)
        elapsed_ms = int((time.time() - t0) * 1000)
        mime, ext = _mime_and_ext(output_format)
        return AdapterResult(
            bytes=out_bytes,
            mime_type=mime,
            file_extension=ext,
            adapter_name=self.name,
            elapsed_ms=elapsed_ms,
            pages_converted=0,  # Adobe doesn't return this in the result
            cost_usd=0.0,  # free tier
        )


def _mime_and_ext(output_format: str) -> tuple[str, str]:
    return {
        "docx": (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "docx",
        ),
        "xlsx": (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "xlsx",
        ),
        "pptx": (
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "pptx",
        ),
    }.get(output_format, ("application/octet-stream", output_format))


async def _sleep(seconds: float) -> None:
    import asyncio
    await asyncio.sleep(seconds)
