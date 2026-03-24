"""
V1 API router — aggregates all endpoint modules.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, export, farm_logs, fields, health, voice, weather

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(voice.router, prefix="/voice", tags=["voice"])
api_router.include_router(farm_logs.router, prefix="/farm-logs", tags=["farm-logs"])
api_router.include_router(fields.router, prefix="/fields", tags=["fields"])
api_router.include_router(weather.router, prefix="/weather", tags=["weather"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(health.router, tags=["health"])
