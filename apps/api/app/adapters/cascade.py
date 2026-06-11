"""3-tier cascade for PDF → Office conversion.

Picks the first available adapter (Adobe → LibreOffice → Local).
If the chosen adapter raises a retryable ConversionError, falls
through to the next. The user only sees an error if ALL adapters
fail (or if the input was bad and the error is non-retryable).
"""

from __future__ import annotations

import logging

from . import (
    AdapterResult,
    ConversionAdapter,
    ConversionError,
    OutputFormat,
)
from .adobe import AdobeAdapter
from .libreoffice import LibreOfficeAdapter
from .local import LocalAdapter

logger = logging.getLogger(__name__)


class ConversionCascade:
    """Holds the configured adapters in priority order. Stateless
    apart from a singleton instance for the FastAPI dependency."""

    def __init__(self) -> None:
        # Tier 1 (best quality, free up to 500/mo): Adobe PDF Services
        # Tier 2 (very good quality, free, self-hosted): LibreOffice
        # Tier 3 (always works, best-effort quality): Local
        # CloudConvert is no longer in the cascade — LibreOffice
        # replaces it (free, no per-conversion cost, similar quality).
        self.adapters: list[ConversionAdapter] = [
            AdobeAdapter(),
            LibreOfficeAdapter(),
            LocalAdapter(),
        ]

    async def convert(
        self,
        pdf_bytes: bytes,
        output_format: OutputFormat = "docx",
        filename_hint: str = "document.pdf",
    ) -> AdapterResult:
        """Run the cascade. Returns the first successful result, or
        raises ConversionError if all retryable attempts fail.

        The chosen adapter is logged at INFO so cost analytics can
        see the split. The 'local' fallback fires only when the
        first two are unavailable or have all failed.
        """
        tried: list[str] = []
        last_error: ConversionError | None = None

        for adapter in self.adapters:
            if not await adapter.is_available():
                continue
            tried.append(adapter.name)
            try:
                result = await adapter.convert(
                    pdf_bytes, output_format, filename_hint
                )
                logger.info(
                    "Conversion OK: adapter=%s, format=%s, "
                    "size_bytes=%d, elapsed_ms=%d, cost_usd=%s",
                    adapter.name,
                    output_format,
                    len(result.bytes),
                    result.elapsed_ms,
                    result.cost_usd,
                )
                return result
            except ConversionError as exc:
                last_error = exc
                logger.warning(
                    "Conversion FAILED: adapter=%s, retryable=%s, msg=%s",
                    adapter.name,
                    exc.retryable,
                    str(exc),
                )
                if not exc.retryable:
                    # Bad input or unsupported format. Don't try the
                    # other adapters — they can't help.
                    raise
                # Otherwise: try the next adapter in the cascade.
                continue

        # All adapters exhausted. Surface the last error.
        if last_error:
            raise last_error
        # No adapter was even available (no credentials at all).
        raise ConversionError(
            "No PDF→Office adapter is configured. "
            "Set ADOBE_CLIENT_ID/SECRET (or install LibreOffice via Dockerfile).",
            adapter_name="cascade",
            retryable=False,
        )


# Singleton — the FastAPI dependency just returns this.
_cascade: ConversionCascade | None = None


def get_cascade() -> ConversionCascade:
    global _cascade
    if _cascade is None:
        _cascade = ConversionCascade()
    return _cascade
