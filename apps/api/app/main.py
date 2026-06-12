"""FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import ai_tools, billing, compliance, debug, extract, jobs, ocr, office, organize, pdf, render, repair, security, watermark

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    settings = get_settings()
    logger.info("Starting GetPDFPro API (env=%s)", settings.env)
    yield
    logger.info("Shutting down GetPDFPro API")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="GetPDFPro API",
        description="PDF processing, AI integration, and queue management.",
        version="0.1.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # CORS — lock down to the real web app domains
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(pdf.router, prefix="/api/v1/pdf", tags=["pdf"])
    app.include_router(ocr.router, prefix="/api/v1/pdf", tags=["ocr"])
    app.include_router(repair.router, prefix="/api/v1/pdf", tags=["repair"])
    app.include_router(organize.router, prefix="/api/v1/pdf", tags=["organize"])
    app.include_router(render.router, prefix="/api/v1/pdf", tags=["render"])
    app.include_router(compliance.router, prefix="/api/v1/pdf", tags=["compliance"])
    app.include_router(security.router, prefix="/api/v1/pdf", tags=["security"])
    app.include_router(ai_tools.router, prefix="/api/v1/pdf", tags=["ai"])
    app.include_router(watermark.router, prefix="/api/v1/pdf", tags=["watermark"])
    app.include_router(office.router, prefix="/api/v1/pdf", tags=["office"])
    app.include_router(extract.router, prefix="/api/v1/pdf", tags=["extract"])
    app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])
    app.include_router(billing.router, prefix="/api/v1", tags=["billing"])
    app.include_router(debug.router, prefix="/api/v1", tags=["debug"])

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {
            "status": "ok",
            "service": "getpdfpro-api",
            "version": app.version,
            "env": settings.env,
        }

    @app.get("/", tags=["meta"], include_in_schema=False)
    def root() -> JSONResponse:
        return JSONResponse(
            {
                "service": "getPDFPro API",
                "docs": "/docs",
                "health": "/health",
            }
        )

    return app


app = create_app()
