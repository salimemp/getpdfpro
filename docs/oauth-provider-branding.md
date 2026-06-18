# OAuth Provider Branding — GetPDFPro

This doc covers how to make Google's "Continue with Google" consent screen
show **"GetPDFPro"** instead of the raw Supabase project URL
(`osjtyipxwpkmzsextbne.supabase.co`).

## Why the Supabase URL shows up by default

When a user clicks **Continue with Google** on `/login`, the flow is:

1. Web app → `supabase.auth.signInWithOAuth({ provider: "google" })`
2. Supabase → Google OAuth with a **shared** Google client_id
   (`985680011394-...apps.googleusercontent.com`)
3. Google → consent screen saying **"to continue to `<your-project-ref>.supabase.co`"**
4. User consents → Google → Supabase callback → web app → `/account`

Supabase ships a generic Google OAuth app so projects can enable Google
sign-in without setup. The downside is the consent screen shows the
**Supabase project's URL**, not your brand. Google OAuth apps registered
after March 2024 also require brand verification for the app name/logo
to render.

The fix: register **your own Google OAuth credentials** and plug them
into Supabase. Same idea for GitHub, though Supabase's GitHub OAuth app
already shows a friendlier name on the consent screen, so it's lower
priority.

## Google: own OAuth credentials

**One-time, ~15 min.** No code changes — only dashboard config.

### Step 1 — Google Cloud Console

https://console.cloud.google.com → pick or create the GetPDFPro project.

### Step 2 — OAuth consent screen

**APIs & Services → OAuth consent screen** → **External** user type (or
**Internal** if you have a Workspace).

Fill in:
- **App name:** `GetPDFPro`
- **User support email:** `support@getpdfpro.com`
- **App logo:** upload your logo (PNG, **120×120 minimum** — Google will
  display this on the consent screen)
- **App domain → Authorized domains:** `getpdfpro.com`, `supabase.co`
- **Developer contact:** your email

Save.

### Step 3 — OAuth client ID

**APIs & Services → Credentials → Create credentials → OAuth client ID**:

- **Application type:** Web application
- **Name:** `GetPDFPro Web`
- **Authorized JavaScript origins:** *(leave empty — server-side flow only)*
- **Authorized redirect URIs:**
  ```
  https://osjtyipxwpkmzsextbne.supabase.co/auth/v1/callback
  ```
- Click **Create**.

Copy the **Client ID** and **Client secret**.

### Step 4 — Plug into Supabase

**Supabase Dashboard → Authentication → Providers → Google**:

- **Enable sign in with Google** → ON
- **Client ID** → paste your Client ID
- **Client Secret** → paste your Client secret
- **Skip nonce check** → OFF (leave default; only turn ON if you hit the
  "nonce mismatch" error in production)
- **Save**.

### Step 5 — Verify

Re-run the OAuth flow on https://app.getpdfpro.com/login. The Google
consent screen should now say **"to continue to GetPDFPro"** with your
logo. First-time users will also see a "GetPDFPro wants to access your
Google account" warning until you publish the app.

### Optional — publish the OAuth consent screen

While your app is in **Testing** mode, only test users you whitelist in
Google Cloud Console can complete the flow. Before public launch, click
**Publish App** on the OAuth consent screen. Google requires:

- App homepage at `https://getpdfpro.com`
- Privacy policy at `https://getpdfpro.com/privacy`
- Terms of service at `https://getpdfpro.com/terms`

(All three pages already exist on the production site.)

## GitHub: optional same treatment

GitHub OAuth consent screens show the **OAuth app's name** as registered
in GitHub Developer settings. Supabase's GitHub OAuth app currently shows
"GetPDFPro" on the consent screen (verified 2026-06-17 in
Playwright headless test), so no immediate action needed.

If you want full brand control:

1. https://github.com/settings/developers → **New OAuth App**
2. **Application name:** `GetPDFPro`
3. **Homepage URL:** `https://getpdfpro.com`
4. **Authorization callback URL:**
   `https://osjtyipxwpkmzsextbne.supabase.co/auth/v1/callback`
5. Register → copy Client ID, generate a Client secret
6. Supabase Dashboard → Authentication → Providers → GitHub → paste them

## Common gotchas

- **"Error 400: redirect_uri_mismatch"** — the Authorized redirect URI in
  Google Cloud Console must EXACTLY match
  `https://osjtyipxwpkmzsextbne.supabase.co/auth/v1/callback` (case-sensitive,
  trailing slash optional, but don't add query params).
- **Logo doesn't appear on consent screen** — logo only shows after brand
  verification. For external apps in production, Google requires a
  domain-verified email and 100+ users before granting verification.
  Until then the logo is replaced by a generic Google icon.
- **App shows "unverified" warning** — expected for new OAuth apps in
  production. Users can click "Advanced → Go to GetPDFPro (unsafe)" but
  most won't. Publish + brand verification removes the warning.
- **Same email already exists error** — when a user signs in with Google
  after previously signing up with email+password using the same email,
  Supabase tries to link the identities. This works automatically if both
  providers are enabled for the same project; if it fails, the user has
  to sign in with the original method first, then connect Google from
  `/account`.

## Reference

- Google OAuth Web server-side flow:
  https://developers.google.com/identity/protocols/oauth2/web-server
- Supabase OAuth providers doc:
  https://supabase.com/docs/guides/auth/social-login/auth-google
- Brand verification: https://support.google.com/cloud/answer/9110914
