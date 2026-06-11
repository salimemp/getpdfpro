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

# 1. Launch the LibreOffice headless listener (UNO bridge endpoint).
#    The PDF→Word cascade's LibreOffice adapter (apps/api/app/adapters/
#    libreoffice.py) connects to this listener over TCP and uses the
#    UNO API to convert PDFs to DOCX.
#
#    We use --accept="socket,host=127.0.0.1,port=2002;urp;" — bound
#    to localhost only (no public exposure), default UNO port 2002.
#
#    --headless: no GUI. --norestore + --nologo + --nodefault +
#    --nofirststartwizard: don't try to restore a previous session
#    or show the first-start wizard.
#
#    -env:UserInstallation=file:///tmp/lo-profile: per-process
#    user profile (avoids "profile is locked" errors when multiple
#    invocations happen).
#
#    We nohup-and-fork the listener so it doesn't block uvicorn.
#    Log goes to /tmp/soffice-listener.log for debugging.
if command -v soffice >/dev/null 2>&1; then
    echo "[start.sh] Starting soffice UNO listener on 127.0.0.1:2002" >&2
    mkdir -p /tmp/lo-profile
    nohup soffice \
        --headless \
        --norestore \
        --nologo \
        --nodefault \
        --nofirststartwizard \
        -env:UserInstallation=file:///tmp/lo-profile \
        --accept="socket,host=127.0.0.1,port=2002;urp;" \
        > /tmp/soffice-listener.log 2>&1 &
    SOFFICE_PID=$!
    echo "[start.sh] soffice listener PID: ${SOFFICE_PID}" >&2

    # Wait for the listener to be ready (max 15s). UNO bridge
    # listeners take 1-3s to come up on a cold container.
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
        if (echo > /dev/tcp/127.0.0.1/2002) 2>/dev/null; then
            echo "[start.sh] soffice listener ready after ${i}s" >&2
            break
        fi
        sleep 1
    done
fi

echo "[start.sh] Starting GetPDFPro API on port ${PORT}" >&2

# exec so uvicorn replaces the shell as PID 1 — Railway's SIGTERM
# reaches the app, not the wrapper, so graceful shutdown works.
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT}" \
    --workers 1 \
    --log-level info
