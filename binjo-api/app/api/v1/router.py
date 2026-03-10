"""
V1 API router — aggregates all endpoint modules.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, farm_logs, health, voice

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(voice.router, prefix="/voice", tags=["voice"])
api_router.include_router(farm_logs.router, prefix="/farm-logs", tags=["farm-logs"])
api_router.include_router(health.router, tags=["health"])
