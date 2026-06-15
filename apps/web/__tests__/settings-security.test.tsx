/**
 * Render tests for the /settings/security page.
 *
 * We render the page inside a stubbed AuthProvider that always
 * reports a signed-in user, and mock listFactors / registerPasskey
 * via vi.mock of @/lib/auth-mfa. The assertions check that all
 * three friendlyName values show up, and that clicking "Add a
 * passkey" calls registerPasskey once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Factor } from "@supabase/supabase-js";

// We mock the AuthProvider via vi.mock of the auth module, returning
// a stable signed-in state.
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    enabled: true,
    loading: false,
    session: { user: { id: "u", email: "u@example.com" } },
    user: { id: "u", email: "u@example.com" },
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  }),
}));

// Mock next/navigation so the redirect effect is a no-op.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the auth-mfa module to return a fixed factor list and capture
// registerPasskey calls.
const registerPasskeyMock = vi.fn();
const listFactorsMock = vi.fn();

vi.mock("@/lib/auth-mfa", async () => {
  return {
    listFactors: (...args: unknown[]) => listFactorsMock(...args),
    registerPasskey: (...args: unknown[]) => registerPasskeyMock(...args),
    enrollTotp: vi.fn(),
    verifyTotpEnrollment: vi.fn(),
    challengeFactor: vi.fn(),
    verifyFactor: vi.fn(),
    unenrollFactor: vi.fn(),
    generateBackupCodes: () => ["AAAAA-BBBBB", "CCCCC-DDDDD"],
  };
});

import SecuritySettingsPage from "@/app/settings/security/page";

function makeFactor(id: string, friendlyName: string): Factor {
  return {
    id,
    factor_type: "totp",
    status: "verified",
    friendly_name: friendlyName,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

describe("<SecuritySettingsPage />", () => {
  beforeEach(() => {
    listFactorsMock.mockReset();
    registerPasskeyMock.mockReset();
    listFactorsMock.mockResolvedValue({
      totp: [makeFactor("t1", "Google Authenticator")],
      webauthn: [
        {
          factorId: "p1",
          friendlyName: "MacBook Touch ID",
          createdAt: "2024-02-01T00:00:00Z",
          credentialId: "cred-1",
        },
        {
          factorId: "p2",
          friendlyName: "iPhone Face ID",
          createdAt: "2024-03-01T00:00:00Z",
          credentialId: "cred-2",
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all three factors (1 TOTP + 2 passkeys) by friendlyName", async () => {
    render(<SecuritySettingsPage />);
    await waitFor(() => {
      expect(screen.getByText("Google Authenticator")).toBeInTheDocument();
    });
    expect(screen.getByText("MacBook Touch ID")).toBeInTheDocument();
    expect(screen.getByText("iPhone Face ID")).toBeInTheDocument();
    // All three sections present
    expect(screen.getByTestId("totp-section")).toBeInTheDocument();
    expect(screen.getByTestId("passkey-section")).toBeInTheDocument();
    expect(screen.getByTestId("recovery-section")).toBeInTheDocument();
  });

  it("calls registerPasskey when 'Add a passkey' is clicked", async () => {
    registerPasskeyMock.mockResolvedValue({ factorId: "new-id" });
    render(<SecuritySettingsPage />);
    // Wait for the initial load
    await waitFor(() => {
      expect(screen.getByText("MacBook Touch ID")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("passkey-add"));
    await waitFor(() => {
      expect(registerPasskeyMock).toHaveBeenCalledTimes(1);
    });
  });
});
