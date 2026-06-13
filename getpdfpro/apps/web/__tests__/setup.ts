import '@testing-library/jest-dom/vitest';

/**
 * vitest's jsdom environment exposes `window.localStorage` as a plain
 * object without Storage methods. This polyfill replaces it with a
 * fully functional in-memory implementation.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: new MemoryStorage(),
    });
  } catch {
    // ignore — some envs already have a real one
  }
}
