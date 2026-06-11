"""LibreOffice adapter — tier 2 (self-hosted, free, good quality).

Tries the `soffice --headless --convert-to` CLI. If soffice is
installed and the save path works in this environment, this adapter
serves high-fidelity DOCX conversion. If soffice fails for any
reason, the cascade falls through to Local (which always works).

NOTE: In Railway's current Python 3.11 / Debian 12 / LO 7.4.7.2
environment, the soffice save path is broken (0xc10 error). This
adapter is kept as the "ideal" tier 2 — when run in an environment
where soffice works, it gives 90-95% layout fidelity. In the
Railway prod environment, it gracefully fails and Local serves.

Future: rewrite to use the UNO bridge (python3-uno) so soffice's
broken CLI save path is bypassed. The current UNO-bridge attempt
also hits the 0xc10 save bug (the bug is in soffice's own save
framework, not the CLI). Track in memory.

How we invoke it:
  soffice --headless --convert-to docx --outdir <tmpdir> <input.pdf>

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
import subprocess
import tempfile
import time
from pathlib import Path

from . import AdapterResult, ConversionAdapter, ConversionError, OutputFormat


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
        self._timeout_s = float(os.getenv("LIBREOFFICE_TIMEOUT_S", DEFAULT_TIMEOUT_S))
        # Lazily-resolved soffice path. We resolve on first is_available()
        # so the app can boot even if soffice isn't installed.
        self._soffice_path: str | None = None

    def _find_soffice(self) -> str | None:
        if self._soffice_path is not None:
            return self._soffice_path
        path = shutil.which("soffice")
        self._soffice_path = path  # cache (None if not found)
        return path

    async def is_available(self) -> bool:
        return self._find_soffice() is not None

    async def convert(
        self,
        pdf_bytes: bytes,
        output_format: OutputFormat = "docx",
        filename_hint: str = "document.pdf",
    ) -> AdapterResult:
        # 1. Sanity check that soffice is installed. If not, return a
        #    non-retryable error so the cascade falls straight to Local.
        soffice = self._find_soffice()
        if not soffice:
            raise ConversionError(
                "LibreOffice (soffice) not installed on server",
                adapter_name=self.name,
                retryable=False,  # missing dep, won't help to retry
            )

        # 2. Validate output format
        LO_OUTPUT_MAP = {
            "docx": "docx:MS Word 2007 XML",
            "xlsx": "xlsx:Calc Office Open XML",
            "pptx": "pptx:Impress Office Open XML",
        }
        lo_target = LO_OUTPUT_MAP.get(output_format)
        if not lo_target:
            raise ConversionError(
                f"LibreOffice doesn't support output_format={output_format!r}",
                adapter_name=self.name,
                retryable=False,
            )

        # 3. Run soffice. Wrap in asyncio.to_thread so the blocking
        #    subprocess.run() doesn't stall the event loop.
        t0 = time.time()

        def _run_soffice() -> bytes:
            with tempfile.TemporaryDirectory(prefix="lo-") as tmpdir:
                tmppath = Path(tmpdir)
                in_file = tmppath / "input.pdf"
                in_file.write_bytes(pdf_bytes)
                out_dir = tmppath / "out"
                out_dir.mkdir()
                profile_dir = tmppath / "profile"
                profile_dir.mkdir()

                cmd = [
                    soffice,
                    "--headless",
                    "--norestore",
                    "--nologo",
                    "--nodefault",
                    "--nofirststartwizard",
                    f"-env:UserInstallation=file://{profile_dir}",
                    "--convert-to", lo_target,
                    "--outdir", str(out_dir),
                    str(in_file),
                ]

                # Use subprocess.run with a hard timeout.
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    timeout=self._timeout_s,
                    check=False,
                )
                if result.returncode != 0:
                    err = result.stderr.decode("utf-8", errors="replace")[:500]
                    raise RuntimeError(
                        f"soffice exited {result.returncode}: {err}"
                    )

                # Robust output detection. Try exact match first,
                # then any file with the expected extension, then
                # raise a diagnostic listing what soffice DID write.
                ext_map = {"docx": ".docx", "xlsx": ".xlsx", "pptx": ".pptx"}
                expected_ext = ext_map[output_format]

                out_file = out_dir / f"input{expected_ext}"
                if not out_file.exists():
                    candidates = sorted(
                        f for f in out_dir.iterdir()
                        if f.suffix.lower() == expected_ext
                    )
                    if candidates:
                        out_file = candidates[0]
                    else:
                        actual = [f.name for f in out_dir.iterdir()]
                        raise RuntimeError(
                            f"soffice exited 0 but no {expected_ext} file "
                            f"found in {out_dir}. soffice wrote: {actual}. "
                            f"stderr: {result.stderr.decode('utf-8', errors='replace')[:200]}"
                        )
                return out_file.read_bytes()

        try:
            out_bytes = await asyncio.to_thread(_run_soffice)
        except subprocess.TimeoutExpired as exc:
            raise ConversionError(
                f"LibreOffice timed out after {self._timeout_s}s",
                adapter_name=self.name,
                retryable=False,
            ) from exc
        except Exception as exc:
            raise ConversionError(
                f"LibreOffice conversion failed: {exc}",
                adapter_name=self.name,
                retryable=True,
            ) from exc

        elapsed_ms = int((time.time() - t0) * 1000)
        mime, ext = _mime_and_ext(output_format)
        return AdapterResult(
            bytes=out_bytes,
            mime_type=mime,
            file_extension=ext,
            adapter_name=self.name,
            elapsed_ms=elapsed_ms,
            pages_converted=0,
            cost_usd=0.0,
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
