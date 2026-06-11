"""CloudConvert adapter — tier 2 fallback (paid, good quality).

CloudConvert's API is straightforward: POST a job, poll for
completion, download the result. Pricing is per-credit; PDF → Office
is 4 credits per conversion. With pay-as-you-go at €0.018/credit,
each conversion costs ~€0.072.

API reference: https://cloudconvert.com/api/v2
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from app.config import get_settings

from . import AdapterResult, ConversionAdapter, ConversionError, OutputFormat


CLOUDCONVERT_API = "https://api.cloudconvert.com/v2"

# CloudConvert input/output format names. (Note: the API expects
# "input_format" not "inputFormat", etc.)
CC_INPUT_FORMAT = "pdf"
CC_OUTPUT_FORMAT_MAP: dict[str, str] = {
    "docx": "docx",
    "xlsx": "xlsx",
    "pptx": "pptx",
}


class CloudConvertAdapter:
    name = "cloudconvert"
    description = (
        "CloudConvert (PDFTron engine). Paid per-conversion (~€0.072). "
        "Quality 90-95%."
    )
    quality_score = 92

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.cloudconvert_api_key
        # Cost per conversion, hard-coded from CloudConvert's published
        # pricing (4 credits × €0.018/credit = €0.072). Used for
        # cost tracking in the API logs / future billing dashboards.
        self.cost_per_conversion_eur = 0.072

    async def is_available(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def _create_job(self, pdf_bytes: bytes, output_format: str) -> str:
        """Create a job with one input + one output. Returns the job URL."""
        cc_output = CC_OUTPUT_FORMAT_MAP.get(output_format)
        if not cc_output:
            raise ConversionError(
                f"CloudConvert doesn't support output_format={output_format!r}",
                adapter_name=self.name,
                retryable=False,
            )

        # Step 1: create the job. Tasks reference each other by name.
        # The "import" task accepts a base64 string OR an "upload" via
        # a separate "upload" step. Easiest path: base64-inline. PDF
        # 50 MB cap in our router, so base64 is fine.
        import base64
        b64_pdf = base64.b64encode(pdf_bytes).decode("ascii")
        job_payload = {
            "tasks": {
                "import-pdf": {
                    "operation": "import/base64",
                    "file": b64_pdf,
                    "filename": "input.pdf",
                },
                "convert": {
                    "operation": "convert",
                    "input": ["import-pdf"],
                    "input_format": CC_INPUT_FORMAT,
                    "output_format": cc_output,
                },
                "export": {
                    "operation": "export/url",
                    "input": ["convert"],
                },
            },
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{CLOUDCONVERT_API}/jobs",
                headers=self._headers(),
                json=job_payload,
            )
        if resp.status_code not in (200, 201):
            raise ConversionError(
                f"CloudConvert job create failed ({resp.status_code}): {resp.text[:200]}",
                adapter_name=self.name,
                retryable=True,
            )
        body = resp.json()
        job_id = body.get("data", {}).get("id")
        if not job_id:
            raise ConversionError(
                f"CloudConvert job create returned no id: {body}",
                adapter_name=self.name,
                retryable=True,
            )
        return f"{CLOUDCONVERT_API}/jobs/{job_id}"

    async def _wait_for_done(self, job_url: str, timeout_s: int = 120) -> str:
        """Poll the job until it finishes. Returns the export task's
        output file URL (signed S3 URL)."""
        deadline = time.time() + timeout_s
        async with httpx.AsyncClient(timeout=30) as client:
            while time.time() < deadline:
                resp = await client.get(job_url, headers=self._headers())
                if resp.status_code != 200:
                    raise ConversionError(
                        f"CloudConvert poll failed ({resp.status_code}): {resp.text[:200]}",
                        adapter_name=self.name,
                        retryable=True,
                    )
                body = resp.json()
                data = body.get("data", {})
                status = data.get("status")
                if status == "finished":
                    # Find the export task's output file
                    tasks = data.get("tasks", [])
                    for t in tasks:
                        if t.get("name") == "export":
                            result = t.get("result", {})
                            files = result.get("files", [])
                            if files:
                                return files[0]["url"]
                    raise ConversionError(
                        f"CloudConvert finished but no export file URL: {tasks}",
                        adapter_name=self.name,
                        retryable=True,
                    )
                if status == "error":
                    # Surface the specific task that failed
                    tasks = data.get("tasks", [])
                    err = ""
                    for t in tasks:
                        if t.get("status") == "error":
                            err = f"task {t.get('name')}: {t.get('message', 'unknown')}"
                            break
                    raise ConversionError(
                        f"CloudConvert job failed — {err}",
                        adapter_name=self.name,
                        retryable=True,
                    )
                # Wait and retry
                await _sleep(2)
        raise ConversionError(
            f"CloudConvert job timed out after {timeout_s}s",
            adapter_name=self.name,
            retryable=True,
        )

    async def _download(self, file_url: str) -> bytes:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(file_url)
        if resp.status_code != 200:
            raise ConversionError(
                f"CloudConvert result download failed ({resp.status_code})",
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
        job_url = await self._create_job(pdf_bytes, output_format)
        download_url = await self._wait_for_done(job_url)
        out_bytes = await self._download(download_url)
        elapsed_ms = int((time.time() - t0) * 1000)
        mime, ext = _mime_and_ext(output_format)
        return AdapterResult(
            bytes=out_bytes,
            mime_type=mime,
            file_extension=ext,
            adapter_name=self.name,
            elapsed_ms=elapsed_ms,
            pages_converted=0,
            cost_usd=round(self.cost_per_conversion_eur * 1.08, 4),  # EUR→USD rough
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
