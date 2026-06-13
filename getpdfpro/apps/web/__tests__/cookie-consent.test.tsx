/**
 * Smoke test for the <CookieConsent /> component.
 *
 * Renders the banner with an empty localStorage, verifies it appears, then
 * clicks "Reject non-essential" and verifies both that the banner is gone
 * AND that localStorage is set to a valid decision.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, act } from '@testing-library/react';

import { CookieConsent } from '@/components/CookieConsent';
import { CONSENT_STORAGE_KEY, deserializeConsent } from '@/lib/consent';

function clearStorage() {
  // jsdom's localStorage does not implement clear() in all versions — clear manually.
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k) keys.push(k);
  }
  for (const k of keys) window.localStorage.removeItem(k);
}

describe('<CookieConsent />', () => {
  beforeEach(() => {
    clearStorage();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the banner when no decision is stored', async () => {
    render(<CookieConsent />);
    // The component is client-side; use the same effect-driven path.
    const banner = await screen.findByTestId('cookie-consent-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/we use cookies/i)).toBeInTheDocument();
  });

  it('does not render when a decision is already stored', async () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        essential: true,
        analytics: false,
        marketing: false,
        decidedAt: new Date().toISOString(),
      }),
    );
    render(<CookieConsent />);
    // Give the effect a tick to run.
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
  });

  it('hides the banner and writes the decision when "Reject non-essential" is clicked', async () => {
    render(<CookieConsent />);
    const rejectBtn = await screen.findByTestId('cookie-reject-all');
    await act(async () => {
      fireEvent.click(rejectBtn);
    });
    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();

    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = deserializeConsent(stored);
    expect(parsed).not.toBeNull();
    expect(parsed!.analytics).toBe(false);
    expect(parsed!.marketing).toBe(false);
    expect(parsed!.essential).toBe(true);
    expect(parsed!.decidedAt).not.toBe('');
  });

  it('hides the banner and writes an accept-all decision when "Accept all" is clicked', async () => {
    render(<CookieConsent />);
    const acceptBtn = await screen.findByTestId('cookie-accept-all');
    await act(async () => {
      fireEvent.click(acceptBtn);
    });
    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    const parsed = deserializeConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    expect(parsed!.analytics).toBe(true);
    expect(parsed!.marketing).toBe(true);
  });

  it('treats ESC as "Reject non-essential"', async () => {
    render(<CookieConsent />);
    await screen.findByTestId('cookie-consent-banner');
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    const parsed = deserializeConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    expect(parsed!.analytics).toBe(false);
    expect(parsed!.marketing).toBe(false);
  });

  it('auto-rejects (and does not render) when Do Not Track is on', async () => {
    // jsdom exposes navigator.doNotTrack (legacy). We override the getter.
    Object.defineProperty(window.navigator, 'doNotTrack', {
      value: '1',
      configurable: true,
    });
    render(<CookieConsent />);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    const parsed = deserializeConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    expect(parsed).not.toBeNull();
    expect(parsed!.analytics).toBe(false);
    expect(parsed!.marketing).toBe(false);
  });
});
