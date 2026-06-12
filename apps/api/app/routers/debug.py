"""Debug-only endpoint for diagnosing soffice runtime state.

Gated by `is_production` — automatically disabled in prod.

Re-added after the cleanup to investigate a possible /dev/shm
undersized issue in the Railway container. Will be removed
once the diagnosis is done.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.config import get_settings

router = APIRouter(
    prefix="/_debug",
    tags=["debug"],
    include_in_schema=False,
)


def _gate():
    if get_settings().is_production:
        raise HTTPException(status_code=404, detail="Not found")
    return None


@router.get("/runtime", include_in_schema=False)
def debug_runtime() -> dict:
    """Report Docker / runtime state that affects headless soffice.

    Surfaces:
      - /dev/shm size (soffice uses shared memory for IPC)
      - D-Bus session state (soffice probes for it)
      - XDG_RUNTIME_DIR state (soffice expects this set)
      - ulimits (soffice needs reasonable file descriptor limits)
    """
    _gate()

    shm_info = {}
    shm_path = Path("/dev/shm")
    if shm_path.exists():
        try:
            st = os.statvfs("/dev/shm")
            shm_info = {
                "exists": True,
                "total_bytes": st.f_blocks * st.f_frsize,
                "free_bytes": st.f_bavail * st.f_frsize,
                "total_mb": round((st.f_blocks * st.f_frsize) / (1024 * 1024), 1),
                "free_mb": round((st.f_bavail * st.f_frsize) / (1024 * 1024), 1),
            }
        except OSError as e:
            shm_info = {"exists": True, "error": str(e)}
    else:
        shm_info = {"exists": False}

    # Check if we can remount /dev/shm with a larger size
    shm_remount_capable = False
    shm_remount_error = None
    try:
        r = subprocess.run(
            ["mount", "-o", "remount,size=512m", "/dev/shm"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        shm_remount_capable = (r.returncode == 0)
        if not shm_remount_capable:
            shm_remount_error = (r.stderr or r.stdout).strip()[:200]
    except Exception as e:
        shm_remount_error = f"{type(e).__name__}: {e}"

    # D-Bus
    dbus = {
        "DBUS_SESSION_BUS_ADDRESS": os.environ.get("DBUS_SESSION_BUS_ADDRESS", "<unset>"),
        "DBUS_SYSTEM_BUS_ADDRESS": os.environ.get("DBUS_SYSTEM_BUS_ADDRESS", "<unset>"),
        "XDG_RUNTIME_DIR": os.environ.get("XDG_RUNTIME_DIR", "<unset>"),
        "xdg_runtime_dir_exists": Path(
            os.environ.get("XDG_RUNTIME_DIR", "/run/user/0")
        ).exists() if os.environ.get("XDG_RUNTIME_DIR") else False,
    }

    # ulimits
    try:
        import resource
        ulimits = {
            "nofile_soft": resource.getrlimit(resource.RLIMIT_NOFILE)[0],
            "nofile_hard": resource.getrlimit(resource.RLIMIT_NOFILE)[1],
        }
    except Exception as e:
        ulimits = {"error": str(e)}

    return {
        "shm": shm_info,
        "shm_remount_capable_to_512m": shm_remount_capable,
        "shm_remount_error": shm_remount_error,
        "dbus": dbus,
        "ulimits": ulimits,
        "container_id": os.environ.get("HOSTNAME", "<unknown>"),
    }
