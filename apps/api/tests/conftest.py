"""
Pytest config — make ``app.*`` importable.

The production ``apps/api`` package has the ``app`` package at the api
root and the test tree at ``apps/api/tests/``. We add the api root to
``sys.path`` before any test collection so ``from app import ...``
works in tests that want to exercise FastAPI routers, plus we set a
handful of placeholder env vars so the ``pydantic-settings`` config
loads cleanly outside of a real environment.
"""

import os
import sys
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

# Set safe defaults for env vars the app reads at import time. Real
# secrets are injected at deploy time.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://localhost/test")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_placeholder")
os.environ.setdefault("RAZORPAY_KEY_ID", "rzp_test_placeholder")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "test-razorpay-secret")
os.environ.setdefault("R2_ACCOUNT_ID", "test-r2-account")
os.environ.setdefault("R2_ACCESS_KEY_ID", "test-r2-key")
os.environ.setdefault("R2_SECRET_ACCESS_KEY", "test-r2-secret")
os.environ.setdefault("R2_BUCKET", "getpdfpro-uploads")
os.environ.setdefault("R2_PUBLIC_URL", "https://pub-test.r2.dev")
