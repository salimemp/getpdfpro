"""
Celery worker configuration.
"""

import os

from celery import Celery
from celery.signals import worker_ready

from app.config import settings

# ─── Celery app ─────────────────────────────────────────────────
celery_app = Celery(
    "getpdfpro_workers",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks",  # tasks module
    ],
)

# ─── Config ────────────────────────────────────────────────────
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Time zone
    timezone="UTC",
    enable_utc=True,

    # Task execution
    task_acks_late=True,                # re-deliver if worker dies mid-task
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,       # fair scheduling
    worker_max_tasks_per_child=1000,    # recycle to avoid memory leaks
    worker_max_memory_per_child=400_000,  # 400MB soft limit

    # Concurrency: tune to CPU. Free Railway: 1-2 workers
    worker_concurrency=int(os.getenv("CELERY_CONCURRENCY", "2")),

    # Result backend
    result_expires=3600,                # 1h

    # Retry policy
    task_default_retry_delay=30,        # 30s between retries
    task_default_max_retries=3,

    # Queues
    task_default_queue="default",
    task_queues_priority=["pdf", "ai", "email"],
)


@worker_ready.connect
def at_worker_ready(sender, **kwargs) -> None:
    """Log when worker boots."""
    import structlog
    log = structlog.get_logger()
    log.info("celery_worker_ready", hostname=sender.hostname)
