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


# Minimal 1-page PDF (Hello Word) — used for the conversion dry-run.
# Same shape as the test PDF in the verify scripts.
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
    # 7. Java probe — `javaldx` is the soffice helper that looks for
    #    a JRE at startup. If it can't find one, DOCX save fails with
    #    0xc10. We need to know:
    #    - is `java` on PATH?
    #    - is it executable by appuser (we run as UID 1000)?
    #    - does the soffice-bundled javaldx find it?
    java_path = shutil.which("java")
    java_subprocess_path = None
    java_subprocess_err = None
    try:
        sp = subprocess.run(
            ["which", "java"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        java_subprocess_path = sp.stdout.strip() or None
        java_subprocess_err = sp.stderr.strip() or None
    except Exception as e:
        java_subprocess_err = f"{type(e).__name__}: {e}"

    java_version = None
    java_version_err = None
    if java_path:
        try:
            jv = subprocess.run(
                [java_path, "-version"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            # java -version prints to stderr
            java_version = (jv.stderr or jv.stdout).strip()
        except Exception as e:
            java_version_err = f"{type(e).__name__}: {e}"

    # Common JDK install locations on Debian
    java_common_paths = [
        "/usr/bin/java",
        "/usr/lib/jvm/default-java/bin/java",
        "/usr/lib/jvm/java-17-openjdk-amd64/bin/java",
        "/usr/lib/jvm/java-11-openjdk-amd64/bin/java",
    ]
    java_common_path_results = {}
    for p in java_common_paths:
        path_obj = Path(p)
        java_common_path_results[p] = {
            "exists": path_obj.exists(),
            "is_file": path_obj.is_file() if path_obj.exists() else None,
        }

    # Try running the soffice-bundled javaldx to see what it reports.
    # On Debian, the real javaldx lives at /usr/lib/libreoffice/program/javaldx
    # (not next to /usr/bin/soffice). Probe multiple known locations.
    javaldx_output = None
    javaldx_err = None
    javaldx_candidates = [
        str(Path(soffice_path).parent / "javaldx") if soffice_path else None,
        "/usr/lib/libreoffice/program/javaldx",
        "/usr/lib64/libreoffice/program/javaldx",
        "/opt/libreoffice/program/javaldx",
    ]
    javaldx_candidates = [p for p in javaldx_candidates if p]
    javaldx_found_at = None
    for cand in javaldx_candidates:
        if Path(cand).exists():
            javaldx_found_at = cand
            break
    if javaldx_found_at:
        try:
            jx = subprocess.run(
                [javaldx_found_at],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            javaldx_output = (jx.stdout or jx.stderr).strip()[:500]
        except Exception as e:
            javaldx_err = f"{type(e).__name__}: {e}"
    else:
        javaldx_err = f"javaldx not found in any of: {javaldx_candidates}"

    return {
        "soffice_path": soffice_path,
        "soffice_path_via_subprocess_which": sp_which,
        "soffice_path_via_subprocess_stderr": sp_which_err,
        "common_absolute_paths": common_path_results,
        "soffice_version": version,
        "soffice_version_error": version_err,
        "dpkg_installed": dpkg_output,
        "dpkg_error": dpkg_err,
        "java_path": java_path,
        "java_path_via_subprocess_which": java_subprocess_path,
        "java_path_via_subprocess_stderr": java_subprocess_err,
        "java_version": java_version,
        "java_version_error": java_version_err,
        "java_common_paths": java_common_path_results,
        "javaldx_output": javaldx_output,
        "javaldx_error": javaldx_err,
        "javaldx_found_at": javaldx_found_at,
        "javaldx_candidates": javaldx_candidates,
        "env": {
            "PATH": os.environ.get("PATH", "<unset>"),
            "HOME": os.environ.get("HOME", "<unset>"),
            "LANG": os.environ.get("LANG", "<unset>"),
            "LC_ALL": os.environ.get("LC_ALL", "<unset>"),
            "JAVA_HOME": os.environ.get("JAVA_HOME", "<unset>"),
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


@router.get("/convert-dry-run", include_in_schema=False)
async def debug_convert_dry_run() -> dict:
    """Force-run the cascade with a known-good 1-page test PDF and
    report what each adapter did — including full error messages from
    any adapter that failed. Use this to find out why LibreOffice
    is_available=True but isn't being used in the live /to-word-download
    response.

    Does NOT return the converted file (it would bloat the response);
    just reports the metadata + first 200 bytes of each attempt's error.
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
            entry["cost_usd"] = result.cost_usd
            chosen = entry
            attempts.append(entry)
            break  # cascade stops at first success
        except ConversionError as exc:
            entry["succeeded"] = False
            entry["elapsed_ms"] = int((time.time() - t0) * 1000)
            entry["error_type"] = "ConversionError"
            entry["error_message"] = str(exc)[:500]
            entry["error_retryable"] = exc.retryable
            attempts.append(entry)
            if not exc.retryable:
                break  # non-retryable — cascade stops
        except Exception as exc:
            entry["succeeded"] = False
            entry["elapsed_ms"] = int((time.time() - t0) * 1000)
            entry["error_type"] = type(exc).__name__
            entry["error_message"] = str(exc)[:500]
            entry["error_retryable"] = None
            attempts.append(entry)
            break  # unhandled — don't keep going

    return {
        "test_pdf_size_bytes": len(_TEST_PDF),
        "attempts": attempts,
        "winner": chosen["name"] if chosen else None,
    }
