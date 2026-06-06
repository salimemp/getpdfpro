"""
Celery tasks for async PDF processing, AI jobs, and email sends.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from celery import shared_task
from celery.utils.log import get_task_logger

from app.celery_app import celery_app
from app.services.ai_orchestrator import ChatRequest, ai_orchestrator
from app.services.cache import cache_service
from app.services.pdf_engine import CompressionLevel, pdf_engine
from app.services.storage import storage_service

logger = structlog.get_logger()
celery_log = get_task_logger(__name__)


# ─── Helper: run async in sync Celery task ────────────────────
def run_async(coro: Any) -> Any:
    """Run an async coroutine in a Celery (sync) task."""
    return asyncio.run(coro)


# ─── Job dispatcher (called from API) ──────────────────────────
@celery_app.task(name="app.tasks.dispatch_job", bind=True, max_retries=3)
def dispatch_job(
    self,
    job_id: str,
    user_id: str,
    job_type: str,
    input_files: list[str],
    options: dict,
) -> dict:
    """
    Dispatch a job to the right handler based on type.
    """
    logger.info("dispatch_job", job_id=job_id, job_type=job_type, user_id=user_id)

    handlers = {
        "merge": process_merge,
        "split": process_split,
        "compress": process_compress,
        "convert_pdf_to_word": process_pdf_to_word,
        "convert_word_to_pdf": process_word_to_pdf,
        "convert_pdf_to_jpg": process_pdf_to_jpg,
        "convert_jpg_to_pdf": process_jpg_to_pdf,
        "ocr": process_ocr,
        "rotate": process_rotate,
        "watermark": process_watermark,
        "add_page_numbers": process_add_page_numbers,
        # Add more
    }

    handler = handlers.get(job_type)
    if not handler:
        return {"status": "failed", "error": f"Unknown job type: {job_type}"}

    return run_async(handler(job_id, user_id, input_files, options))


# ─── Individual job handlers ──────────────────────────────────
async def process_merge(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    """Merge multiple PDFs."""
    file_bytes = []
    for key in files:
        data = await storage_service.get_bytes(key)
        file_bytes.append(data)

    result = pdf_engine.merge(file_bytes)

    # Upload output
    output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}.pdf"
    await storage_service.put_bytes(output_key, result)

    return {"status": "completed", "output_key": output_key, "size_bytes": len(result)}


async def process_split(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    """Split a PDF."""
    data = await storage_service.get_bytes(files[0])
    page_ranges = options.get("page_ranges")  # [[1,3], [5,7]] or None for one-per-page
    if page_ranges:
        page_ranges = [tuple(r) for r in page_ranges]

    results = pdf_engine.split(data, page_ranges)

    output_keys = []
    ts = datetime.now(timezone.utc).strftime('%Y/%m/%d')
    for i, result_bytes in enumerate(results, 1):
        key = f"processed/{ts}/{user_id}/{job_id}_part_{i}.pdf"
        await storage_service.put_bytes(key, result_bytes)
        output_keys.append(key)

    return {"status": "completed", "output_keys": output_keys, "count": len(results)}


async def process_compress(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    """Compress a PDF."""
    data = await storage_service.get_bytes(files[0])
    level = CompressionLevel(options.get("level", "medium"))
    result = pdf_engine.compress(data, level=level)

    output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}.pdf"
    await storage_service.put_bytes(output_key, result)

    return {
        "status": "completed",
        "output_key": output_key,
        "original_size": len(data),
        "compressed_size": len(result),
        "ratio": round((1 - len(result) / len(data)) * 100, 1) if data else 0,
    }


async def process_pdf_to_word(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    """Convert PDF to Word document."""
    data = await storage_service.get_bytes(files[0])
    result = pdf_engine.pdf_to_word(data)

    output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}.docx"
    await storage_service.put_bytes(output_key, result, content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    return {"status": "completed", "output_key": output_key}


async def process_word_to_pdf(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    """Convert Word to PDF using LibreOffice headless."""
    import subprocess
    import tempfile

    data = await storage_service.get_bytes(files[0])

    with tempfile.TemporaryDirectory() as tmp:
        input_path = f"{tmp}/input.docx"
        with open(input_path, "wb") as f:
            f.write(data)

        # LibreOffice headless conversion
        result = subprocess.run(
            ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", tmp, input_path],
            capture_output=True,
            timeout=120,
        )
        if result.returncode != 0:
            return {"status": "failed", "error": f"LibreOffice failed: {result.stderr.decode()}"}

        output_path = f"{tmp}/input.pdf"
        with open(output_path, "rb") as f:
            result_bytes = f.read()

    output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}.pdf"
    await storage_service.put_bytes(output_key, result_bytes)

    return {"status": "completed", "output_key": output_key}


async def process_pdf_to_jpg(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    """Convert PDF to JPG images."""
    data = await storage_service.get_bytes(files[0])
    dpi = options.get("dpi", 150)
    images = pdf_engine.pdf_to_jpg(data, dpi=dpi)

    ts = datetime.now(timezone.utc).strftime('%Y/%m/%d')
    output_keys = []
    for i, img in enumerate(images, 1):
        key = f"processed/{ts}/{user_id}/{job_id}_page_{i}.jpg"
        await storage_service.put_bytes(key, img, content_type="image/jpeg")
        output_keys.append(key)

    return {"status": "completed", "output_keys": output_keys, "count": len(images)}


async def process_jpg_to_pdf(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    """Convert JPG images to PDF."""
    images = []
    for key in files:
        img_bytes = await storage_service.get_bytes(key)
        images.append(img_bytes)

    result = pdf_engine.jpg_to_pdf(images)

    output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}.pdf"
    await storage_service.put_bytes(output_key, result)

    return {"status": "completed", "output_key": output_key}


async def process_ocr(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    """OCR a scanned PDF."""
    data = await storage_service.get_bytes(files[0])
    language = options.get("language", "eng")
    text = await pdf_engine.ocr(data, language=language)

    # Store text + return
    output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}.txt"
    await storage_service.put_bytes(output_key, text.encode("utf-8"), content_type="text/plain")

    return {"status": "completed", "output_key": output_key, "char_count": len(text)}


async def process_rotate(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    data = await storage_service.get_bytes(files[0])
    result = pdf_engine.rotate(data, degrees=options.get("degrees", 90), pages=options.get("pages"))
    output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}.pdf"
    await storage_service.put_bytes(output_key, result)
    return {"status": "completed", "output_key": output_key}


async def process_watermark(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    data = await storage_service.get_bytes(files[0])
    result = pdf_engine.add_watermark(data, text=options.get("text", "CONFIDENTIAL"))
    output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}.pdf"
    await storage_service.put_bytes(output_key, result)
    return {"status": "completed", "output_key": output_key}


async def process_add_page_numbers(job_id: str, user_id: str, files: list[str], options: dict) -> dict:
    data = await storage_service.get_bytes(files[0])
    result = pdf_engine.add_page_numbers(data, position=options.get("position", "bottom-center"))
    output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}.pdf"
    await storage_service.put_bytes(output_key, result)
    return {"status": "completed", "output_key": output_key}


# ─── AI jobs ──────────────────────────────────────────────────
@celery_app.task(name="app.tasks.ai_summarize", bind=True, max_retries=2, queue="ai")
def ai_summarize(self, user_id: str, pdf_key: str, language: str = "en") -> dict:
    """Summarize a PDF using Gemini."""
    async def _run() -> dict:
        pdf_bytes = await storage_service.get_bytes(pdf_key)
        text = pdf_engine.extract_text(pdf_bytes)

        request = ChatRequest(
            pdf_text=text,
            question="Please provide a concise summary of this document in 3-5 bullet points. "
                     "Highlight the key takeaways and any action items.",
            language=language,
            model="flash-8b",
        )

        # Collect streamed response
        full_text = ""
        async for chunk in ai_orchestrator.stream_chat(request, cache=cache_service):
            full_text += chunk.text

        # Store result
        job_id = str(uuid.uuid4())
        output_key = f"processed/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{user_id}/{job_id}_summary.md"
        await storage_service.put_bytes(output_key, full_text.encode("utf-8"), content_type="text/markdown")

        return {"status": "completed", "output_key": output_key, "summary": full_text}

    return run_async(_run())


# ─── Email jobs ────────────────────────────────────────────────
@celery_app.task(name="app.tasks.send_email", queue="email")
def send_email_task(to: list[str], subject: str, html: str) -> dict:
    """Send a transactional email."""
    from app.services.email import email_service
    from app.services.email import EmailMessage
    from pydantic import EmailStr

    msg = EmailMessage(
        to=[EmailStr(t) for t in to],
        subject=subject,
        html=html,
    )
    return run_async(email_service.send(msg))
