"""Application configuration — typed, validated, secret-safe."""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    env: str = "development"
    port: int = 8000
    log_level: str = "info"

    # CORS — comma-separated list of allowed origins. In dev this
    # includes the local web app ports. In prod, set CORS_ORIGINS env
    # var to the public Vercel domain (and the marketing site once
    # it's live).
    cors_origins: str = (
        "http://localhost:3000,http://localhost:5173,"
        "https://getpdfpro.com,https://app.getpdfpro.com,"
        "https://getpdfpro-web.vercel.app"
    )

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash-8b"
    gemini_pro_model: str = "gemini-1.5-pro"

    # Cloudflare R2
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "getpdfpro-uploads"
    r2_public_url: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # Sentry
    sentry_dsn: str = ""

    @field_validator("cors_origins")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
