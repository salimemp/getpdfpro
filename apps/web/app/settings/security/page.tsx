"use client";

/**
 * /settings/security — Multi-Factor Authentication (TOTP) and
 * WebAuthn/Passkey management.
 *
 * Three sections:
 *  1. Authenticator app (TOTP) — enroll / list / remove
 *  2. Passkeys — list / add / remove
 *  3. Recovery codes — regenerate
 *
 * All data flows through lib/auth-mfa.ts which talks directly to
 * Supabase Auth (TOTP) and the browser's WebAuthn API (passkeys).
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  Shield,
  KeyRound,
  Smartphone,
  Trash2,
  Plus,
  RefreshCw,
  Copy,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  enrollTotp,
  verifyTotpEnrollment,
  registerPasskey,
  unenrollFactor,
  listFactors,
  generateBackupCodes,
  type Passkey,
  type TotpEnrollment,
} from "@/lib/auth-mfa";
import type { Factor } from "@supabase/supabase-js";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function SecuritySettingsPage() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.replace("/login?next=/settings/security");
    }
  }, [auth.loading, auth.user, router]);

  if (auth.loading || !auth.user) {
    return (
      <div className="container-narrow flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="container-narrow py-12">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Security
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Manage multi-factor authentication, passkeys, and recovery codes
        for your account.
      </p>
      <div className="mt-8 space-y-8">
        <TotpSection />
        <PasskeySection />
        <RecoveryCodesSection />
      </div>
    </div>
  );
}

// -- TOTP section --------------------------------------------------------

function TotpSection() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [showCodes, setShowCodes] = useState<string[] | null>(null);
  const [codesConfirmed, setCodesConfirmed] = useState(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const f = await listFactors();
      setFactors(f.totp);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onEnroll = () => {
    setError(null);
    setEnrollment(null);
    setShowCodes(null);
    setEnrolling(true);
    startTransition(async () => {
      try {
        const e = await enrollTotp("Authenticator app");
        setEnrollment(e);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start enrollment");
      } finally {
        setEnrolling(false);
      }
    });
  };

  const onVerify = () => {
    if (!enrollment) return;
    setVerifyError(null);
    startTransition(async () => {
      try {
        await verifyTotpEnrollment(enrollment.factorId, verifyCode.trim());
        const codes = generateBackupCodes();
        setShowCodes(codes);
        setEnrollment(null);
        setVerifyCode("");
        await refresh();
      } catch (err) {
        setVerifyError(err instanceof Error ? err.message : "Invalid code");
      }
    });
  };

  const onRemove = (factorId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await unenrollFactor(factorId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove");
      }
    });
  };

  return (
    <section
      data-testid="totp-section"
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <Smartphone className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Authenticator app (TOTP)</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Use Google Authenticator, Authy, 1Password, or any other
            TOTP app to generate 6-digit codes.
          </p>
        </div>
      </header>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {state === "loading" && (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
        {state === "ready" && factors.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No authenticator apps registered.
          </p>
        )}
        {state === "ready" &&
          factors.map((f) => (
            <div
              key={f.id}
              data-testid="totp-factor"
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <div>
                <p className="font-medium">
                  {f.friendly_name || "Authenticator app"}
                </p>
                <p className="text-xs text-slate-500">
                  Added {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                data-testid="totp-remove"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          ))}
      </div>

      {!enrollment && state === "ready" && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onEnroll}
            disabled={enrolling}
            data-testid="totp-enroll"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enrolling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {factors.length === 0 ? "Add an authenticator app" : "Add another"}
          </button>
        </div>
      )}

      {enrollment && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-medium">Scan this QR code</p>
          <p className="mt-1 text-xs text-slate-500">
            Or enter the secret manually: <code className="font-mono">{enrollment.secret}</code>
          </p>
          <div className="mt-3 flex justify-center">
            {enrollment.qrCode.startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={enrollment.qrCode}
                alt="TOTP enrollment QR code"
                data-testid="totp-qr"
                className="h-48 w-48 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700"
              />
            ) : (
              <QrCodeFromUri uri={enrollment.qrCode} />
            )}
          </div>
          <div className="mt-4 space-y-2">
            <label
              htmlFor="totp-code"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              6-digit code
            </label>
            <input
              id="totp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              data-testid="totp-code"
              className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
            />
            {verifyError && (
              <p className="text-sm text-red-600" data-testid="totp-verify-error">
                {verifyError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onVerify}
                disabled={verifyCode.length !== 6}
                data-testid="totp-verify"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Verify and enable
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnrollment(null);
                  setVerifyCode("");
                  setVerifyError(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCodes && (
        <RecoveryCodesModal
          codes={showCodes}
          onClose={() => {
            setShowCodes(null);
            setCodesConfirmed(false);
          }}
          confirmed={codesConfirmed}
          onConfirm={() => setCodesConfirmed(true)}
        />
      )}
    </section>
  );
}

// Tiny inline QR renderer — uses the canvas API to draw a QR code
// from an otpauth:// URI. For our needs (TOTP only), we just hand the
// URI to the user as a text fallback. To keep the bundle small we
// don't ship a full QR encoder; we render the secret as a copyable
// text block instead. The enroll() response's `qr_code` field is
// usually a base64 SVG/PNG data URL, so this branch is rare.
function QrCodeFromUri({ uri }: { uri: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-700">
      <p className="mb-1 text-slate-500">otpauth URI:</p>
      <code className="block break-all font-mono text-[10px] text-slate-700 dark:text-slate-300">
        {uri}
      </code>
    </div>
  );
}

// -- Passkey section ----------------------------------------------------

function PasskeySection() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const f = await listFactors();
      setPasskeys(f.webauthn);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAdd = () => {
    setError(null);
    setAdding(true);
    startTransition(async () => {
      try {
        await registerPasskey(name || "Passkey");
        setName("");
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add passkey");
      } finally {
        setAdding(false);
      }
    });
  };

  const onRemove = (factorId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await unenrollFactor(factorId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove");
      }
    });
  };

  return (
    <section
      data-testid="passkey-section"
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Passkeys</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sign in with Touch ID, Face ID, Windows Hello, or a hardware
            security key. No password needed.
          </p>
        </div>
      </header>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {state === "loading" && (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
        {state === "ready" && passkeys.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No passkeys registered.
          </p>
        )}
        {state === "ready" &&
          passkeys.map((p) => (
            <div
              key={p.factorId}
              data-testid="passkey-row"
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <div>
                <p className="font-medium" data-testid="passkey-name">
                  {p.friendlyName}
                </p>
                <p className="text-xs text-slate-500">
                  Added {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(p.factorId)}
                data-testid="passkey-remove"
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          ))}
      </div>

      {state === "ready" && (
        <div className="mt-5 flex items-end gap-2">
          <div className="flex-1">
            <label
              htmlFor="passkey-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Friendly name
            </label>
            <input
              id="passkey-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="MacBook Touch ID"
              data-testid="passkey-name-input"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <button
            type="button"
            onClick={onAdd}
            disabled={adding}
            data-testid="passkey-add"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add a passkey
          </button>
        </div>
      )}
    </section>
  );
}

// -- Recovery codes section ---------------------------------------------

function RecoveryCodesSection() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onRegenerate = () => {
    setError(null);
    startTransition(() => {
      try {
        setCodes(generateBackupCodes());
        setCopied(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate codes");
      }
    });
  };

  const onCopy = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      // Some browsers block clipboard in iframes; surface a hint.
      setError("Could not copy to clipboard — please select and copy manually");
    }
  };

  return (
    <section
      data-testid="recovery-section"
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
          <Shield className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Recovery codes</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            One-time backup codes you can use to sign in if you lose your
            authenticator device. Each code works only once.
          </p>
        </div>
      </header>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5">
        <button
          type="button"
          onClick={onRegenerate}
          data-testid="recovery-regenerate"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" />
          {codes ? "Generate a new set" : "Generate recovery codes"}
        </button>
      </div>

      {codes && (
        <div
          data-testid="recovery-codes"
          className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
        >
          <p className="text-sm font-medium">
            Save these codes somewhere safe.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Generating a new set will invalidate any previous codes.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3">
            {codes.map((c) => (
              <code
                key={c}
                data-testid="recovery-code"
                className="rounded border border-slate-200 bg-white px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-900"
              >
                {c}
              </code>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onCopy}
              data-testid="recovery-copy"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy all"}
            </button>
            <button
              type="button"
              onClick={() => setCodes(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Hide
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// -- Backup codes modal (shown right after TOTP enrollment) -------------

function RecoveryCodesModal({
  codes,
  onClose,
  confirmed,
  onConfirm,
}: {
  codes: string[];
  onClose: () => void;
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
}) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-modal-title"
      data-testid="recovery-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <h3
            id="recovery-modal-title"
            className="text-lg font-semibold"
          >
            Save your recovery codes
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          If you lose access to your authenticator app, these 10 codes
          are the only way back into your account. Each works once.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
          {codes.map((c) => (
            <code
              key={c}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-950"
            >
              {c}
            </code>
          ))}
        </div>
        <label className="mt-5 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => onConfirm(e.target.checked)}
            data-testid="recovery-modal-confirm"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-slate-700 dark:text-slate-200">
            I&apos;ve saved these codes somewhere safe.
          </span>
        </label>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={!confirmed}
            data-testid="recovery-modal-close"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
