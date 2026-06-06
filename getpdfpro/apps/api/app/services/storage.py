"""
Cloudflare R2 storage service.

R2 is S3-compatible with ZERO egress fees. The biggest cost win in
the whole stack.
"""

from contextlib import asynccontextmanager
from datetime import timedelta
from typing import AsyncIterator

import aioboto3
import structlog

from app.config import settings

logger = structlog.get_logger()


class StorageService:
    """Wrapper around aioboto3 for R2 access."""

    def __init__(self) -> None:
        self._session: aioboto3.Session | None = None

    async def connect(self) -> None:
        self._session = aioboto3.Session()
        logger.info("storage_connected", bucket=settings.r2_bucket)

    async def close(self) -> None:
        self._session = None

    @asynccontextmanager
    async def _client(self) -> AsyncIterator:
        if not self._session:
            self._session = aioboto3.Session()
        async with self._session.client(
            "s3",
            endpoint_url=settings.r2_endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name=settings.r2_region,
        ) as s3:
            yield s3

    # ─── Pre-signed upload URL ────────────────────────────────
    async def presigned_put_url(
        self,
        key: str,
        content_type: str = "application/pdf",
        content_length: int | None = None,
    ) -> str:
        """
        Generate a pre-signed URL for direct browser → R2 upload.
        Client uses this to upload files WITHOUT going through our API.
        """
        async with self._client() as s3:
            params = {
                "Bucket": settings.r2_bucket,
                "Key": key,
                "ContentType": content_type,
            }
            return await s3.generate_presigned_url(
                "put_object",
                Params=params,
                ExpiresIn=settings.upload_signed_url_ttl_seconds,
            )

    # ─── Pre-signed download URL ──────────────────────────────
    async def presigned_get_url(self, key: str) -> str:
        """Generate a pre-signed URL for client to download a file."""
        async with self._client() as s3:
            return await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.r2_bucket, "Key": key},
                ExpiresIn=settings.download_signed_url_ttl_seconds,
            )

    # ─── Upload bytes ─────────────────────────────────────────
    async def put_bytes(self, key: str, data: bytes, content_type: str = "application/pdf") -> None:
        """Server-side upload (used by workers)."""
        async with self._client() as s3:
            await s3.put_object(
                Bucket=settings.r2_bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )

    # ─── Download bytes ───────────────────────────────────────
    async def get_bytes(self, key: str) -> bytes:
        """Server-side download (used by workers)."""
        async with self._client() as s3:
            response = await s3.get_object(Bucket=settings.r2_bucket, Key=key)
            async with response["Body"] as stream:
                return await stream.read()

    # ─── Delete ───────────────────────────────────────────────
    async def delete(self, key: str) -> None:
        async with self._client() as s3:
            await s3.delete_object(Bucket=settings.r2_bucket, Key=key)

    # ─── Delete by prefix ─────────────────────────────────────
    async def delete_prefix(self, prefix: str) -> int:
        """Delete all objects with a given prefix. Returns count."""
        deleted = 0
        async with self._client() as s3:
            paginator = s3.get_paginator("list_objects_v2")
            async for page in paginator.paginate(Bucket=settings.r2_bucket, Prefix=prefix):
                if "Contents" not in page:
                    continue
                keys = [{"Key": obj["Key"]} for obj in page["Contents"]]
                if keys:
                    await s3.delete_objects(
                        Bucket=settings.r2_bucket,
                        Delete={"Objects": keys},
                    )
                    deleted += len(keys)
        return deleted


# Module-level singleton
storage_service = StorageService()
