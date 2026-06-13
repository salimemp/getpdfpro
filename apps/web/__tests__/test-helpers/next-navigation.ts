/**
 * Test-only mock for `next/navigation`.
 *
 * The onboarding components call `useRouter().push(...)` and
 * `usePathname()` from `next/navigation`. jsdom + vitest don't have a
 * Next.js router, so we install a controlled one that lets each test
 * seed the current pathname and spy on `.push()` calls.
 *
 * `installNavigationMock` should be called at module scope (i.e. before
 * any of the imports that depend on `next/navigation` are evaluated)
 * so vi.mock hoists correctly.
 */
import { vi, beforeEach } from 'vitest';

export type NavigationMock = {
  pathname: string;
  push: ReturnType<typeof vi.fn>;
  setPathname: (next: string) => void;
};

export function makeNavigationMock(initialPath = '/'): NavigationMock {
  let current = initialPath;
  const push = vi.fn();
  const mock: NavigationMock = {
    get pathname() {
      return current;
    },
    push,
    setPathname: (next: string) => {
      current = next;
    },
  };
  return mock;
}

export function installNavigationMock(mock: NavigationMock) {
  beforeEach(() => {
    mock.push.mockReset();
    mock.setPathname('/');
  });
  vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mock.push }),
    usePathname: () => mock.pathname,
  }));
}
