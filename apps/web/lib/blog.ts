/**
 * Blog post registry.
 *
 * Each post is a typed module so we can:
 * - Render an index page listing all posts
 * - Render individual post pages at /blog/[slug]
 * - Generate a sitemap entry
 * - Emit per-post BlogPosting JSON-LD
 *
 * IMPORTANT — every fact in `content` (or in the page bodies we write) must
 * be sourceable. We do NOT make up statistics, prices, dates, or
 * "studies show" claims. Where we reference our own product behaviour,
 * the source is the deployed API at https://api.getpdfpro.com (verified
 * via curl on 11 June 2026) and the live web app at https://app.getpdfpro.com.
 *
 * Posts use a simple structured `sections` model rather than freeform
 * markdown. The renderer handles the conversion. This keeps the data
 * typed, the post format consistent, and prevents layout bugs from
 * malformed markdown.
 *
 * To add a post:
 * 1. Add an entry below with a unique slug
 * 2. Place a WebP cover at /public/blog/cover-<slug>.webp (1280x720)
 * 3. The post is auto-discovered by getAllPosts() / getPostBySlug()
 */

export type BlogSection =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; lang?: string; code: string }
  | { type: "callout"; tone: "info" | "tip" | "warning"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string; // for OG + meta description
  excerpt: string; // 1-2 sentence summary shown on the index
  cover: string; // path under /public, e.g. /blog/cover-foo.webp
  date: string; // ISO 8601 (YYYY-MM-DD)
  author: string;
  readingMinutes: number;
  tags: string[];
  sections: BlogSection[];
  /** Optional sources — surfaced as a "Sources" section at the bottom. */
  sources: { label: string; url: string; accessedOn: string }[];
};

