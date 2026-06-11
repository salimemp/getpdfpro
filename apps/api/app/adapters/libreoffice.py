"""LibreOffice adapter — tier 2 (self-hosted, free, good quality).

LibreOffice headless mode (`soffice --headless --convert-to`)
provides high-fidelity PDF ↔ Office conversion. The trade-offs:

  - + Free, no API costs, no rate limits
  - + 90-95% layout fidelity (Adobe quality minus the last 5%)
  - + Supports DOCX, XLSX, PPTX inputs and outputs
  - - ~250 MB added to the Docker image
  - - 1-2 min cold start (soffice loads)
  - - Each conversion spawns a process; cap concurrent runs
  - - Sometimes hangs on malformed PDFs — we wrap with a hard timeout

How we invoke it:
  soffice --headless --norestore --nologo --nodefault --nofirststartwizard
          --convert-to docx --outdir <tmpdir> <input.pdf>

Then read the converted file from the output dir. soffice writes
the output with the same basename as the input + new extension.

Concurrency: a small asyncio.Semaphore limits us to N concurrent
soffice processes. Default 2 — enough for our load without OOM-ing
the container. Configurable via env var.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
import time
from pathlib import Path

from . import AdapterResult, ConversionAdapter, ConversionError, OutputFormat


# Map our output_format to the `--convert-to` argument soffice expects.
# LibreOffice uses "docx", "xlsx", "pptx" — same as us, with one quirk
# for older formats. Keep this small.
LO_OUTPUT_MAP: dict[str, str] = {
    "docx": "docx:MS Word 2007 XML",
    "xlsx": "xlsx:Calc Office Open XML",
    "pptx": "pptx:Impress Office Open XML",
}

# Default conversion timeout. LibreOffice can hang on bad PDFs;
# 60s is generous for a 50-page document.
DEFAULT_TIMEOUT_S = 60.0

# Default max concurrent soffice processes. Each uses 100-200MB RAM.
# 2 is safe for Railway's free tier (1GB); bump to 4 on Pro.
DEFAULT_MAX_CONCURRENCY = 2


class LibreOfficeAdapter:
    name = "libreoffice"
    description = (
        "Self-hosted LibreOffice headless. 90-95% layout fidelity. "
        "Always free, no per-conversion cost."
    )
    quality_score = 92

    def __init__(self) -> None:
        self._semaphore = asyncio.Semaphore(
            int(os.getenv("LIBREOFFICE_MAX_CONCURRENCY", DEFAULT_MAX_CONCURRENCY))
        )
        self._timeout_s = float(os.getenv("LIBREOFFICE_TIMEOUT_S", DEFAULT_TIMEOUT_S))
        # Sanity check that soffice is on PATH. We check this lazily
        # on the first convert() call, not at import time, so the
        # app can boot even if LibreOffice isn't installed (the
        # adapter will then report is_available() = False).
        self._soffice_path: str | None = None

    def _find_soffice(self) -> str | None:
        if self._soffice_path:
            return self._soffice_path
        path = shutil.which("soffice")
        if path:
            self._soffice_path = path
        return path

    async def is_available(self) -> bool:
        # soffice must be installed and on PATH. If not, we just
        # don't appear in the cascade — the next adapter takes over.
        return self._find_soffice() is not None

    async def convert(
        self,
        pdf_bytes: bytes,
        output_format: OutputFormat = "docx",
        filename_hint: str = "document.pdf",
    ) -> AdapterResult:
        soffice = self._find_soffice()
        if not soffice:
            raise ConversionError(
                "LibreOffice (soffice) not installed on server",
                adapter_name=self.name,
                retryable=False,  # missing dep, won't help to retry
            )

        lo_target = LO_OUTPUT_MAP.get(output_format)
        if not lo_target:
            raise ConversionError(
                f"LibreOffice doesn't support output_format={output_format!r}",
                adapter_name=self.name,
                retryable=False,
            )

        # Semaphore — cap concurrent conversions to avoid OOM.
        async with self._semaphore:
            return await self._do_convert(
                soffice, lo_target, pdf_bytes, output_format, filename_hint
            )

    async def _do_convert(
        self,
        soffice: str,
        lo_target: str,
        pdf_bytes: bytes,
        output_format: str,
        filename_hint: str,
    ) -> AdapterResult:
        t0 = time.time()
        # Use a unique temp dir per conversion. soffice needs its
        # own user profile dir; if two run in parallel with the same
        # profile, one will fail with "X11 error" or similar.
        with tempfile.TemporaryDirectory(prefix="lo-") as tmpdir:
            tmppath = Path(tmpdir)
            in_file = tmppath / "input.pdf"
            in_file.write_bytes(pdf_bytes)
            out_dir = tmppath / "out"
            out_dir.mkdir()

            # The command. Note:
            # - --headless: no UI
            # - --norestore / --nologo: don't try to recover sessions
            # - --nodefault / --nofirststartwizard: skip setup wizard
            # - --convert-to <fmt>: do the conversion
            # - --outdir <dir>: where to write the output
            # - explicit user profile via -env:UserInstallation prevents
            #   conflicts when multiple soffice run simultaneously.
            cmd = [
                soffice,
                "--headless",
                "--norestore",
                "--nologo",
                "--nodefault",
                "--nofirststartwizard",
                f"-env:UserInstallation=file://{tmppath / 'profile'}",
                "--convert-to", lo_target,
                "--outdir", str(out_dir),
                str(in_file),
            ]

            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            except FileNotFoundError as exc:
                # shutil.which said it was there but exec failed.
                # Shouldn't happen but defensive.
                self._soffice_path = None  # reset cache
                raise ConversionError(
                    f"soffice not executable: {exc}",
                    adapter_name=self.name,
                    retryable=False,
                ) from exc

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=self._timeout_s
                )
            except asyncio.TimeoutError as exc:
                # soffice hung — kill the process and try the next
                # adapter. Don't retry this one.
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
                try:
                    await proc.wait()
                except Exception:
                    pass
                raise ConversionError(
                    f"LibreOffice timed out after {self._timeout_s}s",
                    adapter_name=self.name,
                    retryable=False,  # retrying will just hang again
                ) from exc

            if proc.returncode != 0:
                err_text = (stderr or b"").decode("utf-8", errors="replace")[:500]
                raise ConversionError(
                    f"soffice exited {proc.returncode}: {err_text}",
                    adapter_name=self.name,
                    retryable=True,
                )

            # soffice names the output after the input basename.
            # The output format determines the extension.
            ext_map = {"docx": ".docx", "xlsx": ".xlsx", "pptx": ".pptx"}
            out_file = out_dir / f"input{ext_map[output_format]}"
            if not out_file.exists():
                # Some LibreOffice versions may emit a different
                # basename. List the dir and pick the first non-input file.
                candidates = [
                    f for f in out_dir.iterdir() if f.suffix == ext_map[output_format]
                ]
                if not candidates:
                    raise ConversionError(
                        f"soffice succeeded but output file not found "
                        f"in {out_dir}. stderr={err_text}",
                        adapter_name=self.name,
                        retryable=True,
                    )
                out_file = candidates[0]

            out_bytes = out_file.read_bytes()

        elapsed_ms = int((time.time() - t0) * 1000)
        mime, ext = _mime_and_ext(output_format)
        return AdapterResult(
            bytes=out_bytes,
            mime_type=mime,
            file_extension=ext,
            adapter_name=self.name,
            elapsed_ms=elapsed_ms,
            pages_converted=0,  # soffice doesn't surface page count
            cost_usd=0.0,  # self-hosted = no per-conversion cost
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
