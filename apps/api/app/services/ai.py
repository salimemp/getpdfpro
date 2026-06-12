"""AI service — thin wrapper around Google Gemini for the PDF
summarize and PDF translate tools.

Two operations live here:

  - summarize_text(text, length) -> str
      Asks Gemini to produce a summary of `text` at the requested
      length. Uses the configured Gemini model
      (settings.gemini_model = 'gemini-1.5-flash-8b' by default).
      If the text is very long, it's split into chunks and each
      chunk is summarized, then a final synthesis pass combines
      the chunk summaries.

  - translate_text(text, source_lang, target_lang) -> str
      Same chunking strategy. Outputs a plain text translation.

Both operations are stateless, sync (Gemini HTTP is fast enough for
the volumes we deal with — a 50-page PDF is ~50KB of text, well
under Gemini's 1M-token context window), and JSON-returning.

If GEMINI_API_KEY is not configured, the wrappers raise a clean
503. The endpoints surface this as a clear "AI features require
configuration" error.

The "always-available" model: flash-8b is free tier, fast, and
adequate for both summarization and translation. We can swap to
Pro for paid users later (settings.gemini_pro_model is already
in config).
"""

from __future__ import annotations

import logging
import time
from typing import Literal

logger = logging.getLogger(__name__)


# Gemini's context window for flash-8b is 1M tokens. We cap
# chunks at 8000 tokens (~30KB of text) for safety + to keep
# response latency low. The chunking is by character count with
# paragraph-boundary preference.
CHUNK_CHAR_LIMIT = 30_000  # ~8K tokens for English text
MAX_OUTPUT_TOKENS_SUMMARY = 1024
MAX_OUTPUT_TOKENS_TRANSLATE = 4096  # translations can be long


# ─── module-level state ────────────────────────────────────────
_model = None
_model_name: str | None = None
_api_key_configured: bool | None = None


def is_configured() -> bool:
    """Return True if GEMINI_API_KEY is set."""
    global _api_key_configured
    if _api_key_configured is None:
        from app.config import get_settings
        _api_key_configured = bool(get_settings().gemini_api_key.strip())
    return _api_key_configured


def _get_model():
    """Lazily initialize the Gemini model. Returns the model object."""
    global _model, _model_name
    if _model is not None:
        return _model
    if not is_configured():
        raise AiNotConfiguredError(
            "GEMINI_API_KEY is not set on the server. The AI features "
            "(Summarize, Translate) require a configured Gemini API key."
        )
    import google.generativeai as genai
    from app.config import get_settings
    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key.strip())
    _model_name = settings.gemini_model
    _model = genai.GenerativeModel(_model_name)
    return _model


class AiNotConfiguredError(Exception):
    """Raised when Gemini is not configured. Surface as 503 to the user."""
    pass


class AiError(Exception):
    """Raised when the AI call fails for any other reason."""
    pass


# ─── text chunking ────────────────────────────────────────────
def _chunk_text(text: str, limit: int = CHUNK_CHAR_LIMIT) -> list[str]:
    """Split text into chunks of at most `limit` characters.

    Splits on paragraph boundaries (double newline) where possible.
    If a single paragraph is longer than the limit, splits on
    single newlines. If a single line is longer than the limit,
    splits on periods (last resort).
    """
    text = text.strip()
    if not text:
        return []
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    paragraphs = text.split("\n\n")
    cur = ""
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if len(cur) + len(p) + 2 <= limit:
            cur = (cur + "\n\n" + p) if cur else p
        else:
            if cur:
                chunks.append(cur)
                cur = ""
            # If a single paragraph is huge, split it further.
            if len(p) > limit:
                lines = p.split("\n")
                cur = ""
                for line in lines:
                    if len(cur) + len(line) + 1 <= limit:
                        cur = (cur + "\n" + line) if cur else line
                    else:
                        if cur:
                            chunks.append(cur)
                            cur = ""
                        if len(line) > limit:
                            # Hard split on sentences
                            sentences = line.split(". ")
                            cur = ""
                            for s in sentences:
                                if len(cur) + len(s) + 2 <= limit:
                                    cur = (cur + ". " + s) if cur else s
                                else:
                                    if cur:
                                        chunks.append(cur.rstrip(". ") + ".")
                                    cur = s
                        else:
                            cur = line
            else:
                cur = p
    if cur:
        chunks.append(cur)
    return chunks


