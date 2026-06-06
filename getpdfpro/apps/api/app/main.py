"""
GetPDFPro API — main FastAPI application.

Run locally:
    uvicorn app.main:app --reload --port 8000

Deploy:
    Railway auto-detects from Dockerfile.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.config import settings
from app.core.logging import configure_logging
from app.services.cache import cache_service
from app.services.storage import storage_service

# ─── Structured logging ────────────────────────────────────────
configure_logging()
logger = structlog.get_logger()


# ─── Lifespan: startup / shutdown ──────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize services on startup, close on shutdown."""
    logger.info("startup", env=settings.env, version=settings.version)

    # Initialize storage client
    await storage_service.connect()

    # Initialize cache
    await cache_service.connect()

    yield

    # Cleanup
    await storage_service.close()
    await cache_service.close()
    logger.info("shutdown")


# ─── FastAPI app ───────────────────────────────────────────────
app = FastAPI(
    title="GetPDFPro API",
    version=settings.version,
    description="Cross-platform PDF converter + editor API",
    docs_url="/docs" if settings.env != "production" else None,
    redoc_url="/redoc" if settings.env != "production" else None,
    openapi_url="/openapi.json" if settings.env != "production" else None,
    lifespan=lifespan,
)

# ─── Middleware ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ─── Routes ────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Health check for Railway / uptime monitors."""
    return {"status": "ok", "version": settings.version}


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    """API root — useful sanity check."""
    return {
        "name": "GetPDFPro API",
        "version": settings.version,
        "docs": "/docs" if settings.env != "production" else "disabled in production",
    }


# Mount v1 API
app.include_router(api_router, prefix="/api/v1")


# ─── Global exception handler ──────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception) -> JSONResponse:
    logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "Something went wrong. Please try again.",
            "request_id": request.headers.get("x-request-id"),
        },
    )
