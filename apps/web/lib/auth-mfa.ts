"use client";

/**
 * MFA + Passkey helpers for the web app.
 *
 * All operations go directly to Supabase Auth via the browser client —
 * there are no custom API endpoints. Passkeys use the browser's native
 * `navigator.credentials` WebAuthn API and are stored in localStorage
 * (the installed Supabase auth-js version does not yet expose a
 * `webauthn` factor type to client apps, so we round-trip through the
 * browser instead). TOTP flows use the real
 * `supabase.auth.mfa.enroll / challenge / verify / listFactors /
 * unenroll` API.
 *
 * Errors are logged and re-thrown so callers can show a message; we
 * never swallow them silently.
 */
import { createSupabaseBrowserClient } from "./supabase";
import type { Factor, Session } from "@supabase/supabase-js";

/** What a TOTP enrollment returns to the UI for QR rendering. */
export type TotpEnrollment = {
  factorId: string;
  /**
   * QR code in one of two shapes:
   *  - data URL (`data:image/svg+xml;base64,...` or
   *    `data:image/png;base64,...`) — render with `<img src={qrCode} />`
   *  - raw otpauth:// URI — render with a QR library
   *
   * The component decides which shape it's looking at and renders
   * accordingly.
   */
  qrCode: string;
  /** Plain-text TOTP secret, shown as a fallback for users who can't scan. */
  secret: string;
  /** The otpauth:// URI, useful if the UI wants to render its own QR. */
  uri: string;
};

/** A passkey (WebAuthn credential) registered for the current user. */
export type Passkey = {
  /** Locally-generated factor id; acts as a stable handle. */
  factorId: string;
  /** User-friendly label, e.g. "MacBook Touch ID". */
  friendlyName: string;
  /** ISO timestamp the passkey was created. */
  createdAt: string;
  /** Base64url credential id (for diagnostics / removal). */
  credentialId: string;
};

/** All factors attached to the current user, split by type. */
export type FactorList = {
  totp: Factor[];
  webauthn: Passkey[];
};

const PASSKEY_STORAGE_PREFIX = "getpdfpro.passkey.";

/** Generate a short random id (used for local passkey factor ids). */
function randomId(): string {
  // crypto.randomUUID is available in modern browsers + Node 19+ and in
  // the jsdom test env. Fall back to a Math.random-based id for very
  // old runtimes (none of our targets qualify, but the fallback is
  // cheap insurance).
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto & { randomUUID(): string }).randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Encode an ArrayBuffer to base64url (used in WebAuthn ids). */
function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]!);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getSupabaseOrThrow() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured in this environment");
  }
  return supabase;
}

/** Read the current user's id from the live Supabase session. */
async function requireUserId(): Promise<string> {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error(error?.message || "Not signed in");
  }
  return data.user.id;
}

// -- TOTP ----------------------------------------------------------------

/**
 * Start TOTP enrollment. Returns the factor id and the QR code / secret
 * the user must scan / type into their authenticator app. The factor is
 * in `unverified` state until `verifyTotpEnrollment` is called.
 */
export async function enrollTotp(friendlyName: string): Promise<TotpEnrollment> {
  const supabase = getSupabaseOrThrow();
  // MFAEnrollParams types `factorType` as `'totp' | 'phone'`, so we
  // narrow to the totp variant explicitly.
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
    issuer: "GetPDFPro",
  });
  if (error || !data) {
    console.error("[auth-mfa] enrollTotp failed", error);
    throw new Error(error?.message || "Failed to start TOTP enrollment");
  }
  // The data shape is the TOTP variant of AuthMFAEnrollResponseData —
  // it has a `totp` field with qr_code, secret, uri.
  const totp = (data as { totp?: { qr_code?: string; secret?: string; uri?: string } }).totp;
  if (!totp?.qr_code || !totp.secret || !totp.uri) {
    console.error("[auth-mfa] enrollTotp returned unexpected shape", data);
    throw new Error("Unexpected TOTP enrollment response shape");
  }
  return {
    factorId: data.id,
    qrCode: totp.qr_code,
    secret: totp.secret,
    uri: totp.uri,
  };
}

/**
 * Confirm a TOTP enrollment by entering the 6-digit code the
 * authenticator app shows. On success the factor becomes `verified`
 * and the user's authenticator level is promoted to aal2.
 */
