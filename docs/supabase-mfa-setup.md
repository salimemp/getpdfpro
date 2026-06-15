# Supabase MFA Setup — GetPDFPro

This document walks you through enabling **TOTP** (authenticator app) and
**WebAuthn / Passkeys** (security key, Touch ID, Face ID, Windows Hello) on
the GetPDFPro Supabase project, plus the verification harness we use to
prove it works end-to-end.

- **Supabase project ref:** `osjtyipxwpkmzsextbne`
- **Supabase dashboard:** <https://supabase.com/dashboard/project/osjtyipxwpkmzsextbne>
- **Web (Next.js) client:** `apps/web` uses `@supabase/ssr` v0.5+ and
  `supabase-js` v2.45+, both of which expose `supabase.auth.mfa.*`.
- **Mobile (Flutter) client:** `apps/mobile` uses `supabase_flutter`
  v2.8+, which exposes the same `supabase.auth.mfa.*` API.

> **If you only have time to do one thing:** complete **Section A** (TOTP).
> TOTP is GA on the Free tier and is the most important second factor for
> our security posture. Passkeys (Section B) are the next step and are
> what we want to ship as our differentiator.

---

## A. Enable TOTP (Authenticator app) — 5 dashboard steps

TOTP is fully GA on the Supabase Free tier — no plan upgrade required.

### Step 1 — Open the Sign In / Up settings

1. Open
   <https://supabase.com/dashboard/project/osjtyipxwpkmzsextbne/auth/users>
   in your browser.
2. In the **left sidebar**, click **Authentication** (the shield icon).
3. Inside the Authentication section, click **Sign In / Up**.
4. The page that opens is **Sign In / Up** (path: `Authentication → Sign
   In / Up`). Keep this page open for the next two steps.

### Step 2 — Turn on Multi-Factor Authentication

1. On the **Sign In / Up** page, scroll down to the section titled
   **Multi-Factor Authentication** (sometimes rendered as **MFA** in
   the left navigation under Authentication).
2. Find the row labelled **Authenticator app (TOTP)**.
3. Toggle it **on** (the toggle is a switch on the right of the row).
4. The panel expands to show additional options. **Leave "Enrol on
   signup" OFF** for now — we want users to opt in explicitly so we
   don't lose signups behind an MFA wall.
5. Click **Save** at the bottom of the panel.

### Step 3 — Confirm the project is in MFA-ready state

1. In the same **Multi-Factor Authentication** section, look for the
   row **TOTP** (sometimes labelled "Authenticator app").
2. The toggle should now be blue / "Enabled" and the helper text below
   should read "Users can enrol a TOTP authenticator app from the
   account security page."
3. The verification harness in
   [`scripts/verify_supabase_mfa.py`](../scripts/verify_supabase_mfa.py)
   will fail-fast with a clear error if TOTP is off when it tries to
   enrol.

### Step 4 — Sanity check the JWT settings

1. Go to **Authentication → Sign In / Up → JWT settings** (or click
   the **JWT** tab in the same view).
2. Make sure the **JWT expiry** is at least 3600 seconds (1 hour). The
   default is fine. We do NOT want to lower this because MFA challenge
   flows sometimes add 30-60 s of clock skew.
3. Click **Save** if you changed anything.

### Step 5 — Lock down the rate limits

1. Go to **Authentication → Rate Limits** (path:
   `Authentication → Sign In / Up → Rate Limits`).
2. The defaults (30 emails / hour, 30 OTPs / hour) are fine.
3. MFA challenges count against the OTP rate limit. Do NOT increase it
   above the default 30 / hour per IP or you will weaken the MFA
   defence.

**Section A done.** You should now be able to:
- Sign a user up in the web app, log in, go to
  `/account/security`, click **Enable authenticator app**, scan the QR
  code with Google Authenticator / 1Password / Authy, and see the
  factor listed as **verified**.

---

## B. Enable WebAuthn / Passkeys (Touch ID, Face ID, security keys) — 4 dashboard steps

Passkeys are GA in Supabase Auth as of 2025 and ship in `auth-js`
2.65+ / `supabase_flutter` 2.8+. **They are on the Free tier** — no
plan upgrade required. (A previous beta period required Pro; that
restriction was lifted in 2025. If your dashboard shows a "Beta" badge
on the toggle, follow step B-1 to request beta access; in practice
this is no longer required for new projects.)

### Step B-1 — Open the same Multi-Factor Authentication section

1. Go back to
   <https://supabase.com/dashboard/project/osjtyipxwpkmzsextbne/auth/sign-in-up-providers>
   (or **Authentication → Sign In / Up** in the left sidebar).
2. Scroll back to the **Multi-Factor Authentication** section you used
   in **Section A**.
3. The rows under this section (in the order shown by the dashboard)
   are typically:
   - **Authenticator app (TOTP)** — set up in Section A.
   - **Passkeys (WebAuthn)** — the one we want now.
   - **Phone (SMS)** — leave OFF, we do not use SMS.

### Step B-2 — Enable the Passkeys (WebAuthn) toggle

1. Find the row **Passkeys (WebAuthn)**.
   - The dashboard may also label this row **"WebAuthn"**, **"Passkey"**,
     or **"Security key"** depending on the dashboard version you have.
   - In the **January 2026 dashboard** it is the row labelled
     **Passkeys (WebAuthn)**.
2. Toggle it **on**.
3. The panel expands. Fill in:
   - **Relying Party ID (RP ID)**: enter the **registrable domain**
     you serve the web app from. For us, that is **`getpdfpro.com`**
     (NOT `app.getpdfpro.com`, NOT `www.getpdfpro.com` — the RP ID
     must be a parent of the origin that calls `navigator.credentials.create`).
   - **Relying Party Name**: `GetPDFPro`
   - Leave **User verification** at the default `preferred`.
