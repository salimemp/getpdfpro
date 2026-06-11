"""Adapter interface for PDF → Office conversion.

Three implementations exist (see submodules). All conform to this
Protocol-style interface. No inheritance required — duck typing.

Why duck typing: simpler than ABCs, easier to test, no metaclass
surprises. The interface is documented in the docstring + type hints.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


# Output formats we currently support. Add more (xlsx, pptx) by
# extending this literal and the per-adapter `convert()` branches.
OutputFormat = str  # "docx" | "xlsx" | "pptx"


@dataclass
class AdapterResult:
    """Result of a successful conversion."""

    bytes: bytes  # the output file (.docx, .xlsx, .pptx)
    mime_type: str  # e.g. "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    file_extension: str  # e.g. "docx" (without leading dot)
    # Which adapter served this request. Set by each adapter's convert()
    # method. The router uses this to set the X-Conversion-Adapter
    # response header.
    adapter_name: str = ""
    # Optional metadata about the conversion
    elapsed_ms: int = 0
    pages_converted: int = 0
    # If the adapter charged money (CloudConvert), record it for cost
    # analytics. None for free adapters.
    cost_usd: float | None = None


class ConversionAdapter(Protocol):
    """Interface every PDF → Office adapter implements.

    An adapter is responsible for one thing: take a PDF and produce
    the requested Office format. It does NOT handle:
      - HTTP serving (the router does that)
      - Quota / tier checks (the router does that)
      - Filename generation (the router does that)
    """

    # Short identifier for logs and X-Conversion-Adapter header.
    # e.g. "adobe", "cloudconvert", "local"
    name: str

    # Human-readable description (used in /docs)
    description: str

    # Quality score 0-100. Used to log which adapter was used.
    # Higher = better. (Marketing copy, not enforced.)
    quality_score: int

    async def is_available(self) -> bool:
        """Return True if the adapter can be used right now.

        Checks configured credentials, free-tier quota remaining, etc.
        Cheap to call (no I/O). Used by the cascade to pick the next
        adapter.
        """
        ...

    async def convert(
        self,
        pdf_bytes: bytes,
        output_format: OutputFormat = "docx",
        filename_hint: str = "document.pdf",
    ) -> AdapterResult:
        """Convert PDF bytes to the requested Office format.

        Args:
            pdf_bytes: the source PDF (already size-checked by the router)
            output_format: "docx" | "xlsx" | "pptx"
            filename_hint: source filename for the upload, used to name
                the output (e.g. "contract.pdf" → "contract.docx")

        Returns:
            AdapterResult with the converted file bytes + metadata.

        Raises:
            ConversionError: if the conversion failed. The cascade
                will catch this and try the next adapter.
        """
        ...


class ConversionError(Exception):
    """Raised when an adapter fails to convert a document.

    The cascade catches this, logs it, and tries the next adapter.
    The user only sees the final error if ALL adapters fail.
    """

    def __init__(
        self,
        message: str,
        adapter_name: str = "",
        cause: Exception | None = None,
        retryable: bool = True,
    ) -> None:
        super().__init__(message)
        self.adapter_name = adapter_name
        self.cause = cause
        # retryable=False means "don't fall back" — e.g. user input
        # was bad, no point trying another adapter. The cascade will
        # surface this immediately.
        self.retryable = retryable
