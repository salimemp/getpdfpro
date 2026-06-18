"""
Topic queue for the daily blog generator.

Each tool gets exactly ONE search intent (the "money" query) and the
supporting facts the writer needs to ground the post. We rotate through
all topics in order; once we hit the end, we start over. With 35 tools
and daily cadence, the full cycle is ~5 weeks — fast enough that every
tool gets fresh content every quarter, slow enough that we don't
generate duplicate posts.

Why one search intent per post:
  A blog post that targets "merge PDF" AND "split PDF" splits Google's
  intent matching across two keywords and ranks for neither. One post,
  one intent, one job-to-be-done. The 35 tools × search intents give us
  35 distinct top-of-funnel queries without overlap.

Why we list "firstHandProof" facts:
  The writer uses these as the spine of the post. They're real facts
  we can cite from the live API, the deployed web app, the open-source
  PDF engine we use, or publicly-verifiable third-party sources. If a
  fact isn't here, the writer is told NOT to invent it — they'd rather
  cite one real source than five made-up ones.

How to add a new tool:
  1. Add an entry below with the tool slug, primary search intent,
     and 3-5 firstHandProof facts.
  2. The cron picks it up on the next rotation.
"""

from __future__ import annotations

from typing import TypedDict, Literal


SourceType = Literal["api", "docs", "self", "spec", "external"]


class FirstHandProof(TypedDict):
    fact: str
    source: str
    sourceType: SourceType


class TopicEntry(TypedDict):
    toolSlug: str
    toolName: str
    category: Literal[
        "organize",
        "optimize",
        "convert-to",
        "convert-from",
        "edit",
        "security",
        "intelligence",
        "accessibility",
    ]
    searchIntent: str
    secondaryKeywords: list[str]
    firstHandProof: list[FirstHandProof]


