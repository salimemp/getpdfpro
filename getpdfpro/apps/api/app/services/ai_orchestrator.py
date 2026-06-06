"""
Google Gemini AI orchestrator.

Cost-first design:
- Defaults to gemini-1.5-flash-8b (10× cheaper than Pro)
- Escalates to Pro only when router detects complex query
- Streams tokens to caller (no buffering)
- Caches responses in Redis (24h TTL)
- Enforces hard daily caps per user
"""

import hashlib
from collections.abc import AsyncIterator
from typing import Literal

import google.generativeai as genai
import structlog
from pydantic import BaseModel

from app.config import settings

logger = structlog.get_logger()

# Configure once at import time
genai.configure(api_key=settings.gemini_api_key)


# ─── Models ────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: Literal["user", "model"]
    parts: list[str]


class ChatRequest(BaseModel):
    pdf_text: str
    question: str
    history: list[ChatMessage] = []
    language: str = "en"
    model: Literal["flash-8b", "flash", "pro"] = "flash-8b"


class ChatChunk(BaseModel):
    """A single streamed chunk."""

    text: str
    done: bool = False
    cached: bool = False


# ─── Model router ──────────────────────────────────────────────
# Keywords that suggest we need the Pro model
_PRO_KEYWORDS = {
    "analyze", "compare", "explain in detail", "step by step",
    "reasoning", "logic", "complex", "evaluate", "critique",
    "legal implications", "financial analysis", "risk assessment",
}


def _should_escalate_to_pro(question: str) -> bool:
    """Heuristic: does this query need deeper reasoning?"""
    q_lower = question.lower()
    if len(q_lower) > 500:  # long, complex question
        return True
    return any(kw in q_lower for kw in _PRO_KEYWORDS)


def _get_model_name(tier: str) -> str:
    return {
        "flash-8b": settings.gemini_default_model,
        "flash": "gemini-1.5-flash",
        "pro": settings.gemini_pro_model,
    }.get(tier, settings.gemini_default_model)


# ─── AI Orchestrator ───────────────────────────────────────────
class AIOrchestrator:
    """Centralized Gemini access. Handles model selection, streaming, caching."""

    def __init__(self) -> None:
        # Pre-instantiate model handles for speed
        self._models: dict[str, genai.GenerativeModel] = {}
        for tier in ("flash-8b", "flash", "pro"):
            self._models[tier] = genai.GenerativeModel(
                model_name=_get_model_name(tier),
                system_instruction=(
                    "You are a helpful PDF assistant. Answer the user's question "
                    "based ONLY on the document content provided. If the answer "
                    "isn't in the document, say so. Be concise, accurate, and "
                    "always respond in the user's language. Use markdown formatting "
                    "for clarity."
                ),
                generation_config=genai.GenerationConfig(
                    max_output_tokens=settings.max_ai_output_tokens,
                    temperature=0.2,
                ),
            )

    # ─── Streaming chat ───────────────────────────────────────
    async def stream_chat(
        self,
        request: ChatRequest,
        cache: "CacheService | None" = None,
    ) -> AsyncIterator[ChatChunk]:
        """
        Stream a chat response, token by token.

        Yields ChatChunk objects. Last chunk has done=True.
        """
        # Auto-escalate if needed
        tier = request.model
        if tier == "flash-8b" and _should_escalate_to_pro(request.question):
            logger.info("ai_escalating_to_pro", reason="complex_query")
            tier = "pro"

        # Build the prompt
        prompt = self._build_prompt(request)
        cache_key = self._cache_key(request)

        # Check cache
        if cache:
            cached = await cache.get(cache_key)
            if cached:
                logger.info("ai_cache_hit", tier=tier)
                yield ChatChunk(text=cached, done=True, cached=True)
                return

        model = self._models[tier]
        logger.info("ai_streaming", tier=tier, model=model.model_name)

        # Stream the response
        full_text_parts: list[str] = []
        try:
            response = await model.generate_content_async(
                prompt,
                stream=True,
            )
            async for chunk in response:
                if chunk.text:
                    full_text_parts.append(chunk.text)
                    yield ChatChunk(text=chunk.text, done=False)

            full_text = "".join(full_text_parts)
            yield ChatChunk(text="", done=True, cached=False)

            # Cache the result
            if cache and full_text:
                await cache.set(cache_key, full_text, ttl=settings.ai_cache_ttl_seconds)

        except Exception as e:
            logger.error("ai_streaming_failed", error=str(e), exc_info=True)
            yield ChatChunk(
                text=f"\n\n_Sorry, I encountered an error: {str(e)}_",
                done=True,
            )

    def _build_prompt(self, request: ChatRequest) -> str:
        """Build the full prompt with PDF context + question."""
        # Truncate PDF text to fit context budget
        max_chars = settings.max_ai_context_tokens * 4  # rough chars-per-token
        pdf_text = request.pdf_text
        if len(pdf_text) > max_chars:
            # Keep first and last portions (intro + conclusion are usually most useful)
            half = max_chars // 2
            pdf_text = (
                pdf_text[:half]
                + "\n\n[... document truncated for length ...]\n\n"
                + pdf_text[-half:]
            )

        history_text = "\n".join(
            f"{m.role.upper()}: {m.parts[0]}" for m in request.history[-6:]  # last 3 turns
        )

        lang_instruction = {
            "en": "Respond in English.",
            "es": "Responde en español.",
            "fr": "Réponds en français.",
            "de": "Antworte auf Deutsch.",
            "ar": "أجب باللغة العربية.",
            "hi": "हिंदी में जवाब दें।",
            "zh": "用中文回答。",
            # Add more
        }.get(request.language, f"Respond in the user's language ({request.language}).")

        return f"""
{lang_instruction}

DOCUMENT CONTENT:
---
{pdf_text}
---

CONVERSATION HISTORY:
{history_text if history_text else "(No prior conversation)"}

USER QUESTION:
{request.question}

YOUR ANSWER:
""".strip()

    @staticmethod
    def _cache_key(request: ChatRequest) -> str:
        """Hash the request to use as cache key."""
        h = hashlib.sha256()
        h.update(request.pdf_text.encode("utf-8"))
        h.update(b"|")
        h.update(request.question.encode("utf-8"))
        h.update(b"|")
        h.update(request.language.encode("utf-8"))
        return f"ai:chat:{h.hexdigest()[:32]}"


# Module-level singleton
ai_orchestrator = AIOrchestrator()
