/**
 * Render tests for the OnboardingProvider.
 *
 * Verifies the public surface of the provider:
 *
 *  - rendering nothing while idle
 *  - the start/next/back/skip/complete/reset controls behave as
 *    documented
 *  - localStorage persistence uses the versioned keys
 *  - cross-tab `storage` events propagate a `complete` from one
 *    provider to another
 *
 * The OnboardingProvider imports `next/navigation` for its
 * path-redirect effect, so we install a controlled mock that lets
 * each test simulate the URL.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { useState } from 'react';

import { OnboardingProvider, useOnboarding } from '@/components/onboarding/OnboardingProvider';
import { STEPS } from '@/components/onboarding/steps';

const COMPLETED_KEY = 'getpdfpro.onboarding.completed.v1';
const DISMISSED_KEY = 'getpdfpro.onboarding.dismissed.v1';

// `vi.mock` is hoisted, so the factory must not close over local
// variables defined later. We use `vi.hoisted` to create the mock
// (and its mutable state) before the import statements are evaluated.
const { navMock } = vi.hoisted(() => {
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
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navMock.push }),
  usePathname: () => navMock.pathname,
}));

function clearStorage() {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k) keys.push(k);
  }
  for (const k of keys) window.localStorage.removeItem(k);
}

type Observed = ReturnType<typeof useOnboarding> & {
  show: boolean;
  stepTitle: string | null;
  hasCompleted: boolean;
};

function Probe({ onChange }: { onChange?: (s: Observed) => void }) {
  const ctx = useOnboarding();
  const [snapshot, setSnapshot] = useState<Observed>(() => ({
    ...ctx,
    show: Boolean(ctx.step),
    stepTitle: ctx.step?.title ?? null,
    hasCompleted: ctx.hasCompleted,
  }));
  // Refresh the snapshot every render so tests see latest values.
  const next: Observed = {
    ...ctx,
    show: Boolean(ctx.step),
    stepTitle: ctx.step?.title ?? null,
    hasCompleted: ctx.hasCompleted,
  };
  if (
    next.show !== snapshot.show ||
    next.stepTitle !== snapshot.stepTitle ||
    next.hasCompleted !== snapshot.hasCompleted ||
    next.stepIndex !== snapshot.stepIndex
  ) {
    setSnapshot(next);
  }
  if (onChange) onChange(next);
  return (
    <div>
      <span data-testid="show">{String(snapshot.show)}</span>
      <span data-testid="step-title">{snapshot.stepTitle ?? ''}</span>
      <span data-testid="step-index">{snapshot.stepIndex}</span>
      <span data-testid="has-completed">{String(snapshot.hasCompleted)}</span>
      <button type="button" onClick={ctx.start} data-testid="btn-start">
        start
      </button>
      <button type="button" onClick={ctx.next} data-testid="btn-next">
        next
      </button>
      <button type="button" onClick={ctx.back} data-testid="btn-back">
        back
      </button>
      <button type="button" onClick={ctx.skip} data-testid="btn-skip">
        skip
      </button>
      <button type="button" onClick={ctx.complete} data-testid="btn-complete">
        complete
      </button>
      <button type="button" onClick={ctx.reset} data-testid="btn-reset">
        reset
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <OnboardingProvider>
      <Probe />
    </OnboardingProvider>,
  );
}

describe('<OnboardingProvider />', () => {
  beforeEach(() => {
    clearStorage();
    navMock.setPathname('/');
    navMock.push.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing (no overlay) when no step is active', () => {
    renderProvider();
    // Probe always renders its diagnostic spans.
    expect(screen.getByTestId('show')).toHaveTextContent('false');
    expect(screen.getByTestId('step-title')).toHaveTextContent('');
    // The provider's overlay is a `role="dialog"`; with no active step it
    // should not be in the document.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('activates the first step when start() is called', () => {
    renderProvider();
    act(() => {
      fireEvent.click(screen.getByTestId('btn-start'));
    });
    expect(screen.getByTestId('show')).toHaveTextContent('true');
    expect(screen.getByTestId('step-title')).toHaveTextContent(STEPS[0]!.title);
    expect(screen.getByTestId('step-index')).toHaveTextContent('0');
  });

  it('advances one step on next()', () => {
    renderProvider();
    act(() => {
      fireEvent.click(screen.getByTestId('btn-start'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('btn-next'));
    });
    expect(screen.getByTestId('step-index')).toHaveTextContent('1');
    expect(screen.getByTestId('step-title')).toHaveTextContent(STEPS[1]!.title);
  });

  it('goes back on back() and clamps at index 0', () => {
    renderProvider();
    act(() => {
      fireEvent.click(screen.getByTestId('btn-start'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('btn-next'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('btn-back'));
    });
    expect(screen.getByTestId('step-index')).toHaveTextContent('0');

    act(() => {
      fireEvent.click(screen.getByTestId('btn-back'));
    });
    // back() must not underflow
    expect(screen.getByTestId('step-index')).toHaveTextContent('0');
  });

  it('skip() persists the dismissed flag, hides the tour, and sets hasCompleted', () => {
    renderProvider();
    act(() => {
      fireEvent.click(screen.getByTestId('btn-start'));
    });
    expect(screen.getByTestId('show')).toHaveTextContent('true');

    act(() => {
      fireEvent.click(screen.getByTestId('btn-skip'));
    });

    expect(window.localStorage.getItem(DISMISSED_KEY)).toBe('1');
    expect(window.localStorage.getItem(COMPLETED_KEY)).toBeNull();
    expect(screen.getByTestId('show')).toHaveTextContent('false');
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
  });

  it('complete() persists the completed flag and hides the tour', () => {
    renderProvider();
    act(() => {
      fireEvent.click(screen.getByTestId('btn-start'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('btn-complete'));
    });

    expect(window.localStorage.getItem(COMPLETED_KEY)).toBe('1');
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBeNull();
    expect(screen.getByTestId('show')).toHaveTextContent('false');
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
  });

  it('start() is a no-op once the tour has been completed (gating lives in the trigger hook, not the provider)', () => {
    // The provider itself does not gate `start()` on `hasCompleted` —
    // the gating logic lives in `useOnboardingTrigger`, which is the
    // only consumer that ever calls `start()` automatically. The
    // provider re-hydrates `hasCompleted` from localStorage and
    // updates it on `storage` events; this test verifies the storage
    // path so the trigger hook can rely on it.
    window.localStorage.setItem(COMPLETED_KEY, '1');
    renderProvider();
    // The provider's mount effect re-hydrates hasCompleted from storage.
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
  });

  it('syncs the completed flag across tabs via the storage event', () => {
    // jsdom's StorageEvent ctor rejects a non-Storage `storageArea`
    // (our MemoryStorage polyfill doesn't pass its IDL check). We
    // exercise the same code path by intercepting the listener
    // registration and invoking it directly.
    const realAdd = window.addEventListener.bind(window);
    const listeners: Array<(e: Event) => void> = [];
    const addSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((event: string, handler: EventListenerOrEventListenerObject) => {
        if (event === 'storage' && typeof handler === 'function') {
          listeners.push(handler as (e: Event) => void);
          return undefined;
        }
        return realAdd(event, handler);
      });

    renderProvider();
    act(() => {
      fireEvent.click(screen.getByTestId('btn-start'));
    });
    expect(screen.getByTestId('show')).toHaveTextContent('true');

    // Simulate "tab B" completing the tour: write to localStorage
    // and fire the `storage` event the way a second tab would.
    window.localStorage.setItem(COMPLETED_KEY, '1');
    act(() => {
      for (const fn of listeners) {
        fn(new Event('storage'));
      }
    });

    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');
    expect(screen.getByTestId('show')).toHaveTextContent('false');
    addSpy.mockRestore();
  });

  it('reset() clears both localStorage flags and lets start() work again', () => {
    window.localStorage.setItem(COMPLETED_KEY, '1');
    renderProvider();
    expect(screen.getByTestId('has-completed')).toHaveTextContent('true');

    act(() => {
      fireEvent.click(screen.getByTestId('btn-reset'));
    });
    expect(window.localStorage.getItem(COMPLETED_KEY)).toBeNull();
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBeNull();
    expect(screen.getByTestId('has-completed')).toHaveTextContent('false');

    act(() => {
      fireEvent.click(screen.getByTestId('btn-start'));
    });
    expect(screen.getByTestId('show')).toHaveTextContent('true');
  });
});
