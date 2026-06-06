"""
API v1 router — aggregates all v1 endpoints.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import ai, auth, billing, files, jobs, me, tools

api_router = APIRouter()

# Health is at /health (mounted at root, not under /api/v1)
api_router.include_router(me.router, prefix="/me", tags=["me"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
