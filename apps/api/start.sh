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

# 1. Launch the LibreOffice UNO listener (background, long-running).
#    This is the pattern from the proven hdejager/libreoffice-api
#    recipe. The PDF→Word cascade's LibreOffice adapter connects to
#    this listener over TCP and uses the UNO API to do the conversion.
#    Using a long-running listener (vs. per-call subprocess) avoids
#    the broken `soffice --headless --convert-to` CLI save path and
#    gives us a single point of failure we can monitor.
#
#    The listener stays up for the lifetime of the container. It
#    accepts UNO connections on 127.0.0.1:2002. We bind to localhost
#    only — the UNO API is not for public exposure.
if command -v soffice >/dev/null 2>&1; then
    echo "[start.sh] Starting soffice UNO listener on 127.0.0.1:2002" >&2
    mkdir -p /tmp/lo-profile
    nohup soffice \
        --headless \
        --nologo \
        --nofirststartwizard \
        --norestore \
        -env:UserInstallation=file:///tmp/lo-profile \
        --accept="socket,host=127.0.0.1,port=2002;urp;StarOffice.ServiceManager" \
        > /tmp/soffice-listener.log 2>&1 &
    SOFFICE_PID=$!
    echo "[start.sh] soffice listener PID: ${SOFFICE_PID}" >&2

    # Wait for the listener to be ready (max 20s). Cold-start UNO
    # listener takes 1-3s in practice; budget generously.
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
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
