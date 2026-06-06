"""
Redis cache service (also used as Celery broker, in workers).

Upstash free tier: 10K commands/day, 256MB.
"""

import json
from typing import Any

import redis.asyncio as redis
import structlog

from app.config import settings

logger = structlog.get_logger()


class CacheService:
    """Async Redis wrapper with JSON serialization."""

    def __init__(self) -> None:
        self._client: redis.Redis | None = None

    async def connect(self) -> None:
        self._client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        # Test connection
        try:
            await self._client.ping()
            logger.info("cache_connected", url=_safe_url(settings.redis_url))
        except redis.RedisError as e:
            logger.error("cache_connection_failed", error=str(e))
            raise

    async def close(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None

    @property
    def client(self) -> redis.Redis:
        if not self._client:
            raise RuntimeError("Cache not connected. Call connect() first.")
        return self._client

    # ─── Basic operations ─────────────────────────────────────
    async def get(self, key: str) -> str | None:
        return await self.client.get(key)

    async def set(
        self,
        key: str,
        value: str,
        ttl: int | None = None,
    ) -> None:
        if ttl:
            await self.client.set(key, value, ex=ttl)
        else:
            await self.client.set(key, value)

    async def delete(self, key: str) -> None:
        await self.client.delete(key)

    async def exists(self, key: str) -> bool:
        return bool(await self.client.exists(key))

    # ─── JSON helpers ─────────────────────────────────────────
    async def get_json(self, key: str) -> Any:
        raw = await self.get(key)
        return json.loads(raw) if raw else None

    async def set_json(self, key: str, value: Any, ttl: int | None = None) -> None:
        await self.set(key, json.dumps(value, default=str), ttl=ttl)

    # ─── Rate limiting (token bucket via Redis) ───────────────
    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        window_seconds: int,
    ) -> tuple[bool, int]:
        """
        Check if `key` is within `limit` requests in `window_seconds`.

        Returns (allowed, current_count).
        """
        pipe = self.client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = await pipe.execute()
        return (count <= limit, count)


def _safe_url(url: str) -> str:
    """Strip password from URL for logging."""
    if "@" in url:
        scheme, rest = url.split("://", 1)
        _, host = rest.split("@", 1)
        return f"{scheme}://***@{host}"
    return url


# Module-level singleton
cache_service = CacheService()
