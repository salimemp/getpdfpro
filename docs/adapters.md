# PDF → Office conversion adapters

We use a 3-tier cascade for PDF → Word/Excel/PowerPoint conversion. Each
request picks the first available adapter; if it fails, we fall back.

| Tier | Adapter | Quality | Cost |
|---|---|---|---|
| 1 | **Adobe PDF Services** | 95-99% | Free up to 500 doc-txns/month |
| 2 | **LibreOffice (self-hosted)** | 90-95% | $0 (always, no API cost) |
| 3 | **Local PyMuPDF + python-docx** | 70-80% | $0 (always-available fallback) |

Each successful response carries an `X-Conversion-Adapter` header
(`adobe` / `libreoffice` / `local`) so we can see in logs which tier
served the request.

## Setup (one-time, ~5 min for Adobe + nothing for LibreOffice)

### 1. Adobe PDF Services (free tier, optional but recommended)

LibreOffice alone is fine for 99% of use cases. Adobe is the +5% quality
uplift if you have time to set it up.

1. Go to <https://developer.adobe.com/console/projects> and sign in
   (or create an Adobe Developer account).
2. Click **Create new project** → name it `getpdfpro-api`.
3. Under **Add APIs**, select **PDF Services API** → **Next** → **Save
   configured API**.
4. In the project dashboard, go to **Credentials** → click **Create
   credential** → **PDF Services API**.
5. Choose **OAuth Server-to-Server** (recommended for backend).
6. Copy the **Client ID** and **Client Secret** into the API's env:
   ```env
   ADOBE_CLIENT_ID=your_client_id_here
   ADOBE_CLIENT_SECRET=your_client_secret_here
   ```
7. On Railway: open `getpdfpro-api` → **Variables** → paste both.

**Free tier:** 500 Document Transactions / month, no credit card. A
PDF → Word on a 50-page document = 1 Document Transaction. At 100
conversions/month we're nowhere near the cap.

### 2. LibreOffice (self-hosted, automatic, free)

**Already installed** via the Dockerfile. The image includes
`libreoffice-core`, `libreoffice-writer`, `libreoffice-calc`, and
`libreoffice-impress`. Plus fonts (DejaVu, Liberation, Noto) so
rendering doesn't substitute missing fonts.

No env vars required. The adapter detects `soffice` on PATH at
runtime.

**Optional tuning** (env vars):
- `LIBREOFFICE_MAX_CONCURRENCY=2` — cap concurrent soffice processes
  (default 2; each uses ~150MB RAM). Bump to 4 on Railway Pro.
- `LIBREOFFICE_TIMEOUT_S=60` — per-conversion timeout (default 60s).
  LibreOffice can hang on malformed PDFs; we kill the process on
  timeout and fall through to the next adapter.

### 3. Local PyMuPDF (always-available, free)

No setup. Runs in-process. The last-resort fallback when both
external adapters fail or are exhausted.

## Cascade behavior

```
Request comes in
  ↓
Is Adobe configured AND have free-tier quota remaining?
  ├─ YES → use Adobe (best quality, free)
  └─ NO  ↓
       Is LibreOffice installed AND free?
       ├─ YES → use LibreOffice (very good quality, free)
       └─ NO  ↓
            Use local (always works, best-effort quality)
```

The cascade prefers **free + good → free + best → free + worst** so
we never accidentally spend money when we don't need to.

## Monitoring

The response header `X-Conversion-Adapter` tells you which tier
served each request. Log the count of each tier per month:

- `X-Conversion-Adapter: adobe` → high quality, was free
- `X-Conversion-Adapter: libreoffice` → very good quality, was free
- `X-Conversion-Adapter: local` → best-effort, was free, fallback

If "local" is appearing for >20% of traffic, you may want to debug
why LibreOffice is failing (check Railway logs for
"LibreOffice timed out" or "soffice exited N").

## When to upgrade

| Monthly conversions | Recommendation |
|---|---|
| 0-500 | Just LibreOffice + local. Don't bother with Adobe. |
| 500-2000 | Add Adobe (free tier still covers this) on top of LibreOffice. |
| 2,000+ | Both adapters working, you're at the limit of free tier. Move to paid Adobe or batch LibreOffice. |
| 10,000+ | Self-hosted LibreOffice + cluster. Adobe paid tier is no longer cheap. |

## Why this design

- **LibreOffice self-hosted is the cheapest decent-quality option
  in the world** — no per-conversion cost, no rate limits, ~250MB
  image, 90-95% quality. Beats CloudConvert's €0.072 per
  conversion at any meaningful volume.
- **Adobe free tier is the best quality deal** for the first 500
  conversions/month. We get 95-99% accuracy (matching Acrobat)
  for free. There's no reason not to add it on top of LibreOffice.
- **Local is the always-works safety net.** Quality is lower (70-80%)
  but we never get locked out or have to pay if the other two fail.

## Quality notes

- **Adobe:** 95-99% layout fidelity. Tables, images, fonts all
  preserved. Scanned PDFs work via the OCR endpoint.
- **LibreOffice:** 90-95% layout fidelity. Strong on tables and
  images. Some font substitution on unusual fonts. ~1-3s per
  page conversion time.
- **Local:** 70-80% layout fidelity. Text and basic structure only.
  Multi-column layouts, math, and complex tables get mangled.

All three return `.docx`, `.xlsx`, or `.pptx` files. The UI
clearly indicates which adapter served the conversion (the response
includes the adapter name in `X-Conversion-Adapter`).

## Image size impact

Adding LibreOffice to the API image:
- Before: ~600 MB (python:3.12-slim + tesseract + our deps)
- After:  ~850 MB (+250 MB for libreoffice + fonts)
- Railway free tier: 4 GB image limit, so still room for ~5x more.
- Railway Pro: 8 GB image limit, no concern.
- Cold start: 1-2 sec extra for the larger image to pull.