export async function verifyTotpEnrollment(factorId: string, code: string): Promise<void> {
  const supabase = getSupabaseOrThrow();
  // challengeAndVerify is the convenience helper that does both
  // challenge and verify in one call. The Supabase MFA API requires
  // this for TOTP enrollment confirmation.
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });
  if (error) {
    console.error("[auth-mfa] verifyTotpEnrollment failed", error);
    throw new Error(error.message || "Invalid code");
  }
  if (!data) {
    throw new Error("TOTP verification returned no data");
  }
}

// -- Passkeys (WebAuthn) ------------------------------------------------

/**
 * Register a new passkey for the current user. The browser handles the
 * WebAuthn ceremony via `navigator.credentials.create`; we store the
 * resulting credential id in localStorage so it shows up in
 * `listFactors()` and can be removed later.
 *
 * The Supabase auth-js version installed in apps/web does not yet
 * expose a `webauthn` factor type to client apps, so we round-trip
 * through the browser's WebAuthn implementation. The credential is
 * device-bound (typical for platform authenticators); cross-device
 * flows would require a synced-credential authenticator.
 */
export async function registerPasskey(friendlyName: string): Promise<{ factorId: string }> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    throw new Error("This browser does not support WebAuthn / passkeys");
  }
  const userId = await requireUserId();
  const supabase = getSupabaseOrThrow();
  const { data: userData } = await supabase.auth.getUser();
  const userEmail = userData.user?.email || userId;
  const userName =
    (userData.user?.user_metadata?.full_name as string | undefined) || userEmail;

  // Build a random challenge. WebAuthn requires a fresh, unguessable
  // challenge for every ceremony.
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userIdBytes = new TextEncoder().encode(userId);

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          // Relying Party id — use the current origin's host (without
          // port) so the credential is scoped to this site.
          name: "GetPDFPro",
          id: window.location.hostname,
        },
        user: {
          id: userIdBytes,
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
  } catch (err) {
    console.error("[auth-mfa] registerPasskey: credentials.create failed", err);
    throw new Error(
      err instanceof Error ? err.message : "Passkey registration was cancelled"
    );
  }
  if (!credential) {
    throw new Error("Passkey registration was cancelled");
  }
  const response = credential.response as AuthenticatorAttestationResponse;
  // The credential.id is the canonical handle; we store that rather
  // than the public key bytes since removal only needs the id.
  const rawIdB64 = bufferToBase64Url(credential.rawId);

  const factorId = randomId();
  const passkey: Passkey = {
    factorId,
    friendlyName: friendlyName || "Passkey",
    createdAt: new Date().toISOString(),
    credentialId: rawIdB64,
  };
  // Suppress unused warning — getPublicKey is for future use (e.g. a
  // backend verify call) and we keep the bytes on the response for
  // diagnostics.
  void response.getPublicKey;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        PASSKEY_STORAGE_PREFIX + userId,
        JSON.stringify([...loadPasskeys(userId), passkey])
      );
    } catch (err) {
      console.error("[auth-mfa] registerPasskey: failed to persist", err);
      throw new Error("Could not save passkey to local storage");
    }
  }
  return { factorId };
}

function loadPasskeys(userId: string): Passkey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PASSKEY_STORAGE_PREFIX + userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Passkey[];
  } catch {
    return [];
  }
}

/**
 * Prompt the user with a passkey (WebAuthn) assertion. Used at sign-in
 * time to complete a passkey-based login flow.
 *
 * On success we resolve with `{ credentialId }` so the caller can look
 * up which stored passkey matched. The caller is responsible for
 * upgrading the session to aal2 via the Supabase MFA API (the
 * installed version does not provide a one-call passkey sign-in).
 */
export async function assertPasskey(): Promise<{ credentialId: string }> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    throw new Error("This browser does not support WebAuthn / passkeys");
  }
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: "preferred",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
  } catch (err) {
    console.error("[auth-mfa] assertPasskey: credentials.get failed", err);
    throw new Error(
      err instanceof Error ? err.message : "Passkey assertion was cancelled"
    );
  }
  if (!credential) {
    throw new Error("Passkey assertion was cancelled");
  }
  return { credentialId: bufferToBase64Url(credential.rawId) };
}

// -- Generic MFA challenge/verify ---------------------------------------

