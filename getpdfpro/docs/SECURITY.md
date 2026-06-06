# Security & Authentication

## Auth Stack (locked)

| Method | Implementation | Notes |
|---|---|---|
| Email + Password | Supabase Auth (Argon2id) | Min 12 chars, mixed case + digit + symbol |
| Email Verification | Supabase built-in | Sent via Resend, 1-hour expiry |
| Password Breach Check | HaveIBeenPwned Pwned Passwords API | k-anonymity, free, no API key |
| Google OAuth | Supabase Google provider | Official "G" logo |
| GitHub OAuth | Supabase GitHub provider | Official Octocat mark |
| Magic Link | Supabase built-in | 15-min expiry, single use |
| Biometrics (TouchID/FaceID/Windows Hello) | WebAuthn via Supabase | Device-bound |
| Passkey (cross-device) | WebAuthn passkey | Syncs via iCloud Keychain / Google Password Manager |
| 2FA (TOTP) | Supabase MFA | Phase 3, requires Pro tier $25/mo |

## Password Policy

**Minimum requirements** (enforced client AND server side):
- Length: 12+ characters
- Composition: at least one lowercase, one uppercase, one digit, one symbol
- Not in common weak passwords list (top 100, expandable)
- Not in HaveIBeenPwned breach database (k-anonymity check)

**Validation flow:**
```
1. User types password in signup form
2. Client validates strength (zxcvbn score ≥ 3)
3. Client calls /api/v1/auth/check-password (real-time feedback)
4. Server runs HIBP check (k-anonymity, only 5 chars of SHA-1 sent)
5. User sees "Password is strong" or "This password has been breached"
6. On signup submit, client calls Supabase auth.signUp
7. Supabase sends verification email via Resend
8. User clicks link, returns to app, fully verified
```

## JWT Flow

```
1. User authenticates with Supabase (any method)
2. Supabase returns a JWT (HS256-signed)
3. Frontend stores JWT in httpOnly cookie (web) or secure storage (mobile)
4. Frontend includes JWT in Authorization: Bearer header for API calls
5. FastAPI validates JWT signature with Supabase JWT secret
6. Extracts user_id, email, role from claims
7. All downstream logic uses this trusted user_id
```

## Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `/auth/check-password` | 30 req | per IP, per minute |
| `/files/upload-url` | 100 req | per user, per day |
| `/jobs` (create) | Free: 50/day, Pro: unlimited | per user |
| `/ai/credits` | Free: 50/mo, Pro: 1000/mo | per user |
| WebSocket `/ai/chat` | 10 concurrent, 30 msgs/min | per user |
| Auth endpoints | 10 failed attempts → 15min lockout | per IP |

All enforced via Redis (Upstash free tier) using sliding window counters.

## Data Privacy

- **Files in transit:** HTTPS only (Cloudflare SSL)
- **Files at rest:** R2 server-side encryption (SSE-S3)
- **Auto-cleanup:** Uploaded files deleted after 24h (Cloudflare Worker cron)
- **Processed files:** Signed URLs expire in 15 min
- **AI prompts:** Cached in Redis 24h, then purged
- **No tracking:** Plausible analytics, no cookies, no third-party trackers
- **GDPR:** Data export + account deletion in user settings
- **AI transparency:** Clear UI showing what data goes to Gemini, opt-in only

## Security Headers

Set in Next.js config and FastAPI middleware:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(self), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
```

## Incident Response

If a breach is suspected:
1. Rotate all secrets in 1Password / environment
2. Force-logout all sessions (Supabase admin API)
3. Invalidate all JWTs (Supabase JWT secret rotation)
4. Notify users within 72 hours (GDPR requirement)
5. Post-mortem within 2 weeks
