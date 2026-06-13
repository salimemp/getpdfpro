/**
 * Render tests for the `useOnboardingTrigger` hook.
 *
 * The hook decides whether the tour auto-starts on first visit:
 *
 *   - signed-in + first visit to `/` or `/tools` -> auto-start
 *   - signed-in + tour already completed/dismissed -> no-op
 *   - anonymous + first visit to `/` or `/tools` -> expose
 *     `armed=true` so the hero "Take the tour" button shows
 *   - any other pathname -> no-op
 *
 * The hook reads auth from `useAuth` and the provider state from
 * `useOnboarding`; both are mocked at the module boundary so the
 * tests can drive them deterministically.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';

import { OnboardingProvider, useOnboarding } from '@/components/onboarding/OnboardingProvider';
import { useOnboardingTrigger } from '@/hooks/useOnboardingTrigger';

const { navMock, authState } = vi.hoisted(() => {
  let pathname = '/';
  const push = vi.fn();
  return {
    navMock: {
      get pathname() {
        return pathname;
      },
      push,
      setPathname: (next: string) => {
        pathname = next;
      },
    },
    authState: {
      loading: true,
      user: null as null | { id: string },
      set(loading: boolean, user: null | { id: string }) {
        authState.loading = loading;
        authState.user = user;
      },
    },
  };
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ loading: authState.loading, user: authState.user }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navMock.push }),
  usePathname: () => navMock.pathname,
}));

const COMPLETED_KEY = 'getpdfpro.onboarding.completed.v1';
const DISMISSED_KEY = 'getpdfpro.onboarding.dismissed.v1';

function clearStorage() {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k) keys.push(k);
  }
  for (const k of keys) window.localStorage.removeItem(k);
}

function HookHarness() {
  const { armed, replay } = useOnboardingTrigger();
  const { active, hasCompleted } = useOnboarding();
  return (
    <div>
      <span data-testid="armed">{String(armed)}</span>
      <span data-testid="active">{String(active)}</span>
      <span data-testid="has-completed">{String(hasCompleted)}</span>
      <button type="button" onClick={replay} data-testid="btn-replay">
        replay
      </button>
    </div>
  );
}

function renderHarness() {
  return render(
    <OnboardingProvider>
      <HookHarness />
    </OnboardingProvider>,
  );
}

describe('useOnboardingTrigger', () => {
  beforeEach(() => {
    clearStorage();
    navMock.setPathname('/');
    navMock.push.mockReset();
    // default: signed-in user, not loading
    authState.set(false, { id: 'user-1' });
  });

  afterEach(() => {
    cleanup();
  });

  it('auto-starts the tour on first signed-in render at /', async () => {
    renderHarness();
    // Effect runs after the first render; the active flag becomes
    // true once `start()` has been called.
    expect(await screen.findByTestId('active')).toHaveTextContent('true');
    expect(screen.getByTestId('armed')).toHaveTextContent('false');
  });

  it('does not auto-start when the user has already completed the tour', () => {
    window.localStorage.setItem(COMPLETED_KEY, '1');
    renderHarness();
    // The provider re-hydrates hasCompleted from storage synchronously
    // enough that the trigger hook sees it and stays inert.
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
    expect(screen.getByTestId('active')).toHaveTextContent('false');
  });

  it('does not auto-start when the user has dismissed the tour', () => {
    window.localStorage.setItem(DISMISSED_KEY, '1');
    renderHarness();
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
    expect(screen.getByTestId('active')).toHaveTextContent('false');
  });

  it('does not auto-start for anonymous users; instead sets armed=true so the hero button shows', () => {
    authState.set(false, null); // signed-out, not loading
    renderHarness();
    expect(screen.getByTestId('active')).toHaveTextContent('false');
    expect(screen.getByTestId('armed')).toHaveTextContent('true');
  });

  it('does nothing for paths outside the trigger set', () => {
    navMock.setPathname('/account');
    renderHarness();
    expect(screen.getByTestId('active')).toHaveTextContent('false');
    expect(screen.getByTestId('armed')).toHaveTextContent('false');
  });

  it('stays inert while auth is still loading', () => {
    authState.set(true, null); // still loading
    renderHarness();
    expect(screen.getByTestId('active')).toHaveTextContent('false');
    expect(screen.getByTestId('armed')).toHaveTextContent('false');
  });

  it('exposes a replay action that resets the tour and starts it again', () => {
    window.localStorage.setItem(COMPLETED_KEY, '1');
    renderHarness();
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');

    act(() => {
      screen.getByTestId('btn-replay').click();
    });
    expect(window.localStorage.getItem(COMPLETED_KEY)).toBeNull();
    // The provider's start() flips active=true.
    expect(screen.getByTestId('active')).toHaveTextContent('true');
  });
});

/** Light-weight example that also exercises the hook on /tools. */
describe('useOnboardingTrigger on /tools', () => {
  beforeEach(() => {
    clearStorage();
    navMock.setPathname('/tools');
    authState.set(false, { id: 'user-1' });
  });

  afterEach(() => {
    cleanup();
  });

  it('auto-starts the tour for a signed-in first-time visitor', async () => {
    renderHarness();
    expect(await screen.findByTestId('active')).toHaveTextContent('true');
  });
});
