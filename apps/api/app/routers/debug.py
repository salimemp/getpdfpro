"""Debug-only endpoints for diagnosing soffice runtime state.

Gated by `is_production` — automatically disabled in prod.

Re-added after the cleanup to investigate /dev/shm + D-Bus
issues. Now also includes the convert-dry-run endpoint to verify
the cascade picks LibreOffice after the runtime fixes.

Safe to remove once the cascade is verified stable.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
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


# 1-page minimal test PDF (Hello Word). Used by the convert-dry-run
# endpoint below. Same shape as the verify scripts.
_TEST_PDF = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 44>>stream
BT /F1 24 Tf 100 700 Td (Hello Word) Tj ET
endstream endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000056 00000 n
0000000110 00000 n
0000000210 00000 n
0000000269 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
360
%%EOF
"""


@router.get("/convert-dry-run", include_in_schema=False)
async def debug_convert_dry_run() -> dict:
    """Force-run the cascade with a 1-page test PDF and report what
    each adapter did. Use this to see if the LibreOffice fix is
    working.
    """
    _gate()

    from app.adapters import ConversionError
    from app.adapters.cascade import get_cascade

    cascade = get_cascade()
    attempts: list[dict] = []
    chosen: dict | None = None

    for adapter in cascade.adapters:
        entry: dict = {
            "name": adapter.name,
            "available": None,
            "tried": False,
            "succeeded": False,
            "error_type": None,
            "error_message": None,
            "error_retryable": None,
            "elapsed_ms": None,
            "output_size": None,
        }
        try:
            entry["available"] = bool(await adapter.is_available())
        except Exception as e:
            entry["available"] = False
            entry["available_error"] = f"{type(e).__name__}: {e}"
        if not entry["available"]:
            attempts.append(entry)
            continue
        entry["tried"] = True
        t0 = time.time()
        try:
            result = await adapter.convert(_TEST_PDF, output_format="docx")
            entry["succeeded"] = True
            entry["elapsed_ms"] = int((time.time() - t0) * 1000)
            entry["output_size"] = len(result.bytes)
            entry["adapter_reported_name"] = result.adapter_name
            entry["file_extension"] = result.file_extension
            chosen = entry
            attempts.append(entry)
            break
        except ConversionError as exc:
            entry["succeeded"] = False
            entry["elapsed_ms"] = int((time.time() - t0) * 1000)
            entry["error_type"] = "ConversionError"
            entry["error_message"] = str(exc)[:500]
            entry["error_retryable"] = exc.retryable
            attempts.append(entry)
            if not exc.retryable:
                break
        except Exception as exc:
            entry["succeeded"] = False
            entry["elapsed_ms"] = int((time.time() - t0) * 1000)
            entry["error_type"] = type(exc).__name__
            entry["error_message"] = str(exc)[:500]
            attempts.append(entry)
            break

    return {
        "test_pdf_size_bytes": len(_TEST_PDF),
        "attempts": attempts,
        "winner": chosen["name"] if chosen else None,
    }


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
