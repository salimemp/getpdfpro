/**
 * Render tests for the tutorial overlay that lives inside
 * <OnboardingProvider />, and the page-level <OnboardingTour />
 * component that arms it.
 *
 * The overlay is the spotlight/popover. It positions the popover
 * inline against the target's bounding rect (or centers it for
 * modal-style steps). <OnboardingTour /> is the page-level mount
 * point that surfaces a "Take the tour" button for anonymous users
 * once the trigger hook arms the tour.
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
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { STEPS, type Step } from '@/components/onboarding/steps';

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

// The trigger hook reads auth state from `useAuth`. We default it to
// "loading" so the hook stays inert; individual tests that need
// a signed-in or anonymous state re-mock it before mounting.
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ loading: true, user: null }),
}));

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

/** Render a provider + a `Probe` that exposes the overlay controls. */
function ProviderHarness({ children }: { children?: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <Probe />
      {children}
    </OnboardingProvider>
  );
}

function Probe() {
  const ctx = useOnboarding();
  return (
    <div>
      <button type="button" onClick={ctx.start} data-testid="probe-start">
        start
      </button>
      <span data-testid="probe-step-id">{ctx.step?.id ?? ''}</span>
    </div>
  );
}

/**
 * Render a fake page with a target element on the document at a
 * known bounding rect. The overlay measures the rect on mount and
 * uses it to position the popover.
 */
function withTarget(id: string, rect: { top: number; left: number; width: number; height: number }) {
  const el = document.createElement('div');
  el.setAttribute('data-onboarding-target', id);
  document.body.appendChild(el);
  el.getBoundingClientRect = () => ({
    top: rect.top,
    left: rect.left,
    bottom: rect.top + rect.height,
    right: rect.left + rect.width,
    width: rect.width,
    height: rect.height,
    x: rect.left,
    y: rect.top,
    toJSON() {
      return {};
    },
  });
  return el;
}

/** Return the popover element inside the dialog (the styled
 * container, not the spotlight cutout). */
function getPopover(): HTMLElement {
  const dialog = screen.getByRole('dialog');
  // The popover is the only div with a `max-w-sm` utility class.
  const popover = dialog.querySelector<HTMLDivElement>('div.max-w-sm');
  if (!popover) {
    throw new Error('expected popover element (div.max-w-sm) inside the dialog');
  }
  return popover;
}

function rectOf(n: Element): DOMRect {
  return n.getBoundingClientRect();
}

