"""Debug-only endpoints for diagnosing runtime issues.

Mounted under `/api/v1/_debug/`. These are:

- Gated by `is_production` — automatically disabled in prod.
- Not included in OpenAPI schema.
- Read-only — they report system state, no side effects.

Used during the LibreOffice cascade rollout to figure out whether
soffice is actually installed in the running container vs. just being
in the Dockerfile. The 11ms response time on /to-word-download was
suspicious — too fast for soffice cold start. This endpoint confirms
whether soffice is on PATH and which version.

Safe to remove once the cascade is verified stable.
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
    """Return None if debug is allowed, else raise 404."""
    if get_settings().is_production:
        raise HTTPException(status_code=404, detail="Not found")
    return None


@router.get("/soffice", include_in_schema=False)
def debug_soffice() -> dict:
    """Report soffice install state.

    Returns:
        - soffice_path: shutil.which('soffice') result, or null
        - soffice_version: stdout of `soffice --version`, or error
        - libreoffice_pkg: dpkg -l | grep libreoffice output (or None)
        - env: environment hints that affect soffice (HOME, PATH, LANG)
        - lib_path_search: where we looked for soffice
        - which_lo_importer: alternative soffice binary names
        - python_subprocess_can_find: subprocess.run(['which','soffice']) result
    """
    _gate()

    # 1. shutil.which on PATH
    soffice_path = shutil.which("soffice")

    # 2. Try the canonical PATH-search via subprocess (defends against
    #    weird PATH / venv issues where shutil.which behaves differently
    #    from subprocess invocation).
    sp_which = None
    sp_which_err = None
    try:
        sp = subprocess.run(
            ["which", "soffice"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        sp_which = sp.stdout.strip() or None
        sp_which_err = sp.stderr.strip() or None
    except Exception as e:
        sp_which_err = f"{type(e).__name__}: {e}"

    # 3. Try common absolute paths Railway/Debian might use
    common_paths = [
        "/usr/bin/soffice",
        "/usr/local/bin/soffice",
        "/opt/libreoffice/program/soffice",
    ]
    common_path_results = {p: Path(p).exists() for p in common_paths}

    # 4. If we found one, get its version
    version = None
    version_err = None
    if soffice_path:
        try:
            v = subprocess.run(
                [soffice_path, "--version"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            version = (v.stdout or v.stderr).strip()
        except Exception as e:
            version_err = f"{type(e).__name__}: {e}"

    # 5. Check what the OS thinks is installed (dpkg)
    dpkg_output = None
    dpkg_err = None
    try:
        d = subprocess.run(
            ["dpkg", "-l"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if d.returncode == 0:
            dpkg_output = [
                line for line in d.stdout.splitlines()
                if "libreoffice" in line.lower() or "tesseract" in line.lower()
            ]
        else:
            dpkg_err = d.stderr.strip() or f"dpkg exit {d.returncode}"
    except FileNotFoundError:
        dpkg_err = "dpkg not found (not a Debian system?)"
    except Exception as e:
        dpkg_err = f"{type(e).__name__}: {e}"

    # 6. Image / build fingerprint
    return {
        "soffice_path": soffice_path,
        "soffice_path_via_subprocess_which": sp_which,
        "soffice_path_via_subprocess_stderr": sp_which_err,
        "common_absolute_paths": common_path_results,
        "soffice_version": version,
        "soffice_version_error": version_err,
        "dpkg_installed": dpkg_output,
        "dpkg_error": dpkg_err,
        "env": {
            "PATH": os.environ.get("PATH", "<unset>"),
            "HOME": os.environ.get("HOME", "<unset>"),
            "LANG": os.environ.get("LANG", "<unset>"),
            "LC_ALL": os.environ.get("LC_ALL", "<unset>"),
            "LIBREOFFICE_TIMEOUT_S": os.environ.get("LIBREOFFICE_TIMEOUT_S", "<unset>"),
        },
        "container_id": os.environ.get("HOSTNAME", "<unknown>"),
        "python_executable": shutil.which("python") or shutil.which("python3"),
    }


@router.get("/cascade", include_in_schema=False)
async def debug_cascade() -> dict:
    """Report the state of each adapter in the conversion cascade.

    Returns for each: name, available (bool), quality_score, reason.
    """
    _gate()

    from app.adapters.cascade import get_cascade

    cascade = get_cascade()
    out = []
    for adapter in cascade.adapters:
        entry = {
            "name": adapter.name,
            "description": adapter.description,
            "quality_score": getattr(adapter, "quality_score", None),
        }
        try:
            available = await adapter.is_available()
            entry["available"] = bool(available)
        except Exception as e:
            entry["available_error"] = f"{type(e).__name__}: {e}"
        out.append(entry)
    return {"adapters": out}
