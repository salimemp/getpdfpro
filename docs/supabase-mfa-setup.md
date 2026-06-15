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

### Step 1 — Open the Multi-Factor Authentication settings

1. Open
   <https://supabase.com/dashboard/project/osjtyipxwpkmzsextbne/auth/users>
   in your browser.
2. In the **left sidebar**, click **Authentication** (the shield icon).
3. Inside the Authentication section, click **Multi-Factor
   Authentication** (sometimes rendered as **MFA** in the left
   navigation). The path is `Authentication → Multi-Factor
   Authentication`, and the direct URL is
   <https://supabase.com/dashboard/project/osjtyipxwpkmzsextbne/auth/mfa>.
4. Keep this page open for the next two steps.

### Step 2 — Set the TOTP (App Authenticator) control

1. On the **Multi-Factor Authentication** page, find the row labelled
   **TOTP (App Authenticator)**. (It is the first row at the top of
   the page — *not* nested inside a "Multi-Factor Authentication"
   section on the Sign In / Up page.)
2. The control is a **3-way Select**, not a binary switch. Click it
   and pick one of the following values:
   - **Enabled** — any signed-in user can enrol a TOTP authenticator
     from their account-security page. There is **no** second-factor
     challenge at login; the factor is enrolled but the user is not
     actually prompted for a 6-digit code on subsequent sign-ins.
   - **Verify Enabled** *(recommended for GetPDFPro)* — same as
     Enabled, *plus* the user is required to enter a fresh 6-digit
     TOTP code at every login once a factor is enrolled. This is the
     option that actually defends against a stolen password.
   - **Disabled** — TOTP is off entirely. Users cannot enrol and the
     server will reject any `mfa.enroll({factor_type: "totp"})` call
     with `not_enabled`.
3. **Pick `Verify Enabled`** for our security posture. The
   verification harness in
   [`scripts/verify_supabase_mfa.py`](../scripts/verify_supabase_mfa.py)
   asserts the project is in a state that *allows* TOTP enrolment;
   `Verify Enabled` satisfies that and also enforces the challenge.
4. Click **Save** at the bottom of the panel.

### Step 3 — Confirm the project is in MFA-ready state

1. On the **Multi-Factor Authentication** page, look at the row
   **TOTP (App Authenticator)** — the Select should now read
   **Verify Enabled** (or `Enabled` if you deliberately picked that).
2. The helper text below should read "Users can enrol a TOTP
   authenticator app from the account security page."
3. The verification harness in
   [`scripts/verify_supabase_mfa.py`](../scripts/verify_supabase_mfa.py)
   will fail-fast with a clear error if TOTP is set to `Disabled`
   when it tries to enrol.

### Step 4 — Sanity check the JWT settings

1. In the **left sidebar** under **Authentication**, click **Sign In
   / Up**, then click the **JWT** tab (path:
   `Authentication → Sign In / Up → JWT settings`).
2. Make sure the **JWT expiry** is at least 3600 seconds (1 hour). The
   default is fine. We do NOT want to lower this because MFA challenge
   flows sometimes add 30-60 s of clock skew.
3. Click **Save** if you changed anything.

### Step 5 — Lock down the rate limits

1. In the **left sidebar** under **Authentication**, click **Rate
   Limits** (path: `Authentication → Rate Limits`).
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

> **Important path note** — Passkeys live at their **own top-level
> menu item** in the left sidebar (`Authentication → Passkeys`), not
> nested under `Multi-Factor Authentication`. In the Supabase
> `apps/studio/components/interfaces/Auth/` source, `Passkeys/` and
> `MfaAuthSettingsForm/` are sibling folders, and the dashboard
> navigation reflects that. The direct URL is
> <https://supabase.com/dashboard/project/osjtyipxwpkmzsextbne/auth/passkeys>.

### Step B-1 — Open the Passkeys page

1. In the **left sidebar**, click **Authentication** (the shield
   icon). You will see **Passkeys** as a sibling menu item of
   **Multi-Factor Authentication** — not inside it.
2. Click **Passkeys**. The direct URL is
   <https://supabase.com/dashboard/project/osjtyipxwpkmzsextbne/auth/passkeys>.
3. Keep this page open for the rest of Section B.

### Step B-2 — Enable the Passkeys toggle

1. At the top of the **Passkeys** page there is a single row with a
   **Passkeys** toggle (sometimes labelled "Enable Passkeys"). Flip
   it **on**.
