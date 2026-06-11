#!/bin/sh
# =============================================================================
# GetPDFPro API — start script
# =============================================================================
# This script is the single source of truth for the API's start command.
# Both the Dockerfile CMD and the Railway "Start Command" field should
# point here. Using a script (not a one-liner) guarantees that $PORT is
# expanded by /bin/sh no matter how Railway invokes the container.
# =============================================================================

set -e

# Railway assigns a random port and injects it as $PORT. Default to 8000
# for local dev.
: "${PORT:=8000}"

echo "[start.sh] Starting GetPDFPro API on port ${PORT}" >&2

# exec so uvicorn replaces the shell as PID 1 — Railway's SIGTERM
# reaches the app, not the wrapper, so graceful shutdown works.
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers 1 \
    --log-level info
