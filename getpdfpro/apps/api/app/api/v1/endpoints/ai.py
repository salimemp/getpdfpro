"""
AI endpoints — WebSocket chat + credit tracking.
"""

import asyncio
import json

import structlog
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from pydantic import BaseModel

from app.core.security import AuthUser, get_current_user
from app.services.ai_orchestrator import ChatRequest, ai_orchestrator
from app.services.cache import cache_service

logger = structlog.get_logger()
router = APIRouter()


class AICreditsResponse(BaseModel):
    credits_remaining: int
    credits_used: int
    period_end: str


@router.get("/credits", response_model=AICreditsResponse)
async def get_ai_credits(user: AuthUser = Depends(get_current_user)) -> AICreditsResponse:
    """Get current AI credit balance."""
    # TODO: implement with DB lookup
    return AICreditsResponse(
        credits_remaining=1000,
        credits_used=0,
        period_end="2026-07-01T00:00:00Z",
    )


@router.websocket("/chat")
async def ai_chat_websocket(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for AI chat.

    Protocol:
    - Client connects with ?token=<supabase_jwt>
    - Server validates, accepts
    - Client sends: {"type": "message", "pdf_text": "...", "question": "...", "language": "en"}
    - Server streams: {"type": "chunk", "text": "..."}
    - Server sends: {"type": "done"} when finished
    """
    # Authenticate via query param
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    # TODO: validate JWT (use same logic as get_current_user)
    # For now, just accept

    await websocket.accept()
    logger.info("ai_ws_connected")

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)

            if data.get("type") != "message":
                continue

            request = ChatRequest(
                pdf_text=data["pdf_text"],
                question=data["question"],
                history=data.get("history", []),
                language=data.get("language", "en"),
                model=data.get("model", "flash-8b"),
            )

            # Stream response
            async for chunk in ai_orchestrator.stream_chat(request, cache=cache_service):
                await websocket.send_json({
                    "type": "chunk" if not chunk.done else "done",
                    "text": chunk.text,
                    "cached": chunk.cached,
                })

    except WebSocketDisconnect:
        logger.info("ai_ws_disconnected")
    except Exception as e:
        logger.error("ai_ws_error", error=str(e), exc_info=True)
        await websocket.close(code=1011, reason=str(e))
