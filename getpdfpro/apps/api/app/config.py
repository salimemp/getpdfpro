"""
Application configuration loaded from environment variables.

Single source of truth — never import os.environ directly elsewhere.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All app configuration."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── App ──────────────────────────────────────────────────
    env: Literal["development", "staging", "production"] = "development"
    version: str = "0.1.0"
    debug: bool = False
    log_level: str = "INFO"

    # ─── CORS ─────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ─── Supabase ─────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # ─── Database ─────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/getpdfpro"

    # ─── Redis ────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ─── Cloudflare R2 (S3-compatible) ────────────────────────
    r2_endpoint_url: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "getpdfpro-prod"
    r2_region: str = "auto"
    r2_public_url: str = ""  # Custom domain or R2.dev URL

    # ─── Google Gemini ────────────────────────────────────────
    gemini_api_key: str = ""
    gemini_default_model: str = "gemini-1.5-flash-8b"
    gemini_pro_model: str = "gemini-1.5-pro"

    # ─── Resend (email) ───────────────────────────────────────
    resend_api_key: str = ""
    resend_from_email: str = "GetPDFPro <noreply@getpdfpro.com>"

    # ─── Stripe ───────────────────────────────────────────────
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # ─── Razorpay ─────────────────────────────────────────────
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # ─── HaveIBeenPwned ───────────────────────────────────────
    hibp_user_agent: str = "GetPDFPro-SecurityCheck"

    # ─── Rate limits (per-user, per-day for free tier) ─────────
    free_tier_daily_tasks: int = 50
    free_tier_max_file_size_mb: int = 100
    free_tier_ai_credits_per_month: int = 50
    pro_tier_max_file_size_mb: int = 4096  # 4GB
    pro_tier_ai_credits_per_month: int = 1000

    # ─── File handling ────────────────────────────────────────
    upload_signed_url_ttl_seconds: int = 900  # 15 min
    download_signed_url_ttl_seconds: int = 900  # 15 min
    auto_delete_uploads_after_hours: int = 24

    # ─── OCR ──────────────────────────────────────────────────
    tesseract_cmd: str = "/usr/bin/tesseract"  # path inside container

    # ─── Cost guardrails ──────────────────────────────────────
    max_ai_context_tokens: int = 500_000
    max_ai_output_tokens: int = 8_192
    max_concurrent_ws_per_user: int = 10
    ai_messages_per_minute_limit: int = 30
    ai_cache_ttl_seconds: int = 86_400  # 24h

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, v: str) -> str:
        return v.upper()


@lru_cache
def get_settings() -> Settings:
    """Singleton settings instance."""
    return Settings()


# Convenience alias
settings = get_settings()
