"""
Application configuration — all env vars validated at startup.
Uses pydantic-settings to fail fast if any required var is missing.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Single source of truth for all environment variables.
    Pydantic validates these at import time — missing vars crash immediately
    instead of failing silently at runtime.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database — same Supabase PG as Phase 1 Next.js app
    database_url: str  # Pooler URL (port 6543) for app runtime
    direct_url: str  # Direct URL (port 5432) for migrations only

    # Auth
    jwt_secret: str
    kakao_client_id: str = ""  # Optional until Kakao OAuth is set up
    kakao_client_secret: str = ""
    kakao_redirect_uri: str = ""

    # AI / STT
    openai_api_key: str = ""  # Whisper + fallback LLM
    anthropic_api_key: str = ""  # Primary LLM (Claude)

    # Korean public APIs
    kma_api_key: str = ""  # 기상청 단기예보

    # Redis (Celery task queue) — optional, falls back to sync processing
    redis_url: str = ""

    # Supabase Storage (inherited from Phase 1)
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # App
    debug: bool = False
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


# Singleton — created once at import time, reused everywhere
# This is the lru_cache-free version: module-level singleton
settings = Settings()
