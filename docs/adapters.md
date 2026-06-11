# PDF → Office conversion adapters

We use a 3-tier cascade for PDF → Word/Excel/PowerPoint conversion. Each
request picks the first available adapter; if it fails, we fall back.

| Tier | Adapter | Quality | Cost |
|---|---|---|---|
| 1 | **Adobe PDF Services** | 95-99% | Free up to 500 doc-txns/month |
| 2 | **CloudConvert** (PDFTron engine) | 90-95% | €0.072 per conversion (pay-as-you-go) |
| 3 | **Local PyMuPDF + python-docx** (built-in) | 70-80% | $0 (always available) |

Each successful response carries an `X-Conversion-Adapter` header
(`adobe` / `cloudconvert` / `local`) so we can see in logs which tier
served the request.

## Setup (one-time, ~10 min)

### 1. Adobe PDF Services (free tier)

1. Go to <https://developer.adobe.com/console/projects> and sign in
   (or create an Adobe Developer account).
2. Click **Create new project** → name it `getpdfpro-api`.
3. Under **Add APIs**, select **PDF Services API** → **Next** → **Save
   configured API**.
4. In the project dashboard, go to **Credentials** → click **Create
   credential** → **PDF Services API**.
5. Choose **OAuth Server-to-Server** (recommended for backend) or
   **JWT** (legacy, but still works for new credentials).
6. Copy the **Client ID** and **Client Secret** into the API's env:
   ```env
   ADOBE_CLIENT_ID=your_client_id_here
   ADOBE_CLIENT_SECRET=your_client_secret_here
   ```
7. On Railway: open the `getpdfpro-api` service → **Variables** tab →
   paste both keys with the same names.

**Free tier:** 500 Document Transactions / month, no credit card. A
PDF → Word conversion on a 50-page document = 1 Document Transaction.
At 100 conversions/month we're nowhere near the cap.

### 2. CloudConvert (fallback)

1. Go to <https://cloudconvert.com/register> and sign up.
2. Open <https://cloudconvert.com/dashboard/api/v2/keys>.
3. Click **Generate API key** → name it `getpdfpro` → copy the key.
4. Add to env:
   ```env
   CLOUDCONVERT_API_KEY=your_key_here
   ```
5. On Railway: add the env var the same way.

**Free tier:** 10 credits/day (1 PDF → Office = 4 credits, so 2 free
PDF-to-Office conversions per day). After that, pay-as-you-go is
€0.018/credit (so €0.072 per conversion). The "Package" plan starts
at €18 for 1,000 credits (one-time, never expire).

### 3. (Optional) Skip CloudConvert for now

If you only want Adobe + local fallback, leave `CLOUDCONVERT_API_KEY`
empty. The cascade will skip straight from Adobe to local when Adobe
is exhausted.

## Cascade behavior

```
Request comes in
  ↓
Is Adobe configured AND have free-tier quota remaining?
  ├─ YES → use Adobe (best quality, free)
  └─ NO  ↓
       Is CloudConvert configured AND enough credits?
       ├─ YES → use CloudConvert (good quality, ~€0.07)
       └─ NO  ↓
            Use local (always works, best-effort quality)
```

The cascade prefers **free → cheap → free** so we never accidentally
spend money when we don't need to.

## Monitoring

- **Adobe quota usage:** Adobe doesn't have a real-time quota API for
  free tier. We track it in the API logs: every response logs
  `X-Conversion-Adapter: adobe`. Count those per month to know your
  usage.
- **CloudConvert credits:** <https://cloudconvert.com/dashboard/usage>
- **Local:** no quota, but quality is worst — log frequency to see if
  we're hitting the fallback too often (means we need to upgrade
  CloudConvert or pay for Adobe).

## When to upgrade

| Monthly conversions | Recommendation |
|---|---|
| 0-500 | Adobe free tier only. Don't add CloudConvert. |
| 500-2000 | Adobe free tier + CloudConvert pay-as-you-go (€0.07 each). |
| 2000+ | Adobe paid tier (~€0.05/DT) or move to in-house LibreOffice. |
| 10,000+ | Self-hosted LibreOffice is cheaper than any cloud API. |

## Why this design

- **Adobe free tier is the best deal in PDF conversion** for the first
  500 conversions/month. We get 95-99% accuracy (matching Acrobat)
  for free. There's no reason not to use it.
- **CloudConvert is the cheapest paid fallback** with quality nearly
  matching Adobe. It uses PDFTron's engine under the hood (the same
  one that powers Foxit).
- **Local is the always-works safety net.** Quality is lower (70-80%)
  but we never get locked out or have to pay if the other two fail.

## Quality notes

- **Adobe:** 95-99% layout fidelity. Tables, images, fonts all
  preserved. Scanned PDFs work via the OCR endpoint.
- **CloudConvert:** 90-95% layout fidelity. Strong on tables and
  images. Some font substitution on unusual fonts.
- **Local:** 70-80% layout fidelity. Text and basic structure only.
  Multi-column layouts, math, and complex tables get mangled.

All three return `.docx` files. The UI clearly indicates which
adapter served the conversion (the response includes the adapter name
in `X-Conversion-Adapter`).