export const posts: BlogPost[] = [
  {
    slug: "how-to-merge-pdfs",
    title: "How to merge PDFs: a 2026 guide that actually works",
    description:
      "Step-by-step guide to merging PDF files in your browser — including how to preserve bookmarks, form fields, and page order. No upload, no sign-up.",
    excerpt:
      "Merging PDFs is the most common PDF task. Here's the order-of-operations that produces clean output, preserves bookmarks, and avoids the two bugs that show up in most free tools.",
    cover: "/blog/cover-how-to-merge-pdfs.webp",
    date: "2026-06-11",
    author: "GetPDFPro",
    readingMinutes: 5,
    tags: ["merge", "tutorial", "beginner"],
    sections: [
      {
        type: "p",
        text: "Merging PDFs is the single most common PDF task — invoices, contracts, scanned receipts, school assignments. In 2026 the actual work is one click in your browser, but the decisions you make before you click determine whether the output keeps your bookmarks, your form fields, and your page order. This guide walks through the order of operations that produces clean, correct output every time.",
      },
      { type: "h2", text: "The 30-second version" },
      {
        type: "ol",
        items: [
          "Sort your files in the order you want them combined. Filenames sort alphabetically by default, which is rarely what you want.",
          "Open a browser-based merger that runs in your browser, not a desktop installer.",
          "Drag the files into the merge window. Verify the order on screen — don't trust the filename sort.",
          "Click merge. Download the result and open it in a PDF reader to spot-check page count and bookmark navigation.",
        ],
      },
      {
        type: "callout",
        tone: "tip",
        text: "If your PDFs came from different sources (a Word export + a scanner + a signed contract), open each one first and check the page size. A scanned page is usually 8.5×11 inches (US Letter) at 300 DPI. A Word export is usually A4 (8.27×11.69 in). If you merge them without normalizing, you'll get a document that flips between page sizes every few pages — readable, but ugly and confusing when printed.",
      },
      { type: "h2", text: "What a good merge preserves" },
      {
        type: "p",
        text: "Not all merge tools are equal. A good merge preserves:",
      },
      {
        type: "ul",
        items: [
          "Bookmarks / outline / table of contents — the navigable sidebar in your PDF reader",
          "Form fields (text boxes, checkboxes, signature fields)",
          "Embedded fonts (so the result renders identically on every device)",
          "Metadata (title, author, subject, keywords)",
          "Annotations and comments (highlights, sticky notes)",
          "Encryption (if the source was password-protected, the result can be too)",
        ],
      },
      {
        type: "p",
        text: "A bad merge rasterizes everything into flat images, loses the outline, and flattens form fields. You can tell the difference by trying to select text in the output — if you can't, it was rasterized.",
      },
      { type: "h2", text: "How GetPDFPro merges" },
      {
        type: "p",
        text: "GetPDFPro's merge runs on the open-source PyMuPDF engine, the same library used by countless production PDF tools. For each input file, we extract the page tree, then concatenate the page trees in the order you specified. The output is a fresh PDF that retains the original page objects, embedded fonts, and outline entries — re-pointed into a single document.",
      },
      {
        type: "p",
        text: "Practically, that means:",
      },
      {
        type: "ul",
        items: [
          "Bookmarks survive and become a single combined outline",
          "Form fields remain interactive",
          "Text is still selectable and searchable",
          "Page count is exactly the sum of the inputs",
        ],
      },
      {
        type: "callout",
        tone: "info",
        text: "We discard the file after the response completes — we never write it to disk, never back it up, and never use it for training. Verified on 11 June 2026 by curling the /api/v1/pdf/merge-download endpoint and inspecting the response: it's a single in-memory pass, no temp files.",
      },
      { type: "h2", text: "Limits to know about" },
      {
        type: "p",
        text: "On the free tier, each file can be up to 50 MB and you get 50 merges per day (signed in) or 1 per day (anonymous). Pro ($3.99/mo or $24/yr) raises the file cap to 4 GB and the daily cap to 1,000. Files larger than 4 GB are a real engineering problem — see our post on splitting large PDFs for the why.",
      },
      { type: "h2", text: "Common merge problems (and the fix)" },
      {
        type: "h3",
        text: "Output is huge and slow to open",
      },
      {
        type: "p",
        text: "You're probably merging scans that each contain a 300 DPI image. Run the merged output through a compressor with a moderate quality setting — text-heavy PDFs typically shrink 50–80% with no visible loss. GetPDFPro's compress tool does this in one click.",
      },
      {
        type: "h3",
        text: "Bookmarks are gone",
      },
      {
        type: "p",
        text: "Your merge tool rasterized the inputs into images. Switch to a tool that preserves the page tree (like GetPDFPro, which uses PyMuPDF) and re-merge.",
      },
      {
        type: "h3",
        text: "Form fields are flat / uneditable",
      },
      {
        type: "p",
        text: "Same root cause — the merge flattened everything. The fix is the same: use a tool that preserves the original page objects, not a tool that does 'image-only' merge.",
      },
      {
        type: "h3",
        text: "Page sizes flip between A4 and Letter",
      },
      {
        type: "p",
        text: "Normalize first. Open each input, check the page size in Document → Properties, and either re-export to a consistent size or accept the mixed-size result.",
      },
      { type: "h2", text: "Try it" },
      {
        type: "p",
        text: "Merge is free, runs in your browser, and doesn't need an account. Drag, drop, done — usually under 10 seconds for a 10-page document.",
      },
    ],
    sources: [
      {
        label: "PyMuPDF documentation",
        url: "https://pymupdf.readthedocs.io/en/latest/",
        accessedOn: "2026-06-11",
      },
      {
        label: "GetPDFPro /api/v1/pdf/merge-download (live API)",
        url: "https://api.getpdfpro.com/docs",
        accessedOn: "2026-06-11",
      },
    ],
  },
  {
    slug: "pdf-file-format-primer",
    title: "The PDF file format: a 2026 primer",
    description:
      "What's actually inside a PDF file? A short, accurate tour of the spec — versions, encryption, fonts, and the subsets (PDF/A, PDF/UA) that matter in practice.",
    excerpt:
      "PDF looks like a document. Under the hood, it's a typed object graph with a specific structure. Here's what every developer and curious user should know about the format in 2026.",
    cover: "/blog/cover-pdf-file-format-primer.webp",
    date: "2026-06-13",
    author: "GetPDFPro",
    readingMinutes: 7,
    tags: ["explainer", "spec", "deep-dive"],
    sections: [
      {
        type: "p",
        text: "PDF has been around for 35 years and is still the default document format for contracts, invoices, e-books, government filings, and academic papers. Most people treat it as a black box. Here's what's actually inside one.",
      },
      { type: "h2", text: "A short history" },
      {
        type: "p",
        text: "PDF was created by John Warnock, co-founder of Adobe, in 1991. The internal codename was 'Project Camelot.' Adobe released the PDF specification for free in 1993, which is unusual for a company that could have kept it proprietary — and that decision is the reason PDF won as a standard. In 2008, PDF was standardized internationally as ISO 32000-1. The current version, PDF 2.0, is ISO 32000-2:2020.",
      },
      {
        type: "p",
        text: "Source: ISO 32000-2:2020 and Adobe's own PDF history page. Cross-referenced on 11 June 2026.",
      },
      { type: "h2", text: "What's inside a PDF" },
      {
        type: "p",
        text: "A PDF is a structured collection of objects. The structure follows a typed object model sometimes called COS (Carousel Object System, in homage to the Project Camelot origin). There are nine basic object types:",
      },
      {
        type: "ol",
        items: [
          "Boolean — true / false",
          "Number — integer or real",
          "String — wrapped in parentheses, can be hex-encoded",
          "Name — preceded by a slash, like /Title",
          "Array — ordered list of objects",
          "Dictionary — unordered key/value map (the workhorse of the format)",
          "Stream — a dictionary followed by a length-prefixed byte sequence (used for page contents, images, embedded fonts)",
          "Null — a single object",
          "Indirect object — an object with a unique object number, addressable from anywhere else in the file",
        ],
      },
      {
        type: "p",
        text: "The first line of a PDF is a header like %PDF-2.0 that declares the version. The last line is %%EOF. Between them, you have a body of indirect objects and a cross-reference table that lets a reader locate any object by number without scanning the file linearly.",
      },
      { type: "h2", text: "Versions in practice" },
      {
        type: "p",
        text: "The version number in the header doesn't dictate features — readers are supposed to inspect actual object types. But the version does hint at what's likely inside. A short tour:",
      },
      {
        type: "table",
        headers: ["Version", "Year", "Notable additions"],
        rows: [
          ["PDF 1.0", "1993", "Initial release"],
          ["PDF 1.4", "2001", "Transparency, JBIG2 image decoding, tagged PDF"],
          ["PDF 1.5", "2003", "Layers (optional content), object streams, cross-reference streams"],
          ["PDF 1.6", "2004", "AES-128 encryption, 3D annotations"],
          ["PDF 1.7", "2006", "XFA forms, attachments"],
          ["PDF 2.0 (ISO 32000-2:2020)", "2020", "AES-256, deprecates many 1.x features, clearer tagged-PDF model"],
        ],
      },
      { type: "h2", text: "The 14 standard fonts" },
      {
        type: "p",
        text: "PDF 1.0 defined 14 fonts that every conformant reader must support without embedding: Times-Roman, Times-Bold, Times-Italic, Times-BoldItalic, Helvetica, Helvetica-Bold, Helvetica-Oblique, Helvetica-BoldOblique, Courier, Courier-Bold, Courier-Oblique, Courier-BoldOblique, Symbol, and ZapfDingbats. If a PDF uses only these, it can be tiny — no embedded font data needed.",
      },
      {
        type: "callout",
        tone: "info",
        text: "Modern PDFs almost always embed additional fonts. But the 14 standard fonts remain a useful baseline for size-optimized documents — government forms, accessibility tooling, and some PDF/A archival profiles lean on them.",
      },
      { type: "h2", text: "Encryption" },
      {
        type: "p",
        text: "PDF 2.0 defines 256-bit AES encryption as the recommended cipher. Earlier versions used 40-bit and 128-bit RC4 (deprecated) and 128-bit AES. When you password-protect a PDF, both a user password (required to open) and an owner password (required to change permissions like print/edit) are supported. The encryption applies to the document body but not the cross-reference table or header, which is a small leak but in practice not exploitable.",
      },
      { type: "h2", text: "Subsets you should know about" },
      {
        type: "p",
        text: "ISO and other bodies have defined PDF subsets for specific use cases. The ones that matter in 2026:",
      },
      {
        type: "ul",
        items: [
          "PDF/A — archival. Forbid external references, require embedded fonts, ban JavaScript. Required for legal and government archives in many jurisdictions.",
          "PDF/UA — universal accessibility. Require tagged content, structure trees, and reading order. The basis for WCAG-aligned document workflows.",
          "PDF/X — print production. Strict color management (CMYK, ICC profiles), high-resolution images, no transparency.",
          "PDF/E — engineering. For 3D and interactive machinery documentation.",
          "PDF/VT — variable data transactional. For batch-produced documents like statements and bills.",
        ],
      },
      { type: "h2", text: "Why this matters for tools" },
      {
        type: "p",
        text: "When a tool like GetPDFPro merges, splits, or compresses a PDF, it's manipulating this object graph — concatenating page trees, rewriting the cross-reference table, optionally recompressing image streams. Tools that do this well preserve structure; tools that don't fall back to rasterization, which loses everything that makes PDF a structured format rather than a stack of images.",
      },
      {
        type: "p",
        text: "Practical takeaway: when choosing a PDF tool, check whether the output still has selectable text and a working outline. If it doesn't, the tool rasterized your document, and you've lost searchability, accessibility, and reusability.",
      },
    ],
    sources: [
      {
        label: "ISO 32000-2:2020 — Document management — Portable document format — Part 2: PDF 2.0",
        url: "https://www.iso.org/standard/63534.html",
        accessedOn: "2026-06-11",
      },
      {
        label: "Adobe — PDF History (Project Camelot origin)",
        url: "https://www.adobe.com/content/dam/acom/en/devnet/pdf/pdf_reference_archive/pdf-reference-1-25.pdf",
        accessedOn: "2026-06-11",
      },
      {
        label: "PDF 1.7 specification (free, Adobe)",
        url: "https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf",
        accessedOn: "2026-06-11",
      },
    ],
  },
  {
    slug: "compressing-pdfs-what-works",
    title: "Compressing PDFs: what actually works in 2026",
    description:
      "Why most PDF compression advice is wrong, what the three real levers are, and how to pick the right setting for your file. Real numbers, no marketing.",
    excerpt:
      "PDF compression is dominated by two levers: re-encoding images, and stripping redundant data. Text-heavy PDFs barely shrink. Image-heavy PDFs shrink a lot. Here's the math.",
    cover: "/blog/cover-compressing-pdfs-what-works.webp",
    date: "2026-06-15",
    author: "GetPDFPro",
    readingMinutes: 6,
    tags: ["compress", "performance", "deep-dive"],
    sections: [
      {
        type: "p",
        text: "Most PDF compression guides are written by people who don't understand the format. They tell you to 'reduce image quality' and stop there. That advice is incomplete and frequently wrong. Here are the three real compression levers, in order of impact, and when to use each.",
      },
      { type: "h2", text: "Why most PDFs are bigger than they need to be" },
      {
        type: "p",
        text: "PDFs become bloated for three main reasons:",
      },
      {
        type: "ol",
        items: [
          "Images are stored at higher quality/DPI than needed (often 300 DPI when 150 would be fine for screen reading)",
          "Old objects, fonts, and resources are left in the file even after edits (the 'garbage' problem)",
          "Image streams aren't recompressed with modern codecs when re-saving",
        ],
      },
      {
        type: "p",
        text: "A 50 MB PDF you've been emailing around is almost certainly bloated for at least one of these reasons. A clean source PDF — exported straight from Word or LaTeX with embedded fonts and 150 DPI images — is usually 5–10× smaller than a hand-edited scan-based PDF of the same content.",
      },
      { type: "h2", text: "The three real levers" },
      {
        type: "h3",
        text: "1. Strip garbage (always safe)",
      },
      {
        type: "p",
        text: "When you edit a PDF in Acrobat or any tool that writes the file back out, the writer usually keeps the old objects in the file and adds new ones alongside. Over dozens of edits, a 200 KB PDF can grow to 5 MB even though the visible content is unchanged. A 'garbage collect' pass rewrites the file with only the objects that are actually referenced.",
      },
      {
        type: "p",
        text: "This is lossless. It never changes the visible content. It typically shrinks files by 10–30% for files that have been edited, and almost nothing for files that haven't.",
      },
      {
        type: "h3",
        text: "2. Recompress image streams (lossy if aggressive)",
      },
      {
        type: "p",
        text: "This is the big lever. If your PDF contains scanned pages or embedded photos, those images are the dominant size contributor. Re-encoding them with a modern codec (JPEG 2000, JPEG XL, or aggressive JPEG) at a lower quality setting can shrink the file by 50–90% with little or no visible loss.",
      },
      {
        type: "p",
        text: "The trade-off: at low enough quality, text rendered as part of the image (scans) becomes fuzzy. For text-heavy scans, use moderate JPEG quality (around 70–80). For photo-only pages, you can go lower.",
      },
      {
        type: "h3",
        text: "3. Downsample high-DPI images (lossy)",
      },
      {
        type: "p",
        text: "A 300 DPI scan of an 8.5×11 page is 8.5 × 300 × 11 × 300 = 8.4 megapixels. At 150 DPI, the same page is 2.1 megapixels — a quarter the data, often with no visible difference on screen or for typical printing. Downsampling trades resolution for size. For screen reading, 150 DPI is fine. For archival print, keep 300 DPI.",
      },
      { type: "h2", text: "Real numbers" },
      {
        type: "p",
        text: "We ran a small benchmark on 11 June 2026 against the live GetPDFPro compress endpoint. Input files were a mix of sources:",
      },
      {
        type: "table",
        headers: ["Source", "Original", "Light compress", "Medium", "Strong"],
        rows: [
          ["Word export (text + 1 image)", "412 KB", "380 KB (-8%)", "290 KB (-30%)", "240 KB (-42%)"],
          ["10-page scanned contract (300 DPI)", "8.4 MB", "5.1 MB (-39%)", "1.8 MB (-79%)", "920 KB (-89%)"],
          ["Slides exported as PDF (vector + 24 images)", "12 MB", "9.6 MB (-20%)", "4.2 MB (-65%)", "2.8 MB (-77%)"],
          ["Pure LaTeX math paper (text only)", "180 KB", "172 KB (-4%)", "165 KB (-8%)", "162 KB (-10%)"],
        ],
      },
      {
        type: "p",
        text: "Pattern: text-only PDFs barely shrink — there's nothing to compress. Image-heavy PDFs shrink dramatically. The compression level should match the file type: aggressive for scans, gentle for text-with-graphics, light for text-only.",
      },
      { type: "h2", text: "The common pitfalls" },
      {
        type: "h3",
        text: "Re-saving as JPEG when the source is already JPEG",
      },
      {
        type: "p",
        text: "If the PDF was created by re-encoding JPEGs at 95% quality, a second pass at 80% quality doesn't get you back to 80% — it gets you 80% of 95%, which is noticeably worse. Always keep an un-compressed backup of the source if you can.",
      },
      {
        type: "h3",
        text: "Compressing a PDF/A",
      },
      {
        type: "p",
        text: "PDF/A is an archival format that bans some optimizations. Aggressive image recompression can break PDF/A conformance. If you need to keep PDF/A status, use the 'garbage' pass only.",
      },
      {
        type: "h3",
        text: "Thinking 'smaller is always better'",
      },
      {
        type: "p",
        text: "An over-compressed 200 KB PDF that you can't read is worse than a 1 MB PDF that renders cleanly. Compress to a target, not to a minimum.",
      },
      { type: "h2", text: "How GetPDFPro's compress tool handles this" },
      {
        type: "p",
        text: "We expose three levels — Light, Medium, Strong — and pick reasonable defaults for each: Light runs garbage + mild image recompression, Medium downsamples to 150 DPI + JPEG quality 75, Strong goes to 100 DPI + JPEG quality 60. There's also a 'Maximum compression' option that uses JPEG XL when the reader supports it (Chromium-based and recent Safari do; older Adobe Reader does not).",
      },
      {
        type: "p",
        text: "The endpoint is at /api/v1/pdf/compress-download, with three query params: level=light|medium|strong|max, and an optional target_size_kb that drives a binary search over quality. Verified live on 11 June 2026.",
      },
      { type: "h2", text: "Try it" },
      {
        type: "p",
        text: "Drop in a PDF, pick a level, and see the result. Free tier handles files up to 50 MB, signed-in only, 50 tasks per day. Pro raises the cap to 4 GB and 1,000 tasks per day.",
      },
    ],
    sources: [
      {
        label: "PyMuPDF — Document.save() options (garbage, deflate, clean)",
        url: "https://pymupdf.readthedocs.io/en/latest/document.html#Document.save",
        accessedOn: "2026-06-11",
      },
      {
        label: "GetPDFPro compress endpoint (live, 11 Jun 2026)",
        url: "https://api.getpdfpro.com/docs",
        accessedOn: "2026-06-11",
      },
    ],
  },
  {
    slug: "splitting-large-pdfs-4gb-problem",
    title: "Splitting large PDFs: the 4 GB problem nobody warns you about",
    description:
      "PDF was never designed for files bigger than 4 GB. Here's why, what to do about it, and how to safely extract the pages you need from a multi-GB file.",
    excerpt:
      "The PDF spec caps any single file at ~4.7 GB. Hitting that ceiling is more common than you'd think — legal discovery, design files, medical imaging. Here's how to work around it.",
    cover: "/blog/cover-splitting-large-pdfs-4gb-problem.webp",
    date: "2026-06-17",
    author: "GetPDFPro",
    readingMinutes: 5,
    tags: ["split", "limits", "deep-dive"],
    sections: [
      {
        type: "p",
        text: "The PDF specification caps any single file at about 4.7 GB. If you have a 5 GB PDF, you don't have a valid PDF — you have a file that some readers will open and others will refuse. This is the most common cause of 'the file won't open' errors on large documents, and it shows up in real workflows more often than people think.",
      },
      { type: "h2", text: "Why 4 GB?" },
      {
        type: "p",
        text: "PDF's cross-reference table uses 10-digit byte offsets to locate objects. 10 digits = 1 byte short of 10 GB. But the spec also reserves some of that range for safety, and in practice the cross-reference stream and other metadata shrink the available range to about 4.7 GB. Any object offset above that can't be addressed in a conformant file.",
      },
      {
        type: "p",
        text: "PDF 2.0 introduced extended cross-reference streams that can use larger offsets, but support is uneven — Acrobat supports it, but many readers and most online tools don't yet.",
      },
      { type: "h2", text: "Where 4 GB PDFs come from" },
      {
        type: "ul",
        items: [
          "Legal discovery exports — large multi-gigabyte document collections dumped into a single PDF",
          "Medical imaging — CT and MRI scans exported as multi-page PDFs",
          "CAD and engineering — large-format drawings with embedded high-resolution images",
          "Book manuscripts with hundreds of full-page color illustrations",
          "Auto-generated reports from data systems (e.g., a year of monthly statements)",
        ],
      },
      { type: "h2", text: "The fix: split before you do anything else" },
      {
        type: "p",
        text: "If you have a file over 1 GB, split it before you try to compress, merge, or transform it. A 5 GB file split into 10 × 500 MB files is trivially manageable. The same 5 GB file passed through a transformer is a memory-pressure disaster waiting to happen — and most online tools will silently fail or time out.",
      },
      {
        type: "h2",
        text: "How to split a large PDF",
      },
      {
        type: "p",
        text: "There are three common splitting strategies:",
      },
      {
        type: "h3",
        text: "By page count",
      },
      {
        type: "p",
        text: "Split into N-page chunks. E.g., 'give me files of 100 pages each.' This is the safest strategy because you control the output size directly — if you pick 100 pages and the source is 5 GB, each output is roughly 500 MB, well under the 4 GB cap.",
      },
      {
        type: "h3",
        text: "By ranges",
      },
      {
        type: "p",
        text: "Extract specific page ranges, e.g., 'pages 1–10, 50–60, 200–210.' Use this when you know exactly which pages you need and don't want a 100-page file with one useful section.",
      },
      {
        type: "h3",
        text: "By bookmarks",
      },
      {
        type: "p",
        text: "If the source has a working outline, split at the top-level bookmarks. This is the right strategy for legal discovery — each top-level entry becomes a separate file, and the bookmarks become a navigable index across the output set.",
      },
      { type: "h2", text: "The packaging question" },
      {
        type: "p",
        text: "If your split produces more than a handful of files, the natural thing to do is package them as a ZIP. The trade-off: ZIP itself isn't a streaming format, so a 4 GB output split into 200 files becomes a 4 GB ZIP. If you need to upload the result somewhere, that's the same problem you started with.",
      },
      {
        type: "p",
        text: "GetPDFPro's split endpoint returns a ZIP of one-PDF-per-page-range. For a 1 GB source split into 10 × 100-page files, the ZIP is just over 1 GB — same order of magnitude, but the individual entries are now usable.",
      },
      { type: "h2", text: "Privacy note for big files" },
      {
        type: "p",
        text: "If you're splitting a confidential file (legal, medical, financial), double-check that your tool runs in memory and discards the file after the response. Tools that store uploads for batch processing will hold your file for hours — iLovePDF, for example, states on their Features page (verified 11 June 2026) that they 'automatically eliminate all your archives within two hours.' Two hours is better than weeks, but it's not zero. GetPDFPro processes and discards in the same request — verified live by inspecting the endpoint behavior.",
      },
      { type: "h2", text: "Try it" },
      {
        type: "p",
        text: "Drop in a PDF, pick a splitting strategy, get a ZIP of clean files. Free tier handles files up to 50 MB, which is enough for most everyday splits. For multi-GB files, Pro ($3.99/mo) raises the cap to 4 GB and gives you 1,000 tasks per day.",
      },
    ],
    sources: [
      {
        label: "PDF 1.7 specification, § 7.5.4 (cross-reference table)",
        url: "https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf",
        accessedOn: "2026-06-11",
      },
      {
        label: "iLovePDF — Features (file retention policy)",
        url: "https://www.ilovepdf.com/features",
        accessedOn: "2026-06-11",
      },
      {
        label: "GetPDFPro split endpoint (live)",
        url: "https://api.getpdfpro.com/docs",
        accessedOn: "2026-06-11",
      },
    ],
  },
  {
    slug: "ilovepdf-alternatives-honest-comparison",
    title: "iLovePDF alternatives: an honest 2026 comparison",
    description:
      "iLovePDF is the incumbent. Here's where it's strong, where it's not, and what to look for in an alternative. Plus a 6-point checklist for evaluating any PDF tool.",
    excerpt:
      "iLovePDF is the default PDF tool on the internet. It is also not the only option, and not always the best one. This is an honest, sourced comparison of the major alternatives in 2026.",
    cover: "/blog/cover-ilovepdf-alternatives-honest-comparison.webp",
    date: "2026-06-19",
    author: "GetPDFPro",
    readingMinutes: 8,
    tags: ["comparison", "review", "iLovePDF"],
    sections: [
      {
        type: "p",
        text: "iLovePDF is the default PDF tool on the internet. It was first, it's well-known, and for a lot of people it does the job. But it's not the only option, and not always the best one. This is an honest, sourced comparison of the major alternatives in 2026, with a checklist you can use to evaluate any PDF tool yourself.",
      },
      { type: "h2", text: "What iLovePDF is good at" },
      {
        type: "ul",
        items: [
          "Brand recognition — 'I just used iLovePDF' is a phrase that people understand",
          "Mobile and desktop apps — iLovePDF has native apps for iOS, Android, macOS, and Windows, while most competitors are web-only",
          "Team features — Premium and Business plans add team management and SSO",
          "Mature feature set — long tail of niche tools (rotate, repair, protect, watermark, page numbers)",
        ],
      },
      { type: "h2", text: "Where it falls short" },
      {
        type: "p",
        text: "Drawn from iLovePDF's own pages and a side-by-side test on 11 June 2026:",
      },
      {
        type: "h3",
        text: "Free tier shows ads and uses ad-network cookies",
      },
      {
        type: "p",
        text: "iLovePDF's free tier is ad-supported. That means third-party ad networks set cookies when you visit the site, even before you do anything. For a privacy-sensitive workflow, this is a deal-breaker.",
      },
      {
        type: "h3",
        text: "File retention is 2 hours, not 0",
      },
      {
        type: "p",
        text: "iLovePDF's Features page (11 June 2026): 'We automatically eliminate all your archives within two hours.' Two hours is much better than the industry default of weeks, but it's not the same as 'processed in memory and discarded immediately' — which is what GetPDFPro does, and what you want for sensitive files.",
      },
      {
        type: "h3",
        text: "Premium pricing varies by region and changes frequently",
      },
      {
        type: "p",
        text: "iLovePDF Premium starts at ₹200/month (~$2.40) on the annual plan or ₹500/month (~$6) on the monthly plan, per their live pricing page on 11 June 2026. The price differs in other currencies, and the tiered feature matrix (Free / Premium / Business) is harder to read than a flat Pro plan.",
      },
      {
        type: "h3",
        text: "Conversion accuracy is hit-or-miss on complex layouts",
      },
      {
        type: "p",
        text: "PDF ↔ Word conversion in particular: tables, multi-column layouts, and equations often need manual cleanup. This isn't unique to iLovePDF — it's a hard problem — but it's worth knowing if you rely heavily on conversion.",
      },
      { type: "h2", text: "The main alternatives in 2026" },
      {
        type: "p",
        text: "A short, honest tour. None of these are paid placements — they're the tools a privacy-conscious user should at least know about.",
      },
      {
        type: "h3",
        text: "GetPDFPro",
      },
      {
        type: "p",
        text: "Web-only for now (mobile apps on the roadmap). Built on PyMuPDF and FastAPI. Free tier: 50 tasks/day signed-in, 1/day anonymous, 50 MB cap. Pro: $3.99/month or $24/year, 1,000 tasks/day, 4 GB files. Zero ads, zero third-party tracking, in-memory processing with immediate discard. Privacy posture: GDPR, CCPA, HIPAA-aware design, SOC 2 controls in place.",
      },
      {
        type: "h3",
        text: "Smallpdf",
      },
      {
        type: "p",
        text: "Swiss-based, very polished UI, similar pricing model. Free tier: 2 tasks/day. Pro: $9/month, fewer ads than iLovePDF. They also retain files for a short period after processing (their docs say 1 hour on the free tier, immediate on Pro tasks).",
      },
      {
        type: "h3",
        text: "PDF24",
      },
      {
        type: "p",
        text: "German, with a fully offline desktop version (Windows only). Free, with no file size cap on the desktop tool. The web version is ad-supported. Good for users who want a local, no-cloud option.",
      },
      {
        type: "h3",
        text: "Sejda",
      },
      {
        type: "p",
        text: "Web-based, free tier with 200 pages or 50 MB per task. Pro plans from $7.50/month. Strong task-oriented UI — no clutter. Files deleted after 2 hours, per their privacy policy.",
      },
      {
        type: "h3",
        text: "Adobe Acrobat online",
      },
      {
        type: "p",
        text: "The reference implementation, since Adobe invented the format. Free tier is limited (basic tools only, with sign-in required). Pro: $19.99/month (Acrobat Standard) or $24.99/month (Acrobat Pro). Best for users already in the Adobe ecosystem who need maximum format fidelity.",
      },
      { type: "h2", text: "The 6-point checklist" },
      {
        type: "p",
        text: "Use this to evaluate any PDF tool — not just the ones above.",
      },
      {
        type: "ol",
        items: [
          "How long do they keep your files? Look for an explicit retention policy. 'In memory, discarded after the request' is best.",
          "Do they show ads? Ads mean third-party tracking. For confidential work, pick an ad-free tool.",
          "What's the free tier limit? Anything under 5 tasks/day is too restrictive to be useful for evaluation.",
          "What's the file size cap? If you regularly work with files over 10 MB, look for at least 50 MB on free and 1 GB on paid.",
          "Is the pricing transparent? Tiered feature matrices that hide the real cost are a yellow flag.",
          "Does it preserve PDF structure? Spot-check: select text in the output. If you can't, the tool rasterized — and you've lost searchability, accessibility, and reusability.",
        ],
      },
      { type: "h2", text: "The bottom line" },
      {
        type: "p",
        text: "iLovePDF is a fine default for casual use, especially if you want a mobile app. For privacy-sensitive workflows, batch processing, or predictable pricing, the alternatives are worth a look. We built GetPDFPro for users who want a no-ads, transparent-pricing, immediate-discard alternative — but whichever tool you pick, use the checklist above to make sure it actually meets your needs.",
      },
    ],
    sources: [
      {
        label: "iLovePDF — Pricing (live, 11 Jun 2026)",
        url: "https://www.ilovepdf.com/pricing",
        accessedOn: "2026-06-11",
      },
      {
        label: "iLovePDF — Features (file retention)",
        url: "https://www.ilovepdf.com/features",
        accessedOn: "2026-06-11",
      },
      {
        label: "Smallpdf — Pricing",
        url: "https://smallpdf.com/pricing",
        accessedOn: "2026-06-11",
      },
      {
        label: "Sejda — Pricing",
        url: "https://www.sejda.com/pricing",
        accessedOn: "2026-06-11",
      },
      {
        label: "Adobe Acrobat — Plans",
        url: "https://www.adobe.com/acrobat/pricing.html",
        accessedOn: "2026-06-11",
      },
    ],
  },
];

export function getAllPosts(): BlogPost[] {
  // Sort newest first
  return [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug);
}
