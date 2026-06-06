# End-to-End Encryption (E2EE) — High-Level Architecture

> ⚠️ **This is a high-level architecture overview, not an implementation guide.**
> The actual crypto code must be implemented by a qualified security engineer
> and audited by a third-party firm before launch. We are NOT responsible
> for crypto bugs introduced by following any non-audited pattern.

---

## The Two Modes

### Mode 1: Standard (default)
- TLS in transit, AES-256 at rest
- Server can process files (compress, OCR, AI, etc.)
- Files auto-deleted after 24h
- **Trade-off:** We can theoretically access your file during processing
- **Use case:** Default for 99% of users

### Mode 2: Zero-Knowledge (opt-in)
- Files encrypted **client-side** BEFORE upload
- Server stores opaque ciphertext, has no key
- Server CANNOT decrypt, even if subpoenaed
- **Trade-off:** AI features and some advanced tools are unavailable for these files (server has no plaintext to work with)
- **Use case:** Sensitive data — journalists, lawyers, regulated industries

---

## What "Zero-Knowledge" Means in Practice

| Operation | Standard mode | Zero-Knowledge mode |
|---|---|---|
| Upload file | Server stores encrypted at rest | Client encrypts, server stores ciphertext |
| Merge / Split / JPG↔PDF | Server (fast, full quality) | Client (browser, using pdf-lib) |
| Compress | Server (MuPDF, smart algorithms) | Limited (client can do basic) |
| OCR | Server (Tesseract) | Not available |
| PDF → Word | Server | Not available |
| Voice read-aloud | Yes | Yes (client-side TTS) |
| AI features | Yes (opt-in) | **Not available** (no plaintext) |
| Account recovery | Email-based | Files are unrecoverable without user's recovery phrase |

---

## User Experience

### Where the toggle lives
Settings → Privacy → "Zero-Knowledge Mode"

### First-time setup
1. User toggles on
2. Sets a strong password (separate from account password)
3. Client generates a 12-word recovery phrase (BIP-39 standard)
4. User must confirm they saved the phrase
5. Tooltip: "If you forget your password and lose this phrase, your files are unrecoverable. We cannot help."

### In-product indicators
- 🔒 icon next to zero-knowledge files
- Persistent subtle banner when ZK mode is active
- Clear error messages when user tries AI on a ZK file: "This file is in zero-knowledge mode. AI features need plaintext access, which would break encryption. Disable ZK mode for this file, or process it locally."

---

## Server-Side Changes Needed (minimal)

The server changes very little — it just needs to:
1. Tag files as "zero_knowledge" or "standard" mode
2. Reject processing/AI requests for ZK files with HTTP 400 + clear error
3. Store the encryption mode flag in the database

No changes to storage layer (still R2), no changes to auth (still Supabase), no changes to billing.

---

## Client-Side Implementation (high level)

The client needs:

1. **Key derivation** from user password — use **Argon2id** (preferred) or **PBKDF2-SHA256 with 600K+ iterations** as fallback
2. **File encryption** — use the browser's native **Web Crypto API** (web) or **pointycastle** (Flutter) for AES-GCM-256
3. **Recovery phrase** — use **BIP-39** standard 12-word list
4. **Client-side PDF processing** — **pdf-lib** for merge/split/rotate/watermark, **pdfjs-dist** for rendering
5. **Client-side TTS** — native Web Speech Synthesis API (web) or **flutter_tts** (mobile)

### Where to get a security review
- **Crypto audit firms:** Trail of Bits, Cure53, NCC Group, Quarkslab
- **Cost:** $15,000–$50,000 for a full audit
- **When to do it:** Before launching ZK mode to production users, NOT before MVP

---

## Cost Impact

- **Storage:** Same (ciphertext is ~1% larger)
- **Compute:** **Saves** money — we don't process ZK files
- **Bandwidth:** Slightly higher (client downloads to process)
- **Support:** Higher (users will ask why AI doesn't work on ZK files)

**Net:** ZK mode is a cost win for us, AND a privacy win for users. Good place to differentiate vs iLovePDF (which doesn't offer it).

---

## Compliance & Marketing

### What we can claim
- "We offer optional zero-knowledge encryption for users who require it"
- "Your files are encrypted at rest with AES-256"
- "Files are auto-deleted within 24 hours of upload"

### What we CANNOT claim (without further certification)
- ❌ "HIPAA compliant" (need BAA program)
- ❌ "SOC 2 certified" (need audit)
- ❌ "Government-grade encryption" (vague but legally risky)

### What to do for production
1. Engage a crypto security firm for a focused review of the E2E implementation
2. Run a public bug bounty program
3. Publish a security whitepaper
4. Consider SOC 2 Type II in Phase 4 (post-PMF, post-revenue)

---

## Action Items for GetPDFPro

### MVP (now)
- [ ] Decide if ZK mode is in MVP or Phase 2
- [ ] If MVP: implement the basic client-side encrypt/decrypt + mode flag
- [ ] If Phase 2: ship standard mode only, add a "coming soon: zero-knowledge mode" badge for marketing

### Phase 2
- [ ] Implement ZK mode fully
- [ ] Add client-side PDF processing library (pdf-lib)
- [ ] Add recovery phrase flow

### Phase 3+ (when revenue justifies)
- [ ] Engage crypto audit firm
- [ ] Launch bug bounty program
- [ ] Publish security whitepaper
- [ ] Pursue SOC 2 Type II

---

## What This Document Does NOT Contain

- ❌ Specific crypto implementation code
- ❌ Specific key-derivation parameters
- ❌ Threat-model details that could help attackers
- ❌ Anti-forensics or anti-subpoena techniques
- ❌ Recommendations for evading lawful access requests

This is by design. Implementation must be done by a security engineer and
audited. Don't roll your own crypto based on internet examples.