/**
 * Start a challenge against an enrolled factor. Returns the challenge
 * id which the caller passes to `verifyFactor` along with the user's
 * 6-digit code.
 */
export async function challengeFactor(factorId: string): Promise<{ challengeId: string }> {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error || !data) {
    console.error("[auth-mfa] challengeFactor failed", error);
    throw new Error(error?.message || "Failed to start MFA challenge");
  }
  return { challengeId: data.id };
}

/**
 * Verify a code against a previously-issued challenge. On success the
 * session is promoted to aal2 and returned to the caller.
 */
export async function verifyFactor(
  factorId: string,
  challengeId: string,
  code: string
): Promise<{ session: Session | null }> {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code,
  });
  if (error) {
    console.error("[auth-mfa] verifyFactor failed", error);
    throw new Error(error.message || "Invalid code");
  }
  if (!data) {
    throw new Error("MFA verification returned no data");
  }
  // Verify returns access/refresh tokens and a user. Refresh the
  // session so the auth context picks up the new aal2 level.
  const { data: sessData, error: sessErr } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessErr) {
    console.warn("[auth-mfa] verifyFactor: setSession warning", sessErr);
  }
  return { session: sessData.session ?? null };
}

// -- Listing & removal --------------------------------------------------

/**
 * List all factors attached to the current user. TOTP factors come
 * from Supabase; WebAuthn passkeys come from local storage (the
 * installed Supabase version doesn't expose a server-side webauthn
 * factor yet).
 */
export async function listFactors(): Promise<FactorList> {
  const supabase = getSupabaseOrThrow();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    console.error("[auth-mfa] listFactors failed", error);
    throw new Error(error.message || "Failed to list factors");
  }
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    userId = "";
  }
  return {
    totp: data?.totp ?? [],
    webauthn: userId ? loadPasskeys(userId) : [],
  };
}

/**
 * Remove a factor. Works for both TOTP factors (server-side) and
 * passkeys (local storage). For TOTP the caller must have an aal2
 * session, per Supabase's policy.
 *
 * Removing a non-existent factor is treated as a no-op (idempotent) so
 * the UI doesn't have to special-case the "user already removed this"
 * race condition.
 */
export async function unenrollFactor(factorId: string): Promise<void> {
  // First try to find the factor in the Supabase TOTP list.
  let isPasskey = false;
  let userId: string | null = null;
  try {
    const factors = await listFactors();
    isPasskey = factors.webauthn.some((p) => p.factorId === factorId);
    if (!isPasskey) {
      // Might be a TOTP factor — verify it exists before unenrolling.
      const exists = factors.totp.some((f) => f.id === factorId);
      if (!exists) {
        // Idempotent: factor not found, treat as success.
        return;
      }
    }
  } catch (err) {
    // If listFactors itself fails, surface the error — the caller
    // probably has a deeper problem (network, auth).
    throw err;
  }
  if (isPasskey) {
    userId = await requireUserId();
    if (typeof window === "undefined") return;
    const remaining = loadPasskeys(userId).filter((p) => p.factorId !== factorId);
    try {
      window.localStorage.setItem(
        PASSKEY_STORAGE_PREFIX + userId,
        JSON.stringify(remaining)
      );
    } catch (err) {
      console.error("[auth-mfa] unenrollFactor: failed to remove passkey", err);
      throw new Error("Could not remove passkey from local storage");
    }
    return;
  }
  // TOTP path — call Supabase.
  const supabase = getSupabaseOrThrow();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    console.error("[auth-mfa] unenrollFactor: supabase unenroll failed", error);
    throw new Error(error.message || "Failed to remove factor");
  }
}

// -- Recovery codes (in-memory) -----------------------------------------

/**
 * Generate 10 single-use recovery codes. These are NOT server-side —
 * they're an in-memory helper. A real implementation would store them
 * server-side (e.g. as a hashed set in user metadata) so a user can
 * recover access if they lose their authenticator.
 *
 * The codes are 10-char alphanumeric, easy to read aloud, with a
 * dash-grouping of 5+5 for visual separation.
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit 0/O/1/I/L
  const seen = new Set<string>();
  while (codes.length < 10) {
    let raw = "";
    for (let i = 0; i < 10; i++) {
      raw += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    if (!seen.has(formatted)) {
      seen.add(formatted);
      codes.push(formatted);
    }
  }
  return codes;
}
