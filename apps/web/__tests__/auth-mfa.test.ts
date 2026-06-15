/**
 * Unit tests for lib/auth-mfa.ts helpers.
 *
 * We mock `createSupabaseBrowserClient` so the helpers can run in jsdom
 * without real Supabase env vars. The mock is a per-test factory that
 * lets each case describe which calls to expect and what to return.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enrollTotp,
  verifyTotpEnrollment,
  registerPasskey,
  challengeFactor,
  verifyFactor,
  listFactors,
  unenrollFactor,
  generateBackupCodes,
} from "@/lib/auth-mfa";

type MfaApi = {
  enroll: ReturnType<typeof vi.fn>;
  challengeAndVerify: ReturnType<typeof vi.fn>;
  challenge: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
  listFactors: ReturnType<typeof vi.fn>;
  unenroll: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
};

function makeSupabaseMock(mfa: Partial<MfaApi> = {}, getUserReturn?: unknown) {
  // Per-call default mocks. Tests that don't override setSession
  // (verifyFactor path) get a no-op success; tests that don't override
  // getUser get a fake user. Both defaults are applied only when the
  // caller didn't supply an override.
  const mfaFull: MfaApi = {
    enroll: vi.fn(),
    challengeAndVerify: vi.fn(),
    challenge: vi.fn(),
    verify: vi.fn(),
    listFactors: vi.fn(),
    unenroll: vi.fn(),
    setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "u@example.com" } },
      error: null,
    }),
    ...mfa,
  };
  if (getUserReturn !== undefined) {
    mfaFull.getUser.mockResolvedValue({ data: { user: getUserReturn }, error: null });
  }
  const supabase = {
    auth: {
      mfa: mfaFull,
      setSession: mfaFull.setSession,
      getUser: mfaFull.getUser,
    },
  };
  return { supabase, mfa: mfaFull };
}

let currentMock: ReturnType<typeof makeSupabaseMock> | null = null;

vi.mock("@/lib/supabase", () => ({
  createSupabaseBrowserClient: () => currentMock?.supabase ?? null,
}));

beforeEach(() => {
  // default: a Supabase client that's always available
  currentMock = makeSupabaseMock();
});

afterEach(() => {
  vi.clearAllMocks();
  // clear passkey storage between tests
  if (typeof window !== "undefined") {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("getpdfpro.passkey.")) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  }
});

describe("enrollTotp", () => {
  it("returns the QR code when the response uses a data: URL shape", async () => {
    const dataUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=";
    currentMock = makeSupabaseMock({
      enroll: vi.fn().mockResolvedValue({
        data: {
          id: "factor-1",
          type: "totp",
          totp: {
            qr_code: dataUrl,
            secret: "ABCDEFGH",
            uri: "otpauth://totp/GetPDFPro:u@example.com?secret=ABCDEFGH",
          },
          friendly_name: "Authenticator",
        },
        error: null,
      }),
    });
    const r = await enrollTotp("Authenticator");
    expect(r.factorId).toBe("factor-1");
    expect(r.qrCode).toBe(dataUrl);
    expect(r.secret).toBe("ABCDEFGH");
    expect(r.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(currentMock.mfa.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Authenticator",
      issuer: "GetPDFPro",
    });
  });

  it("returns the QR code when the response uses a raw otpauth URL shape", async () => {
    const otpauthUrl = "otpauth://totp/GetPDFPro:u@example.com?secret=ABCDEFGH";
    currentMock = makeSupabaseMock({
      enroll: vi.fn().mockResolvedValue({
        data: {
          id: "factor-2",
          type: "totp",
          totp: {
            qr_code: otpauthUrl,
            secret: "ABCDEFGH",
            uri: otpauthUrl,
          },
          friendly_name: "Authenticator",
        },
        error: null,
      }),
    });
    const r = await enrollTotp("Authenticator");
    expect(r.qrCode).toBe(otpauthUrl);
    expect(r.factorId).toBe("factor-2");
  });

  it("throws when the supabase call returns an error", async () => {
    currentMock = makeSupabaseMock({
      enroll: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Server error" },
      }),
    });
    await expect(enrollTotp("x")).rejects.toThrow(/Server error/);
  });
});

describe("verifyTotpEnrollment", () => {
  it("calls challengeAndVerify with the factor id and code", async () => {
    currentMock = makeSupabaseMock({
      challengeAndVerify: vi.fn().mockResolvedValue({
        data: { access_token: "a", refresh_token: "r", user: {}, expires_in: 3600, token_type: "bearer" },
        error: null,
      }),
    });
    await verifyTotpEnrollment("factor-1", "123456");
    expect(currentMock.mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "factor-1",
      code: "123456",
    });
  });

  it("throws on invalid code", async () => {
    currentMock = makeSupabaseMock({
      challengeAndVerify: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Invalid code" },
      }),
    });
    await expect(verifyTotpEnrollment("factor-1", "000000")).rejects.toThrow(/Invalid code/);
  });
});

describe("registerPasskey (browser-side)", () => {
  it("calls navigator.credentials.create and persists the passkey", async () => {
    // Stub PublicKeyCredential + credentials.create
    const fakeRawId = new Uint8Array([1, 2, 3, 4, 5]);
    const fakeCredential = {
      rawId: fakeRawId.buffer,
      response: {
        getPublicKey: () => new Uint8Array([9, 9, 9]).buffer,
      },
    };
    const createMock = vi.fn().mockResolvedValue(fakeCredential);
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: function PublicKeyCredential() {},
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { create: createMock, get: vi.fn() },
    });
    const r = await registerPasskey("MacBook Touch ID");
    expect(r.factorId).toBeTruthy();
    expect(createMock).toHaveBeenCalledTimes(1);
    // localStorage has the passkey under the userId
    const stored = window.localStorage.getItem("getpdfpro.passkey.user-1");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].friendlyName).toBe("MacBook Touch ID");
  });

  it("throws when navigator.credentials is unavailable", async () => {
    // Replace PublicKeyCredential with undefined
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: undefined,
    });
    await expect(registerPasskey("x")).rejects.toThrow(/WebAuthn/);
  });
});

describe("challengeFactor / verifyFactor", () => {
  it("challengeFactor returns the challenge id", async () => {
    currentMock = makeSupabaseMock({
      challenge: vi.fn().mockResolvedValue({
        data: { id: "challenge-1", type: "totp", expires_at: 1234 },
        error: null,
      }),
    });
    const r = await challengeFactor("factor-1");
    expect(r.challengeId).toBe("challenge-1");
  });

  it("verifyFactor calls verify then setSession with the new tokens", async () => {
    currentMock = makeSupabaseMock({
      verify: vi.fn().mockResolvedValue({
        data: {
          access_token: "ACCESS",
          refresh_token: "REFRESH",
          user: { id: "u" },
          expires_in: 3600,
          token_type: "bearer",
        },
        error: null,
      }),
      setSession: vi.fn().mockResolvedValue({ data: { session: { foo: 1 } }, error: null }),
    });
    const r = await verifyFactor("factor-1", "challenge-1", "123456");
    expect(r.session).toEqual({ foo: 1 });
    expect(currentMock.mfa.verify).toHaveBeenCalledWith({
      factorId: "factor-1",
      challengeId: "challenge-1",
      code: "123456",
    });
    expect(currentMock.mfa.setSession).toHaveBeenCalledWith({
      access_token: "ACCESS",
      refresh_token: "REFRESH",
    });
  });
});

describe("listFactors", () => {
  it("returns { totp, webauthn } grouped correctly", async () => {
    const totpFactors = [
      { id: "t1", factor_type: "totp", status: "verified", created_at: "2024-01-01", updated_at: "2024-01-01", friendly_name: "Authy" },
      { id: "t2", factor_type: "totp", status: "unverified", created_at: "2024-01-02", updated_at: "2024-01-02", friendly_name: "1Password" },
    ];
    currentMock = makeSupabaseMock({
      listFactors: vi.fn().mockResolvedValue({
        data: { all: totpFactors, totp: totpFactors, phone: [] },
        error: null,
      }),
    });
    const r = await listFactors();
    expect(r.totp).toHaveLength(2);
    expect(r.totp[0]!.id).toBe("t1");
    expect(r.webauthn).toEqual([]);
  });

  it("merges locally-stored passkeys under webauthn", async () => {
    currentMock = makeSupabaseMock({
      listFactors: vi.fn().mockResolvedValue({
        data: { all: [], totp: [], phone: [] },
        error: null,
      }),
    });
    window.localStorage.setItem(
      "getpdfpro.passkey.user-1",
      JSON.stringify([
        {
          factorId: "p1",
          friendlyName: "iPhone",
          createdAt: "2024-03-01T00:00:00.000Z",
          credentialId: "abcd",
        },
      ])
    );
    const r = await listFactors();
    expect(r.webauthn).toHaveLength(1);
    expect(r.webauthn[0]!.friendlyName).toBe("iPhone");
  });
});

describe("unenrollFactor", () => {
  it("calls supabase.mfa.unenroll for an existing TOTP factor", async () => {
    const totpFactor = {
      id: "t1",
      factor_type: "totp",
      status: "verified",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      friendly_name: "Authy",
    };
    currentMock = makeSupabaseMock({
      listFactors: vi.fn().mockResolvedValue({
        data: { all: [totpFactor], totp: [totpFactor], phone: [] },
        error: null,
      }),
      unenroll: vi.fn().mockResolvedValue({ data: { id: "t1" }, error: null }),
    });
    await unenrollFactor("t1");
    expect(currentMock.mfa.unenroll).toHaveBeenCalledWith({ factorId: "t1" });
  });

  it("removes a passkey from local storage", async () => {
    currentMock = makeSupabaseMock({
      listFactors: vi.fn().mockResolvedValue({
        data: { all: [], totp: [], phone: [] },
        error: null,
      }),
    });
    window.localStorage.setItem(
      "getpdfpro.passkey.user-1",
      JSON.stringify([
        {
          factorId: "p1",
          friendlyName: "iPhone",
          createdAt: "2024-03-01T00:00:00.000Z",
          credentialId: "abcd",
        },
        {
          factorId: "p2",
          friendlyName: "MacBook",
          createdAt: "2024-03-02T00:00:00.000Z",
          credentialId: "efgh",
        },
      ])
    );
    await unenrollFactor("p1");
    const stored = window.localStorage.getItem("getpdfpro.passkey.user-1");
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].factorId).toBe("p2");
  });

  it("does not throw when the factor does not exist (idempotent)", async () => {
    const totpFactor = {
      id: "t1",
      factor_type: "totp",
      status: "verified",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      friendly_name: "Authy",
    };
    currentMock = makeSupabaseMock({
      listFactors: vi.fn().mockResolvedValue({
        data: { all: [totpFactor], totp: [totpFactor], phone: [] },
        error: null,
      }),
      unenroll: vi.fn(),
    });
    await expect(unenrollFactor("nonexistent")).resolves.toBeUndefined();
    expect(currentMock.mfa.unenroll).not.toHaveBeenCalled();
  });

  it("surfaces a supabase unenroll error", async () => {
    const totpFactor = {
      id: "t1",
      factor_type: "totp",
      status: "verified",
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
      friendly_name: "Authy",
    };
    currentMock = makeSupabaseMock({
      listFactors: vi.fn().mockResolvedValue({
        data: { all: [totpFactor], totp: [totpFactor], phone: [] },
        error: null,
      }),
      unenroll: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "AAL2 required" },
      }),
    });
    await expect(unenrollFactor("t1")).rejects.toThrow(/AAL2 required/);
  });
});

describe("generateBackupCodes", () => {
  it("returns 10 unique formatted codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    const set = new Set(codes);
    expect(set.size).toBe(10);
    for (const c of codes) {
      // 5+5 grouped with a dash
      expect(c).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    }
  });
});