2. The panel expands. Fill in **exactly three fields**:
   - **Relying Party Display Name** — the human-readable name shown
     in the browser's passkey prompt. For us: **`GetPDFPro`**.
   - **Relying Party ID** — the **registrable domain** you serve the
     web app from. For us: **`getpdfpro.com`** (NOT
     `app.getpdfpro.com`, NOT `www.getpdfpro.com` — the RP ID must
     be a parent of the origin that calls
     `navigator.credentials.create`).
   - **Relying Party Origins** — a **comma-separated list of full
     origins** (scheme + host + optional port) from which a user is
     allowed to enrol a passkey. Up to 5 entries. List **every
     origin** the GetPDFPro app runs on, e.g.:
     ```
     https://app.getpdfpro.com,https://getpdfpro.com,http://localhost:3000
     ```
     Add your preview/staging domains too (e.g.
     `https://getpdfpro-git-feat-*.vercel.app` patterns) — these
     are the URLs your team will click from during testing.
3. Click **Save**.

> **Common mistake:** putting a bare domain (no scheme) into
> **Relying Party Origins**. Each origin must start with `https://`
> (or `http://` for local dev) and have no trailing path. The
> browser validates these against the current origin at enrolment;
> if the origin does not match, the user will see "This passkey is
> not registered for this site".

> **Field that does NOT exist** — there is no **"User verification"**
> control on the current Passkeys page. Do not look for it; it has
> been removed in the current Supabase UI. If you want stricter
> user-verification semantics (UV = `required` instead of
> `preferred`), that has to be set in the server config, not the
> dashboard.

### Step B-3 — Confirm the field state

1. Reload the Passkeys page.
2. The **Passkeys** toggle should now be blue / "Enabled" and the
   three fields (**Relying Party Display Name**, **Relying Party
   ID**, **Relying Party Origins**) should show the values you
   entered.
3. Open a private/incognito browser window and visit
   `https://app.getpdfpro.com` (or whichever origin you put in
   **Relying Party Origins**). When the page calls
   `navigator.credentials.create(...)`, the browser should show a
   passkey prompt naming **GetPDFPro** as the relying party. If it
   does not, your **Relying Party ID** does not match the origin —
   re-check Step B-2.

### Step B-4 — Verify the server is configured

1. The verify script will exercise this path during CI as soon as
   support for `factor_type="webauthn"` lands in the Python SDK
   (currently only TOTP is exposed through the supabase-python
   `auth.mfa` surface; passkeys on the server are validated by the JS
   / Flutter client). For now the harness confirms the **server side
   is configured** by checking the dashboard state via
   `supabase.auth.admin.list_factors(...)` — if the route is enabled
   server-side, the call returns 200.
2. For end-to-end coverage of the actual WebAuthn flow, run the
   `feat/web-mfa-passkey-ui` and `feat/mobile-mfa-passkey-ui` test
   suites (they exercise `navigator.credentials.create` / the Flutter
   `webauthn` plugin against the origin you just whitelisted).

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
| TOTP control | `Authentication → Multi-Factor Authentication → TOTP (App Authenticator)` (3-way Select: Enabled / Verify Enabled / Disabled) |
| Passkeys control | `Authentication → Passkeys` (top-level menu item, NOT nested under Multi-Factor Authentication) |
| Passkey fields | `Relying Party Display Name`, `Relying Party ID`, `Relying Party Origins` (comma-separated, up to 5) |
| JWT expiry | `Authentication → Sign In / Up → JWT settings` |
| Rate limits | `Authentication → Rate Limits` |
| Service role key | `Project Settings (gear icon, bottom of left sidebar) → API → Project API keys → service_role` (click "Reveal") |
| Project URL | same screen, top of the **API Keys** panel — "Project URL" |

---

## F. Troubleshooting

- **"Authenticator app: TOTP enrolment not enabled for this project"** —
  the TOTP (App Authenticator) Select is set to `Disabled`. Re-do
  Step A.2 and pick `Verify Enabled` (or `Enabled` if you only want
  enrolment without the login challenge).
- **"Invalid factor_type 'totp'"** — the Python SDK you have is older
  than 2.8.0. `pip install --upgrade "supabase>=2.8.0"`.
- **"Passkey RP ID mismatch"** — the **Relying Party ID** you entered
  in Step B.2 is not a parent of the current origin. Re-check Step
  B.2 and make sure the origin you are testing from is also listed
  in **Relying Party Origins**.
- **"This passkey is not registered for this site"** at enrolment —
  the **Relying Party Origins** list in Step B.2 does not include
  the current origin. Add it (remember: full origin including
  `https://`, comma-separated, up to 5 entries) and retry.
- **The script creates users that do not get cleaned up** — this means
  `verify_supabase_mfa.py` crashed mid-flow. Look at the last
  `[error]` line. The `finally` block should still have tried to
  delete the user, but if it failed too, run:
  ```sql
  -- in the Supabase SQL editor
  delete from auth.users where email like 'mfa-verify-%';
  ```
