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

# --- Runtime env setup for soffice (UNO bridge listener) ---
#
# Two known soffice-in-slim-Docker issues that cause the 0xc10 save
# error (and other silent failures):
#
# 1. /dev/shm undersized. soffice uses shared memory segments for
#    internal IPC. Default Docker shm is 64MB which is borderline for
#    LibreOffice 25.x with UNO bridge. We can't remount /dev/shm
#    without superuser, so we point soffice at a different temp dir
#    via TMPDIR. soffice respects TMPDIR for its own temp file
#    allocations, reducing pressure on /dev/shm.
#
# 2. Missing D-Bus / XDG_RUNTIME_DIR. Headless soffice still probes
#    for a D-Bus session (for file-locking notifications) and
#    XDG_RUNTIME_DIR (for runtime state). Without these, soffice
#    prints warnings that abort the save pipeline with 0xc10. Fix:
#    create /tmp/runtime-$(id -u) + chmod 0700, set XDG_RUNTIME_DIR,
#    and disable the D-Bus bus probe.
mkdir -p /tmp/lo-tmp
chmod 1777 /tmp/lo-tmp
export TMPDIR=/tmp/lo-tmp

if [ -z "${XDG_RUNTIME_DIR:-}" ]; then
    RUNTIME_DIR="/tmp/runtime-$(id -u)"
    mkdir -p "$RUNTIME_DIR"
    chmod 0700 "$RUNTIME_DIR"
    export XDG_RUNTIME_DIR="$RUNTIME_DIR"
fi

# Suppress soffice's D-Bus session probe. soffice wants a session
# bus; in a container there isn't one. Setting this to "disabled:"
# tells soffice to skip the bus entirely instead of trying to
# connect to a non-existent one.
export DBUS_SESSION_BUS_ADDRESS="disabled:"

# 1. Launch the LibreOffice UNO listener (background, long-running).
#    Adapter connects to this listener over TCP and uses the UNO API
#    to do the PDF→Office conversion. Using a long-running listener
#    (vs. per-call subprocess) avoids the broken `soffice --headless
#    --convert-to` CLI save path and gives us a single point of
#    failure we can monitor.
#
#    The listener stays up for the lifetime of the container. It
#    accepts UNO connections on 127.0.0.1:2002. Bound to localhost
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