# ─── Summarize ────────────────────────────────────────────────
def summarize_text(
    text: str,
    length: Literal["short", "medium", "long", "bullets"] = "medium",
    language: str = "en",
) -> str:
    """Summarize `text` at the requested length, in the given output language.

    length:
      - "short":  ~50 words
      - "medium": ~200 words
      - "long":   ~500 words
      - "bullets": 5-10 bullet points
    language: ISO 639-1 code for the output language (e.g. "en", "es")
    """
    model = _get_model()
    chunks = _chunk_text(text)
    if not chunks:
        return ""
    length_instructions = {
        "short": "in approximately 50 words",
        "medium": "in approximately 200 words",
        "long": "in approximately 500 words",
        "bullets": "as 5-10 concise bullet points (use '-' for each bullet)",
    }.get(length, "in approximately 200 words")
    lang_name = _lang_name(language)
    if len(chunks) == 1:
        # Single-pass summarization
        prompt = (
            f"Summarize the following document {length_instructions}. "
            f"Write the summary in {lang_name}.\n\n"
            f"--- DOCUMENT ---\n{chunks[0]}\n--- END DOCUMENT ---\n\n"
            f"Summary ({lang_name}):"
        )
        return _call_gemini(model, prompt, MAX_OUTPUT_TOKENS_SUMMARY)
    # Multi-chunk: summarize each, then synthesize.
    logger.info("Document split into %d chunks; running chunk summaries", len(chunks))
    chunk_summaries: list[str] = []
    for i, ch in enumerate(chunks):
        prompt = (
            f"Summarize PART {i + 1} of {len(chunks)} of a document {length_instructions}. "
            f"Write in {lang_name}.\n\n"
            f"--- PART {i + 1} ---\n{ch}\n--- END PART {i + 1} ---\n\n"
            f"Part {i + 1} summary ({lang_name}):"
        )
        chunk_summaries.append(_call_gemini(model, prompt, MAX_OUTPUT_TOKENS_SUMMARY))
    # Final synthesis pass
    combined = "\n\n".join(
        f"[Part {i + 1}] {s}" for i, s in enumerate(chunk_summaries)
    )
    synthesis_prompt = (
        f"You are given partial summaries of a long document. "
        f"Combine them into a single coherent summary {length_instructions}. "
        f"Write in {lang_name}. Do not duplicate information across parts. "
        f"Preserve the document's overall structure and key conclusions.\n\n"
        f"--- PART SUMMARIES ---\n{combined}\n--- END ---\n\n"
        f"Combined summary ({lang_name}):"
    )
    return _call_gemini(model, synthesis_prompt, MAX_OUTPUT_TOKENS_SUMMARY)


# ─── Translate ────────────────────────────────────────────────
def translate_text(
    text: str,
    target_lang: str = "es",
    source_lang: str | None = None,
) -> str:
    """Translate `text` to `target_lang`. Auto-detects source language
    unless `source_lang` is given.

    Returns the translated text in the same structure (paragraph
    breaks preserved).
    """
    model = _get_model()
    chunks = _chunk_text(text)
    if not chunks:
        return ""
    target_name = _lang_name(target_lang)
    source_clause = (
        f"from {_lang_name(source_lang)}" if source_lang else "(auto-detect source language)"
    )
    if len(chunks) == 1:
        prompt = (
            f"Translate the following document {source_clause} into {target_name}. "
            f"Preserve all paragraph breaks, formatting cues, and structure. "
            f"Do not add commentary or notes. Output ONLY the translation.\n\n"
            f"--- DOCUMENT ---\n{chunks[0]}\n--- END ---\n\n"
            f"Translation ({target_name}):"
        )
        return _call_gemini(model, prompt, MAX_OUTPUT_TOKENS_TRANSLATE)
    # Multi-chunk: translate each, then concat. We don't ask
    # Gemini to re-synthesize because that risks dropping
    # sentence-level fidelity.
    out: list[str] = []
    for i, ch in enumerate(chunks):
        prompt = (
            f"Translate PART {i + 1} of {len(chunks)} of a document "
            f"{source_clause} into {target_name}. Preserve paragraph breaks. "
            f"Output ONLY the translation, no commentary.\n\n"
            f"--- PART {i + 1} ---\n{ch}\n--- END PART {i + 1} ---\n\n"
            f"Part {i + 1} translation ({target_name}):"
        )
        out.append(_call_gemini(model, prompt, MAX_OUTPUT_TOKENS_TRANSLATE))
    return "\n\n".join(out)


# ─── Internals ────────────────────────────────────────────────
def _call_gemini(model, prompt: str, max_output_tokens: int) -> str:
    """Run a single Gemini call with retry on transient errors."""
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
    import google.generativeai as genai

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((genai.types.generation_types.BlockedPromptException,)),
        reraise=False,
    )
    def _do_call() -> str:
        generation_config = genai.types.GenerationConfig(
            max_output_tokens=max_output_tokens,
            temperature=0.2,
        )
        resp = model.generate_content(prompt, generation_config=generation_config)
        if not resp.text:
            # Could be a safety block
            try:
                feedback = resp.prompt_feedback
                reason = feedback.block_reason if feedback else "unknown"
            except Exception:
                reason = "unknown"
            raise AiError(f"Gemini returned no text (reason: {reason})")
        return resp.text.strip()

    t0 = time.time()
    try:
        out = _do_call()
        logger.info(
            "Gemini call OK in %.2fs (model=%s, in_chars=%d, out_chars=%d)",
            time.time() - t0, _model_name, len(prompt), len(out),
        )
        return out
    except genai.types.generation_types.BlockedPromptException as exc:
        raise AiError(
            "The document was blocked by Gemini's safety filters. "
            "Try a different document."
        ) from exc
    except Exception as exc:
        if isinstance(exc, AiError):
            raise
        logger.exception("Gemini call failed")
        raise AiError(f"AI service error: {exc}") from exc


def _lang_name(code: str) -> str:
    """Map a 2-letter ISO code to a friendly name for prompts."""
    return {
        "en": "English",
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
        "ru": "Russian",
        "ja": "Japanese",
        "ko": "Korean",
        "zh": "Chinese",
        "hi": "Hindi",
        "ar": "Arabic",
        "bn": "Bengali",
        "ta": "Tamil",
        "tr": "Turkish",
        "vi": "Vietnamese",
        "th": "Thai",
        "pl": "Polish",
        "nl": "Dutch",
        "sv": "Swedish",
    }.get(code.lower(), code)
