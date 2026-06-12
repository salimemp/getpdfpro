"""Debug-only endpoints for diagnosing soffice runtime state.

Gated by `is_production` — automatically disabled in prod.

Re-added after the cleanup to investigate /dev/shm + D-Bus
issues. Now also includes the convert-dry-run endpoint to verify
the cascade picks LibreOffice after the runtime fixes.

Also includes /adobe-trace which is gated on a separate
ADOBE_DEBUG_TOKEN env var (not the is_production flag) so we
can debug the Adobe exportpdf/createpdf bug live in production
without exposing it to anonymous users. The token is checked
via the X-Debug-Token header.

Safe to remove once the cascade is verified stable.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
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


# ─── Adobe Wire-Trace Endpoint ──────────────────────────────────
#
# Captures the FULL HTTP exchange between us and Adobe for
# one operation. Returns it as JSON so you can diff our
# request body against what the official SDK sends.
#
# Gated on a separate ADOBE_DEBUG_TOKEN env var (NOT the
# is_production flag), so we can debug in production without
# exposing this to anonymous users.
#
# Usage:
#   curl -H "X-Debug-Token: $ADOBE_DEBUG_TOKEN" \
#        -X POST "https://api.getpdfpro.com/api/v1/_debug/adobe-trace?op=exportpdf" \
#        -F "file=@/path/to/real.docx" -F "target_format=pptx" > trace.json
#
# Then paste the response back to me and I'll diff against the
# SDK to find the missing piece.


@router.post("/adobe-trace", include_in_schema=False)
async def adobe_trace(
    request: Request,
    file: UploadFile = File(...),
    target_format: str = Form("pptx"),
    op: str = Form("exportpdf"),  # or "createpdf"
) -> JSONResponse:
    """Trace the full Adobe HTTP exchange for one operation.

    Returns JSON with the exact request headers, request body,
    response status, and response body for every step:
    1. Token fetch
    2. Asset create + presigned URL
    3. PUT to presigned URL
    4. Operation submit
    5. Poll (truncated)
    """
    expected_token = os.environ.get("ADOBE_DEBUG_TOKEN", "").strip()
    if not expected_token:
        raise HTTPException(
            404, "ADOBE_DEBUG_TOKEN env var not set on server. Cannot debug."
        )
    provided_token = request.headers.get("X-Debug-Token", "").strip()
    if provided_token != expected_token:
        raise HTTPException(401, "Invalid debug token.")

    if op not in ("exportpdf", "createpdf"):
        raise HTTPException(400, "op must be 'exportpdf' or 'createpdf'")

    import json as _json
    from app.adapters import adobe_ops
    import httpx as _httpx

    if not adobe_ops.is_configured():
        raise HTTPException(
            503, "Adobe not configured. Set ADOBE_CLIENT_ID and ADOBE_CLIENT_SECRET."
        )

    file_bytes = await file.read()
    trace: dict = {
        "op": op,
        "target_format": target_format,
        "filename": file.filename,
        "file_size": len(file_bytes),
        "steps": [],
    }

    # Step 1: Token fetch — manually re-do to capture
    from app.config import get_settings
    settings = get_settings()
    async with _httpx.AsyncClient(timeout=30) as client:
        auth_resp = await client.post(
            "https://ims-na1.adobelogin.com/ims/token/v3",
            data={
                "client_id": "REDACTED",
                "client_secret": "REDACTED",
                "grant_type": "client_credentials",
                "scope": "openid,AdobeID,DCAPI",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    trace["steps"].append({
        "step": "1.adobe_auth",
        "url": "https://ims-na1.adobelogin.com/ims/token/v3",
        "method": "POST",
        "request_body": "(redacted: client_credentials grant)",
        "request_headers": {"Content-Type": "application/x-www-form-urlencoded"},
        "response_status": auth_resp.status_code,
        "response_body": auth_resp.json() if auth_resp.status_code == 200 else auth_resp.text[:500],
    })
    if auth_resp.status_code != 200:
        return JSONResponse(trace)
    token = auth_resp.json()["access_token"]

    # Step 2: Asset create
    # Use the target MIME based on the op
    if op == "createpdf":
        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        asset_ext = "docx"
    else:
        mime = "application/pdf"
        asset_ext = "pdf"
    async with _httpx.AsyncClient(timeout=60) as client:
        create_resp = await client.post(
            "https://pdf-services.adobe.io/assets",
            headers={
                "Authorization": f"Bearer {token}",
                "x-api-key": settings.adobe_client_id,
                "Content-Type": "application/json",
            },
            content=_json.dumps({"mediaType": mime}),
        )
    trace["steps"].append({
        "step": "2.asset_create",
        "url": "https://pdf-services.adobe.io/assets",
        "method": "POST",
        "request_body": _json.dumps({"mediaType": mime}),
        "request_headers": {
            "Authorization": "Bearer <redacted>",
            "x-api-key": settings.adobe_client_id,
            "Content-Type": "application/json",
        },
        "response_status": create_resp.status_code,
        "response_body": create_resp.json() if create_resp.status_code in (200, 201) else create_resp.text[:500],
    })
    if create_resp.status_code not in (200, 201):
        return JSONResponse(trace)
    asset_body = create_resp.json()
    asset_id = asset_body.get("assetID")
    upload_uri = asset_body.get("uploadUri")
    if not (asset_id and upload_uri):
        return JSONResponse(trace)

    # Step 3: PUT to presigned URL
    async with _httpx.AsyncClient(timeout=120) as client:
        put_resp = await client.put(
            upload_uri,
            headers={"Content-Type": mime},
            content=file_bytes,
        )
    trace["steps"].append({
        "step": "3.asset_upload",
        "url": upload_uri[:80] + '...',  # redact long URL
        "method": "PUT",
        "request_headers": {"Content-Type": mime},
        "request_body_size": len(file_bytes),
        "response_status": put_resp.status_code,
        "response_body": put_resp.text[:500] if put_resp.status_code not in (200, 201, 204) else "(empty success)",
    })

    # Step 4: Operation submit
    op_path = "/operation/createpdf" if op == "createpdf" else "/operation/exportpdf"
    op_info = (
        "Create PDF Operation" if op == "createpdf" else "Export PDF Operation"
    )
    if op == "exportpdf":
        body = {
            "assetID": asset_id,
            "json": "{}",
            "params": {"targetFormat": target_format},
        }
    else:
        body = {
            "assetID": asset_id,
            "json": "{}",
            "params": {},
        }
    async with _httpx.AsyncClient(timeout=60) as client:
        op_resp = await client.post(
            f"https://pdf-services.adobe.io{op_path}",
            headers={
                "Authorization": f"Bearer {token}",
                "x-api-key": settings.adobe_client_id,
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
                "x-api-app-info": "python-pdfservices-sdk-4.2.0",
                "x-dcsdk-ops-info": op_info,
            },
            content=_json.dumps(body),
        )
    trace["steps"].append({
        "step": "4.operation_submit",
        "url": f"https://pdf-services.adobe.io{op_path}",
        "method": "POST",
        "request_body": body,
        "request_headers": {
            "Authorization": "Bearer <redacted>",
            "x-api-key": settings.adobe_client_id,
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "x-api-app-info": "python-pdfservices-sdk-4.2.0",
            "x-dcsdk-ops-info": op_info,
        },
        "response_status": op_resp.status_code,
        "response_headers": dict(op_resp.headers),
        "response_body": op_resp.text[:2000],
    })

    return JSONResponse(trace)
