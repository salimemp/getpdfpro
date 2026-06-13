"""
Pytest config — make `app.*` importable from the nested api tree.

GetPDFPro's monorepo has two `apps/api` directories (outer +
nested). This conftest ensures tests run against the correct one
(the one with `app/services/email_templates/`).

The package layout under test is `app/...`, so we add the api
root to sys.path before any test collection happens.
"""

import os
import sys
from pathlib import Path

# Resolve the api root (parent of this conftest.py's tests dir)
_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

# Make sure required env vars exist (settings are read at import
# time by pydantic-settings). These are dev/test placeholders —
# real secrets are injected at deploy time.
os.environ.setdefault("RESEND_API_KEY", "re_test_placeholder")
os.environ.setdefault("RESEND_FROM_EMAIL", "GetPDFPro <noreply@getpdfpro.com>")
os.environ.setdefault("APP_BASE_URL", "https://app.getpdfpro.com")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
