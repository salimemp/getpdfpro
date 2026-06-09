# GetPDFPro — apps/api

FastAPI backend for PDF processing, AI integration, and queue management.

## Stack

- Python 3.12
- FastAPI
- PyMuPDF (fitz) for PDF rendering
- Celery + Redis for async jobs
- Supabase for auth + DB
- Google Gemini for AI
- Cloudflare R2 for file storage

## Local development

```bash
# from repo root
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill in the values

# Run API
uvicorn app.main:app --reload --port 8000

# Run worker (separate terminal, needs Redis)
celery -A app.worker worker --loglevel=info
```

API runs on http://localhost:8000. Docs at http://localhost:8000/docs.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| POST | `/api/v1/pdf/pdf-to-text` | Extract text from a PDF |
| POST | `/api/v1/pdf/merge` | Merge 2+ PDFs |

## Deploy

Pushed to `main` → auto-deploys to Railway.

Railway reads `Procfile` and `runtime.txt` at the root of this directory.
