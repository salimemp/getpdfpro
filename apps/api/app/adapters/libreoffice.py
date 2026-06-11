"""LibreOffice adapter — tier 2 (self-hosted, free, good quality).

Uses the **UNO bridge** (python3-uno) to talk to a long-running
soffice listener (started by start.sh on 127.0.0.1:2002). This
bypasses the broken `soffice --headless --convert-to` CLI save
path entirely. The pattern is from the proven hdejager/
libreoffice-api recipe (67 stars, widely deployed) plus the well-
tested unoconv/Python-UNO-bridge approach.

Why this works when the CLI doesn't:
  - The CLI's `--convert-to` save path uses soffice's OLE-package
    write code, which has a 0xc10 (E_AGAIN) bug on slim Docker
    images — saves silently fail, output dir is empty, exit code
    is 0, stderr is just a warning.
  - The UNO API gives us direct access to the same in-process
    document model. We call storeToURL with an explicit
    MediaType/FilterName and the document's own internal save path
    (different code path, different bug surface).
  - The listener is started once at container boot, not per
    conversion, so we get one well-formed soffice process with a
    clean user profile.

This adapter is "ideal but optional" — if soffice + UNO bridge
isn't available (image without libreoffice package, or listener
not up), is_available() returns False and the cascade falls
through to Local cleanly. No more debug cruft; no more 0xc10
stack traces leaking to users.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import socket
import tempfile
import time
from pathlib import Path

from . import AdapterResult, ConversionAdapter, ConversionError, OutputFormat

# Default conversion timeout. The UNO call is fast (<5s for most
# PDFs), but malformed PDFs can hang. 60s is generous.
DEFAULT_TIMEOUT_S = 60.0

# Default max concurrent UNO calls. The listener can handle many
# concurrently; we cap to avoid OOM on the slim container.
DEFAULT_MAX_CONCURRENCY = 4

# UNO bridge connection. Listener runs on localhost:2002 per the
# Dockerfile start.sh.
UNO_HOST = os.getenv("UNO_HOST", "localhost")
UNO_PORT = int(os.getenv("UNO_PORT", "2002"))


class LibreOfficeAdapter:
    name = "libreoffice"
    description = (
        "Self-hosted LibreOffice via UNO bridge. 90-95% layout fidelity. "
        "Always free, no per-conversion cost."
    )
    quality_score = 92

    def __init__(self) -> None:
        self._timeout_s = float(os.getenv("LIBREOFFICE_TIMEOUT_S", DEFAULT_TIMEOUT_S))
        self._max_conc = int(os.getenv("LIBREOFFICE_MAX_CONCURRENCY", DEFAULT_MAX_CONCURRENCY))
        self._semaphore: asyncio.Semaphore | None = None
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
        # Two requirements: soffice binary installed AND a UNO listener
        # is reachable on the configured port.
        if not self._find_soffice():
            return False
        return await asyncio.to_thread(_port_open, UNO_HOST, UNO_PORT, timeout_s=1.0)

    def _get_semaphore(self) -> asyncio.Semaphore:
        # Lazily create the semaphore inside the running event loop.
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self._max_conc)
        return self._semaphore

    async def convert(
        self,
        pdf_bytes: bytes,
        output_format: OutputFormat = "docx",
        filename_hint: str = "document.pdf",
    ) -> AdapterResult:
        # 1. Validate output format
        UNO_OUTPUT_FILTER = {
            "docx": "MS Word 2007 XML",
            "xlsx": "Calc Office Open XML",
            "pptx": "Impress Office Open XML",
        }
        filter_name = UNO_OUTPUT_FILTER.get(output_format)
        if not filter_name:
            raise ConversionError(
                f"LibreOffice doesn't support output_format={output_format!r}",
                adapter_name=self.name,
                retryable=False,
            )

        # 2. Validate the UNO listener is reachable. If not, raise
        #    retryable=True so the cascade falls through to Local.
        if not await self.is_available():
            raise ConversionError(
                f"LibreOffice UNO listener not reachable at "
                f"{UNO_HOST}:{UNO_PORT}",
                adapter_name=self.name,
                retryable=True,
            )

        sem = self._get_semaphore()
        t0 = time.time()

        async with sem:
            try:
                out_bytes = await asyncio.wait_for(
                    asyncio.to_thread(
                        _uno_convert,
                        pdf_bytes,
                        output_format,
                        filter_name,
                        UNO_HOST,
                        UNO_PORT,
                    ),
                    timeout=self._timeout_s,
                )
            except asyncio.TimeoutError as exc:
                raise ConversionError(
                    f"LibreOffice timed out after {self._timeout_s}s",
                    adapter_name=self.name,
                    retryable=False,
                ) from exc
            except ConversionError:
                # Re-raise as-is so the cascade sees the right error.
                raise
            except Exception as exc:
                # Anything else from the UNO bridge — log + retryable
                # so the cascade can fall through to Local.
                raise ConversionError(
                    f"LibreOffice UNO conversion failed: {type(exc).__name__}: {exc}",
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


def _port_open(host: str, port: int, timeout_s: float = 1.0) -> bool:
    """TCP probe: is anything listening on host:port?"""
    try:
        with socket.create_connection((host, port), timeout=timeout_s):
            return True
    except (OSError, socket.timeout):
        return False


def _uno_convert(
    pdf_bytes: bytes,
    output_format: str,
    filter_name: str,
    host: str,
    port: int,
) -> bytes:
    """Synchronous helper. Connects to the UNO bridge, loads the
    PDF, stores as the target Office format, reads back bytes.

    Called from asyncio.to_thread() so it doesn't block the event loop.

    The python3-uno C extension lives in /usr/lib/python3/dist-packages
    (system path), which the slim image's /usr/local/bin/python does
    NOT include by default. We patch sys.path so `import uno` works.
    """
    import sys
    for sys_path in (
        "/usr/lib/python3/dist-packages",
        "/usr/lib/python3.12/dist-packages",
    ):
        if sys_path not in sys.path and Path(sys_path).exists():
            sys.path.insert(0, sys_path)
            break

    import uno  # python3-uno
    from com.sun.star.beans import PropertyValue  # type: ignore

    with tempfile.TemporaryDirectory(prefix="uno-") as tmpdir:
        tmppath = Path(tmpdir)
        in_file = tmppath / "input.pdf"
        in_file.write_bytes(pdf_bytes)
        out_file = tmppath / f"output.{output_format}"

        # 1. Connect to the listener
        local_ctx = uno.getComponentContext()
        resolver = local_ctx.ServiceManager.createInstanceWithContext(
            "com.sun.star.bridge.UnoUrlResolver", local_ctx
        )
        ctx = resolver.resolve(
            f"uno:socket,host={host},port={port};urp;StarOffice.ComponentContext"
        )
        smgr = ctx.ServiceManager
        desktop = smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)

        # 2. Load the PDF
        # Hidden=True: keep invisible (no window)
        # ReadOnly=True: we're converting, not editing
        # FilterName=impress_pdf_import: forces the Impress PDF importer
        load_props = (
            _prop("Hidden", True),
            _prop("ReadOnly", True),
            _prop("FilterName", "impress_pdf_import"),
        )
        load_url = uno.systemPathToFileUrl(str(in_file))
        doc = desktop.loadComponentFromURL(load_url, "_blank", 0, load_props)

        if doc is None:
            raise RuntimeError("loadComponentFromURL returned None — PDF import failed")

        try:
            # 3. Store as the target Office format
            store_props = (
                _prop("FilterName", filter_name),
                _prop("Overwrite", True),
            )
            store_url = uno.systemPathToFileUrl(str(out_file))
            doc.storeToURL(store_url, store_props)
        finally:
            doc.close(True)

        # 4. Read the bytes back
        if not out_file.exists():
            raise RuntimeError(
                f"storeToURL did not produce output file at {out_file}"
            )
        return out_file.read_bytes()


def _prop(name: str, value):
    """Build a UNO com.sun.star.beans.PropertyValue. Imported lazily
    so the module is importable in environments without python3-uno
    (e.g. test runners that mock the adapter)."""
    from com.sun.star.beans import PropertyValue  # type: ignore
    p = PropertyValue()
    p.Name = name
    p.Value = value
    return p


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