describe('tutorial overlay (rendered by <OnboardingProvider />)', () => {
  beforeEach(() => {
    clearStorage();
    navMock.setPathname('/');
    navMock.push.mockReset();
  });

  afterEach(() => {
    cleanup();
    // Remove any leftover fake targets between tests.
    document.body.innerHTML = '';
  });

  it('positions the popover next to the target element when a targetSelector is given', () => {
    // "welcome" lives at "/" and has no target — we can't assert the
    // popover positioning against a target there. Start on /tools by
    // clicking start() on / (advances into welcome), then next()
    // moves to "tools-grid" (index 1, path /tools, top placement).
    navMock.setPathname('/');
    withTarget('tools-grid', { top: 100, left: 200, width: 120, height: 40 });

    render(<ProviderHarness />);
    act(() => {
      fireEvent.click(screen.getByTestId('probe-start'));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    expect(screen.getByTestId('probe-step-id')).toHaveTextContent('tools-grid');

    const style = getPopover().style;
    // Popover placement is "top" for tools-grid. With rect.top=100 we
    // expect top: 88 (= 100 - 12) and left: 200.
    expect(style.top).toBe('88px');
    expect(style.left).toBe('200px');
    expect(style.transform).toContain('translateY(-100%)');
  });

  it('renders a centered popover for a step without a target (welcome modal)', () => {
    // "welcome" step has path "/" and no targetSelector. Setting
    // pathname to "/" keeps the redirect effect a no-op.
    navMock.setPathname('/');
    render(<ProviderHarness />);
    act(() => {
      fireEvent.click(screen.getByTestId('probe-start'));
    });

    expect(screen.getByTestId('probe-step-id')).toHaveTextContent('welcome');
    const style = getPopover().style;
    // Centered popover: 50/50 with translate(-50%,-50%).
    expect(style.left).toBe('50%');
    expect(style.top).toBe('50%');
    expect(style.transform).toContain('translate(-50%, -50%)');
  });

  it('pressing Escape inside the popover dismisses the tour (skips)', () => {
    navMock.setPathname('/');
    render(<ProviderHarness />);
    act(() => {
      fireEvent.click(screen.getByTestId('probe-start'));
    });
    expect(screen.getByTestId('probe-step-id')).toHaveTextContent('welcome');

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    // After skip, the dialog should be gone.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('getpdfpro.onboarding.dismissed.v1')).toBe('1');
  });

  it('clicking the Next button advances to the next step', () => {
    navMock.setPathname('/');
    render(<ProviderHarness />);
    act(() => {
      fireEvent.click(screen.getByTestId('probe-start'));
    });
    expect(screen.getByTestId('probe-step-id')).toHaveTextContent('welcome');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    // We navigated to the next step. Its path is /tools, so the
    // provider's redirect effect will push("/tools") but the step
    // object should be the new one ("tools-grid").
    expect(screen.getByTestId('probe-step-id')).toHaveTextContent('tools-grid');
  });

  it('clicking Back decrements the step index', () => {
    navMock.setPathname('/');
    render(<ProviderHarness />);
    act(() => {
      fireEvent.click(screen.getByTestId('probe-start'));
    });
    // Advance to step 1.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    expect(screen.getByTestId('probe-step-id')).toHaveTextContent('tools-grid');

    // Back to step 0.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /back/i }));
    });
    expect(screen.getByTestId('probe-step-id')).toHaveTextContent('welcome');
  });

  it('uses bottom-placement offsets for a bottom step', () => {
    // The "tool-merge" step (index 2) is a bottom-placement step.
    // We render a target for it and assert the popover style.
    withTarget('tool-merge', { top: 300, left: 50, width: 200, height: 60 });
    navMock.setPathname('/');
    render(<ProviderHarness />);
    // Walk: start (welcome) -> next (tools-grid) -> next (tool-merge)
    act(() => {
      fireEvent.click(screen.getByTestId('probe-start'));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    expect(screen.getByTestId('probe-step-id')).toHaveTextContent('tool-merge');

    const style = getPopover().style;
    // bottom: top = rect.bottom + 12 = (300+60) + 12 = 372, left = 50
    expect(style.top).toBe('372px');
    expect(style.left).toBe('50px');
    expect(style.transform).not.toContain('translateY(-100%)');
  });
});

describe('<OnboardingTour /> (page-level mount)', () => {
  beforeEach(() => {
    clearStorage();
    navMock.setPathname('/');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing in the silent variant', () => {
    render(
      <OnboardingProvider>
        <OnboardingTour variant="silent" />
      </OnboardingProvider>,
    );
    expect(screen.queryByRole('button', { name: /take the tour/i })).not.toBeInTheDocument();
  });

  it('renders a "Take the tour" button when the trigger hook is armed (anonymous user)', async () => {
    // Override the auth mock for this test: signed-out, not loading.
    const authMod = await import('@/lib/auth');
    vi.spyOn(authMod, 'useAuth').mockReturnValue({
      loading: false,
      user: null,
    } as ReturnType<typeof authMod.useAuth>);

    render(
      <OnboardingProvider>
        <OnboardingTour />
      </OnboardingProvider>,
    );
    // The trigger hook sets armed=true on the next tick; the tour
    // then renders the button.
    expect(
      await screen.findByRole('button', { name: /take the tour/i }),
    ).toBeInTheDocument();
  });
});

// Use one of the registry steps as a typed sample to keep the
// `Step` import used (some lint configs flag unused type imports).
const _sampleStep: Step = STEPS[0]!;
void _sampleStep;