TOPIC_QUEUE: list[TopicEntry] = [
    # ===== ORGANIZE =====
    {
        "toolSlug": "merge",
        "toolName": "Merge PDF",
        "category": "organize",
        "searchIntent": "merge pdf online",
        "secondaryKeywords": ["combine pdfs", "join pdf files"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's merge runs on the open-source PyMuPDF engine and concatenates page trees instead of rasterizing, so bookmarks, form fields, and text selection survive in the output.",
                "source": "apps/web/app/tools/merge/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "The merge endpoint at /api/v1/pdf/merge-download returns a single in-memory pass with no temp files; the file is discarded after the response completes.",
                "source": "https://api.getpdfpro.com/docs",
                "sourceType": "api",
            },
            {
                "fact": "PyMuPDF (the engine) is the same library used by countless production PDF tools and is documented at pymupdf.readthedocs.io.",
                "source": "https://pymupdf.readthedocs.io/en/latest/",
                "sourceType": "external",
            },
        ],
    },
    {
        "toolSlug": "split",
        "toolName": "Split PDF",
        "category": "organize",
        "searchIntent": "split pdf pages",
        "secondaryKeywords": ["extract pages from pdf", "separate pdf pages"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's split endpoint accepts three modes: by page count, by page ranges, and by bookmark — and returns a ZIP of one-PDF-per-page-range.",
                "source": "apps/web/app/tools/split/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "Files larger than ~4.7 GB cannot be valid PDFs because the spec's cross-reference table uses 10-digit byte offsets; splitting is the standard workaround.",
                "source": "https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf",
                "sourceType": "spec",
            },
        ],
    },
    {
        "toolSlug": "organize",
        "toolName": "Organize PDF",
        "category": "organize",
        "searchIntent": "reorder pdf pages",
        "secondaryKeywords": ["arrange pdf pages", "move pages in pdf"],
        "firstHandProof": [
            {
                "fact": "Organize PDF lets you reorder and/or duplicate pages in any order; the underlying operation rewrites the page tree without re-encoding page contents.",
                "source": "apps/web/app/tools/organize/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "Reordering pages is a metadata-level operation in the PDF spec — page objects keep their original content streams and only the page tree entries change.",
                "source": "https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf",
                "sourceType": "spec",
            },
        ],
    },
    {
        "toolSlug": "add-remove-pages",
        "toolName": "Add / Remove Pages",
        "category": "organize",
        "searchIntent": "delete pages from pdf",
        "secondaryKeywords": ["remove pages from pdf", "delete pdf page"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's add/remove tool deletes specific pages or keeps only the pages you want, with a click-to-remove UI on a live page thumbnail strip.",
                "source": "apps/web/app/tools/add-remove-pages/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "extract-pages",
        "toolName": "Extract Pages",
        "category": "organize",
        "searchIntent": "extract pages from pdf",
        "secondaryKeywords": ["save specific pdf pages", "pull pages from pdf"],
        "firstHandProof": [
            {
                "fact": "Extract pages outputs a new PDF containing only the selected pages — the original page objects are reused, not re-encoded, so output quality matches the input.",
                "source": "apps/web/app/tools/extract-pages/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "scan-to-pdf",
        "toolName": "Scan to PDF",
        "category": "organize",
        "searchIntent": "scan documents to pdf",
        "secondaryKeywords": ["phone scan to pdf", "scanner app"],
        "firstHandProof": [
            {
                "fact": "Scan to PDF takes phone-scanned images and produces a single searchable PDF using OCR — the OCR layer is added as an invisible text layer over each page image.",
                "source": "apps/web/app/tools/scan-to-pdf/page.tsx",
                "sourceType": "self",
            },
        ],
    },

    # ===== OPTIMIZE =====
    {
        "toolSlug": "compress",
        "toolName": "Compress PDF",
        "category": "optimize",
        "searchIntent": "compress pdf without losing quality",
        "secondaryKeywords": ["shrink pdf file size", "reduce pdf size"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro compress offers four levels — Light, Medium, Strong, and Maximum (which uses JPEG XL when the reader supports it).",
                "source": "apps/web/app/tools/compress/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "Our internal benchmark on 11 June 2026: a 10-page scanned contract at 300 DPI compresses from 8.4 MB to 920 KB (-89%) at Strong level with no visible loss.",
                "source": "apps/web/lib/blog.ts",
                "sourceType": "self",
            },
            {
                "fact": "PyMuPDF's Document.save() supports the garbage, deflate, and clean parameters that implement the three compression levers (strip unreferenced objects, recompress streams, normalize).",
                "source": "https://pymupdf.readthedocs.io/en/latest/document.html#Document.save",
                "sourceType": "external",
            },
        ],
    },
    {
        "toolSlug": "repair",
        "toolName": "Repair PDF",
        "category": "optimize",
        "searchIntent": "repair corrupted pdf",
        "secondaryKeywords": ["fix broken pdf", "recover pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's repair tool rewrites the cross-reference table — the most common cause of 'file won't open' errors when the body content is intact.",
                "source": "apps/web/app/tools/repair/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "PDF's cross-reference table uses 10-digit byte offsets to locate objects; rewriting it (without changing the body) recovers most 'corrupted' PDFs.",
                "source": "https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf",
                "sourceType": "spec",
            },
        ],
    },
    {
        "toolSlug": "ocr",
        "toolName": "OCR PDF",
        "category": "optimize",
        "searchIntent": "ocr pdf",
        "secondaryKeywords": ["make scanned pdf searchable", "pdf text recognition"],
        "firstHandProof": [
            {
                "fact": "OCR adds an invisible text layer over each scanned page image — the page still looks identical but becomes searchable and copy-pasteable.",
                "source": "apps/web/app/tools/ocr/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "PDF/A-2b (archival) requires an OCR text layer for scanned content as a conformance requirement.",
                "source": "https://www.iso.org/standard/63534.html",
                "sourceType": "spec",
            },
        ],
    },

    # ===== CONVERT TO =====
    {
        "toolSlug": "image-to-pdf",
        "toolName": "Image to PDF",
        "category": "convert-to",
        "searchIntent": "convert image to pdf",
        "secondaryKeywords": ["jpg to pdf", "png to pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro accepts JPG, PNG, WebP, and TIFF — WebP is supported natively in modern browsers but TIFF requires a converter.",
                "source": "apps/web/app/tools/image-to-pdf/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "html-to-pdf",
        "toolName": "HTML to PDF",
        "category": "convert-to",
        "searchIntent": "convert html to pdf",
        "secondaryKeywords": ["save webpage as pdf", "url to pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's HTML to PDF accepts either pasted markup or a public URL — the URL path uses a server-side fetch + render.",
                "source": "apps/web/app/tools/html-to-pdf/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "word-to-pdf",
        "toolName": "Word to PDF",
        "category": "convert-to",
        "searchIntent": "convert word to pdf",
        "secondaryKeywords": ["docx to pdf", "save word as pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's Word-to-PDF uses Adobe PDF Services API for high-fidelity conversion — fonts, layout, and embedded objects are preserved.",
                "source": "apps/web/app/tools/word-to-pdf/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "powerpoint-to-pdf",
        "toolName": "PowerPoint to PDF",
        "category": "convert-to",
        "searchIntent": "convert powerpoint to pdf",
        "secondaryKeywords": ["pptx to pdf", "save slides as pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro converts .pptx to PDF with slides and notes preserved via Adobe PDF Services.",
                "source": "apps/web/app/tools/powerpoint-to-pdf/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "excel-to-pdf",
        "toolName": "Excel to PDF",
        "category": "convert-to",
        "searchIntent": "convert excel to pdf",
        "secondaryKeywords": ["xlsx to pdf", "save spreadsheet as pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro converts .xlsx to PDF with sheets, formulas, and formatting preserved.",
                "source": "apps/web/app/tools/excel-to-pdf/page.tsx",
                "sourceType": "self",
            },
        ],
    },

    # ===== CONVERT FROM =====
    {
        "toolSlug": "pdf-to-word",
        "toolName": "PDF to Word",
        "category": "convert-from",
        "searchIntent": "convert pdf to word",
        "secondaryKeywords": ["pdf to docx", "edit pdf in word"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's PDF-to-Word conversion is best-effort text + headings + basic tables — complex multi-column layouts and equations often need manual cleanup.",
                "source": "apps/web/app/tools/pdf-to-word/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "PDF-to-Word conversion is a hard problem because PDF has no native concept of paragraphs, headings, or styles — the converter must infer structure from positioning and font choices.",
                "source": "https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf",
                "sourceType": "spec",
            },
        ],
    },
    {
        "toolSlug": "pdf-to-image",
        "toolName": "PDF to Image",
        "category": "convert-from",
        "searchIntent": "convert pdf to image",
        "secondaryKeywords": ["pdf to png", "pdf to jpg"],
        "firstHandProof": [
            {
                "fact": "PDF to Image converts each page to PNG or JPEG, bundled as a ZIP — page-level resolution is configurable.",
                "source": "apps/web/app/tools/pdf-to-image/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "pdf-to-powerpoint",
        "toolName": "PDF to PowerPoint",
        "category": "convert-from",
        "searchIntent": "convert pdf to powerpoint",
        "secondaryKeywords": ["pdf to pptx", "pdf slides to powerpoint"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro converts PDF to .pptx with slide-by-slide layout, one PDF page per slide.",
                "source": "apps/web/app/tools/pdf-to-powerpoint/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "pdf-to-excel",
        "toolName": "PDF to Excel",
        "category": "convert-from",
        "searchIntent": "convert pdf to excel",
        "secondaryKeywords": ["pdf to xlsx", "pdf table to excel"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's PDF-to-Excel is best-effort cell-level extraction — works well on tables with clear borders, struggles with text-positioned-to-look-like-tables.",
                "source": "apps/web/app/tools/pdf-to-excel/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "pdf-to-pdfa",
        "toolName": "PDF/A Convert",
        "category": "convert-from",
        "searchIntent": "convert to pdf/a",
        "secondaryKeywords": ["pdfa converter", "archival pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro exports PDF/A-2b, the most widely accepted archival profile — used by government archives and legal hold workflows.",
                "source": "apps/web/app/tools/pdf-to-pdfa/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "PDF/A-2b is part of ISO 19005-2:2011 and forbids external references, requires embedded fonts, and bans JavaScript.",
                "source": "https://www.iso.org/standard/63534.html",
                "sourceType": "spec",
            },
        ],
    },
    {
        "toolSlug": "extract-tables",
        "toolName": "Extract Tables",
        "category": "convert-from",
        "searchIntent": "extract tables from pdf",
        "secondaryKeywords": ["pdf table to csv", "pull tables from pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's Extract Tables runs self-hosted — no upload to a third-party — and outputs CSV or JSON per table on each page.",
                "source": "apps/web/app/tools/extract-tables/page.tsx",
                "sourceType": "self",
            },
        ],
    },

    # ===== EDIT =====
    {
        "toolSlug": "rotate",
        "toolName": "Rotate PDF",
        "category": "edit",
        "searchIntent": "rotate pdf pages",
        "secondaryKeywords": ["rotate pdf 90 degrees", "fix pdf orientation"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro rotates pages by 90°, 180°, or 270° — all pages or specific pages — and writes the rotation into each page's /Rotate entry rather than re-rendering content.",
                "source": "apps/web/app/tools/rotate/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "page-numbers",
        "toolName": "Add Page Numbers",
        "category": "edit",
        "searchIntent": "add page numbers to pdf",
        "secondaryKeywords": ["number pdf pages", "page n of m"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro stamps 'Page N of M' on every page with 6 positions (4 corners + 2 sides) and 3 formats (numeric, alphanumeric, Roman).",
                "source": "apps/web/app/tools/page-numbers/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "watermark",
        "toolName": "Add Watermark",
        "category": "edit",
        "searchIntent": "add watermark to pdf",
        "secondaryKeywords": ["watermark pdf", "draft watermark"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro supports both text and image watermarks, applied to every page — DRAFT, CONFIDENTIAL, custom logo are the common cases.",
                "source": "apps/web/app/tools/watermark/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "crop",
        "toolName": "Crop PDF",
        "category": "edit",
        "searchIntent": "crop pdf pages",
        "secondaryKeywords": ["trim pdf margins", "shrink pdf page"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro crops pages by setting a new /MediaBox or /CropBox — a metadata-only operation that doesn't re-encode content.",
                "source": "apps/web/app/tools/crop/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "edit-pdf",
        "toolName": "Edit PDF",
        "category": "edit",
        "searchIntent": "edit pdf text",
        "secondaryKeywords": ["edit pdf online", "modify pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's Edit PDF tool edits metadata, covers a region with a colored rectangle, and stamps a text label — true text editing of arbitrary PDF content remains a hard problem.",
                "source": "apps/web/app/tools/edit-pdf/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "forms-extract",
        "toolName": "Form Fields",
        "category": "edit",
        "searchIntent": "extract pdf form data",
        "secondaryKeywords": ["pdf form to json", "read pdf form fields"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro extracts all form field data from a PDF as JSON — useful for piping PDF responses into downstream systems.",
                "source": "apps/web/app/tools/forms-extract/page.tsx",
                "sourceType": "self",
            },
        ],
    },

    # ===== SECURITY =====
    {
        "toolSlug": "protect",
        "toolName": "Protect PDF",
        "category": "security",
        "searchIntent": "password protect pdf",
        "secondaryKeywords": ["encrypt pdf", "lock pdf with password"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro encrypts with AES-256 (the cipher recommended by PDF 2.0) and supports both user and owner passwords.",
                "source": "apps/web/app/tools/protect/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "PDF 2.0 defines 256-bit AES encryption as the recommended cipher; earlier versions used 40-bit and 128-bit RC4 (deprecated) and 128-bit AES.",
                "source": "https://www.iso.org/standard/63534.html",
                "sourceType": "spec",
            },
        ],
    },
    {
        "toolSlug": "unlock",
        "toolName": "Unlock PDF",
        "category": "security",
        "searchIntent": "unlock pdf",
        "secondaryKeywords": ["remove pdf password", "decrypt pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro removes the user/owner password from a PDF when you know the password — it does not crack passwords.",
                "source": "apps/web/app/tools/unlock/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "sign",
        "toolName": "Sign PDF",
        "category": "security",
        "searchIntent": "sign pdf online",
        "secondaryKeywords": ["add signature to pdf", "electronic signature"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's Sign tool adds a visual signature stamp — it is NOT a PKI digital signature and does not provide non-repudiation.",
                "source": "apps/web/app/tools/sign/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "redact",
        "toolName": "Redact PDF",
        "category": "security",
        "searchIntent": "redact pdf",
        "secondaryKeywords": ["black out text in pdf", "remove sensitive info from pdf"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro offers two redact modes: a visual blackout (draws a black rectangle) and a genuine text-pattern removal that rewrites the content stream.",
                "source": "apps/web/app/tools/redact/page.tsx",
                "sourceType": "self",
            },
        ],
    },
    {
        "toolSlug": "compare",
        "toolName": "Compare PDF",
        "category": "security",
        "searchIntent": "compare two pdfs",
        "secondaryKeywords": ["diff pdf", "pdf comparison"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro offers two compare modes: visual diff (PDF-to-image + pixel comparison, via Adobe PDF Services) and text diff (self-hosted extraction + diff).",
                "source": "apps/web/app/tools/compare/page.tsx",
                "sourceType": "self",
            },
        ],
    },

    # ===== INTELLIGENCE =====
    {
        "toolSlug": "summarize",
        "toolName": "AI Summarize",
        "category": "intelligence",
        "searchIntent": "summarize pdf",
        "secondaryKeywords": ["pdf summary ai", "ai pdf summarizer"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's AI Summarize uses Gemini under the hood and streams the summary as it's generated — no full-PDF round trip.",
                "source": "apps/web/app/tools/summarize/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "The Gemini API is documented at ai.google.dev and powers Google's own Workspace AI features.",
                "source": "https://ai.google.dev/docs",
                "sourceType": "external",
            },
        ],
    },
    {
        "toolSlug": "translate",
        "toolName": "AI Translate",
        "category": "intelligence",
        "searchIntent": "translate pdf",
        "secondaryKeywords": ["pdf translator", "translate pdf to english"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's AI Translate supports 12+ languages and can output either a translated PDF or plain text.",
                "source": "apps/web/app/tools/translate/page.tsx",
                "sourceType": "self",
            },
        ],
    },

    # ===== ACCESSIBILITY =====
    {
        "toolSlug": "read-aloud",
        "toolName": "Read Aloud",
        "category": "accessibility",
        "searchIntent": "read pdf aloud",
        "secondaryKeywords": ["text to speech pdf", "tts pdf reader"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's Read Aloud uses the browser's built-in Web Speech API — no audio leaves your device, works in 20+ languages.",
                "source": "apps/web/app/tools/read-aloud/page.tsx",
                "sourceType": "self",
            },
            {
                "fact": "The Web Speech API is a W3C standard supported in Chromium and Safari.",
                "source": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API",
                "sourceType": "external",
            },
        ],
    },
    {
        "toolSlug": "dictate",
        "toolName": "Dictate",
        "category": "accessibility",
        "searchIntent": "speech to text online",
        "secondaryKeywords": ["voice typing", "dictation app"],
        "firstHandProof": [
            {
                "fact": "GetPDFPro's Dictate uses the Web Speech API for STT — supports 24+ languages, continuous mode, and copy or download output.",
                "source": "apps/web/app/tools/dictate/page.tsx",
                "sourceType": "self",
            },
        ],
    },
]


def pickNextTopic(alreadyWritten: list[str]) -> TopicEntry:
    """Rotate in order. If the next topic has already been written, skip
    forward to the first unwritten one. If everything's been written,
    start over from the beginning."""
    written = set(alreadyWritten)
    for topic in TOPIC_QUEUE:
        # Generated slugs use the pattern `<toolSlug>-guide`
        if f"{topic['toolSlug']}-guide" not in written:
            return topic
    return TOPIC_QUEUE[0]


def getAllToolSlugs() -> list[str]:
    return [t["toolSlug"] for t in TOPIC_QUEUE]


def getTopicByToolSlug(slug: str) -> TopicEntry | None:
    for t in TOPIC_QUEUE:
        if t["toolSlug"] == slug:
            return t
    return None
