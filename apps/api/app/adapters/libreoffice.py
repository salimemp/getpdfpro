"""LibreOffice adapter — tier 2 (self-hosted, free, good quality).

Uses the **UNO bridge** (python3-uno) instead of the broken
`soffice --headless --convert-to docx` CLI. Six attempts at the CLI
save path failed with `0xc10` (SfxBaseModel::impl_store) on both
Debian 12 and Debian 13, both LO 7.x and LO 25.x. The UNO bridge
bypasses that broken path entirely by talking to soffice over its
own socket protocol.

Architecture:
  - One long-running soffice listener process per container.
    Started by Dockerfile CMD (via start.sh) on port 2002.
    Accepts UNO connections from Python via python3-uno.
  - The adapter is a thin client. Each convert() call:
      1. Connect to localhost:2002 (UNO bridge)
      2. Load the input PDF as a Draw/Impress document
      3. Store the document as DOCX (Word 2007 XML) into a tmp file
      4. Read the bytes back, return as AdapterResult
  - No per-call soffice process spawn. No 1-2s cold start per call.
  - The listener can handle many concurrent calls (we add an
    asyncio.Semaphore to be safe).

What we install in the image:
  - libreoffice-core, -writer, -impress, -common (for the binary
    and the Java-implemented Impress PDF importer that does the
    actual PDF read)
  - libreoffice-script-provider-python (so soffice can run
    Python macros if needed)
  - python3-uno (the UNO bridge client library)
  - default-jre-headless (Java for the soffice JVM, not strictly
    required for headless docx export but javaldx warns if absent)

Trade-offs vs the CLI:
  - + Bypasses the broken CLI save path; should actually work
  - + Faster (no per-call process spawn; ~50-200ms per call)
  - + Cleaner error reporting (UNO exceptions have stack traces)
  - - More code; more moving parts
  - - Single point of failure (the listener); if it dies, all
    conversions fail until Railway restarts the container
  - - Slightly larger image (script-provider-python is small, but
    the listener has to be in start.sh)
"""

from __future__ import annotations

import asyncio
import os
import shutil
import socket
import tempfile
import threading
import time
from pathlib import Path

from . import AdapterResult, ConversionAdapter, ConversionError, OutputFormat

# Default conversion timeout. The UNO call itself is fast (<5s for
# most PDFs), but malformed PDFs can hang. 60s is generous.
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
            except Exception as exc:
                # Anything from the UNO bridge — log full traceback
                # via the conversion error message; the cascade can
                # fall through to Local.
                import traceback
                tb = traceback.format_exc()
                raise ConversionError(
                    f"LibreOffice UNO conversion failed: {type(exc).__name__}: {exc}\n{tb[:300]}",
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

    Why the per-call local-context bridge: python3-uno is a C
    extension that, when imported, looks for a UNO listener and
    bootstraps a UNO context. We do that once per thread invocation
    (cheap; ~50ms). Each Python process (the FastAPI worker) has
    its own bridge connection to the listener.
    """
    import sys
    # python3-uno installs to /usr/lib/python3/dist-packages (system
    # Python path). The base image's Python (from python:3.11-slim)
    # is at /usr/local/bin/python and does NOT include that on its
    # default sys.path. Add it explicitly so `import uno` works.
    for sys_path in (
        "/usr/lib/python3/dist-packages",
        "/usr/lib/python3.11/dist-packages",
    ):
        if sys_path not in sys.path and Path(sys_path).exists():
            sys.path.insert(0, sys_path)
            break

    import uno  # python3-uno; only present if the apt package is installed
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
        # Hidden=True keeps the document invisible (we don't need a
        # window). ReadOnly=True because we're converting, not editing.
        # FilterName=PDF:impress forces the Impress PDF importer.
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
    """Build a UNO com.sun.star.beans.PropertyValue (the 'Property' type
    soffice uses for option bags). python3-uno exposes this as
    com.sun.star.beans.PropertyValue. Done here so we don't have to
    import the type at module top level (which would fail in test
    environments without python3-uno)."""
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