4. Click **Save**.

> **Common mistake:** using the full URL (`https://getpdfpro.com`) as
> the RP ID. The RP ID is a **domain only**, no protocol, no path. The
> browser validates this against the current origin; if it does not
> match, the user will see "This passkey is not registered for this
> site" at enrolment.

### Step B-3 — Add the Relying Party origins

The dashboard does not always expose this UI; in current versions it is
right under the toggle. If you see a field called **Origins**, list
every origin the user will be able to enrol a passkey from:

```
https://app.getpdfpro.com
https://getpdfpro.com
http://localhost:3000   # local web dev
```

Save the changes.

### Step B-4 — Confirm

1. Reload the page.
2. The **Passkeys (WebAuthn)** row should be blue / "Enabled".
3. The verify script will exercise this path during CI as soon as
   support for `factor_type="webauthn"` lands in the Python SDK
   (currently only TOTP is exposed through the supabase-python
   `auth.mfa` surface; passkeys on the server are validated by the JS /
   Flutter client). For now the harness confirms the **server side is
   configured** by checking the dashboard state via
   `supabase.auth.admin.list_factors(...)` — if the route is enabled
   server-side, the call returns 200.

---

## C. Quota, pricing, and "what's free" notes

| Feature | Plan required (as of Jan 2026) | Notes |
|---|---|---|
| TOTP (Authenticator app) | **Free** | GA. No MAU cost beyond standard auth. |
| WebAuthn / Passkeys | **Free** | GA. No MAU cost. |
| Phone (SMS) MFA | Pay-as-you-go | **OFF** for GetPDFPro — Twilio integration adds cost + compliance burden. |
| AAL2 enforcement | **Free** | Per-user. We do NOT enforce AAL2 globally because we have free-tier users who would churn. |
| Admin API (used by `verify_supabase_mfa.py`) | **Free** | Service role key only. Keep it out of the browser bundle. |

There is **no per-MFA-fee** on any current Supabase plan. The only
costs you should see while running the verification script are the
normal MAU charges for the temporary test user (which is deleted in
the same script run, so net MAU delta = 0).

If your project is on the **legacy Free** plan (pre-2024) you may see
a 50k MAU ceiling. GetPDFPro is on the new Free plan (post-2024) which
is 100k MAU. Either is fine for this work.

---

## D. Verifying it works (the harness)

After you complete Sections A and B, run the verification harness:

```bash
# 1. Pull the service role key from 1Password (vault: "GetPDFPro Infra",
#    item: "Supabase — osjtyipxwpkmzsextbne service_role"). NEVER commit it.
export SUPABASE_URL=https://osjtyipxwpkmzsextbne.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=sb_secret_…

# 2. Run the harness from the api package
cd apps/api
python -m pip install -r requirements.txt pyotp
python ../scripts/verify_supabase_mfa.py
```

Expected output on success:

```
2026-06-15 10:55:00 [info] creating test user mfa-verify-1749999…
2026-06-15 10:55:01 [info] signing in…
2026-06-15 10:55:02 [info] enrolling TOTP factor…
2026-06-15 10:55:03 [info] verifying TOTP code…
2026-06-15 10:55:04 [info] listing factors — got 1 verified totp factor
2026-06-15 10:55:05 [info] cleaning up factor + user
OK: Supabase MFA verified
```

If the env vars are not set, you will see:

```
skip: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set.
      set them in your shell (see docs/supabase-mfa-setup.md §D) to run
      the live verification. exiting 0.
```

… and the script exits **0** (this is intentional so CI does not
break for developers who don't have the service role key).

The unit tests in
[`tests/scripts/test_verify_supabase_mfa.py`](../apps/api/tests/scripts/test_verify_supabase_mfa.py)
mock the supabase client, so they pass in CI without any secrets:

```bash
cd apps/api
python -m pytest tests/scripts/test_verify_supabase_mfa.py -v
```

---

## E. Quick reference — dashboard path table

| What | Dashboard path (Jan 2026 UI) |
|---|---|
| TOTP toggle | `Authentication → Sign In / Up → Multi-Factor Authentication → Authenticator app (TOTP)` |
| Passkeys toggle | `Authentication → Sign In / Up → Multi-Factor Authentication → Passkeys (WebAuthn)` |
| RP ID / Origin | same panel, expands when toggle is on |
| JWT expiry | `Authentication → Sign In / Up → JWT settings` |
| Rate limits | `Authentication → Sign In / Up → Rate Limits` |
| Service role key | `Project Settings (gear icon, bottom of left sidebar) → API → Project API keys → service_role` (click "Reveal") |
| Project URL | same screen, top of the **API Keys** panel — "Project URL" |

---

## F. Troubleshooting

- **"Authenticator app: TOTP enrolment not enabled for this project"** —
  TOTP toggle is off. Re-do Step A.2.
- **"Invalid factor_type 'totp'"** — the Python SDK you have is older
  than 2.8.0. `pip install --upgrade "supabase>=2.8.0"`.
- **"Passkey RP ID mismatch"** — the RP ID is not a parent of the
  current origin. Re-do Step B.2.
- **The script creates users that do not get cleaned up** — this means
  `verify_supabase_mfa.py` crashed mid-flow. Look at the last
  `[error]` line. The `finally` block should still have tried to
  delete the user, but if it failed too, run:
  ```sql
  -- in the Supabase SQL editor
  delete from auth.users where email like 'mfa-verify-%';
  ```
