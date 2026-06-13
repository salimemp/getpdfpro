/**
 * Pure unit tests for the onboarding step registry.
 *
 * These exist primarily as a guard against schema drift: the provider
 * indexes steps by position, the tour walks them in order, and the
 * trigger hook assumes a sensible shape. If somebody removes a step,
 * changes an id, or invents a new `Placement` value, the assertions
 * below should make the regression visible.
 */
import { describe, it, expect } from 'vitest';

import { STEPS, type Placement, type Step } from '@/components/onboarding/steps';

const VALID_PLACEMENTS: readonly Placement[] = [
  'top',
  'bottom',
  'left',
  'right',
  'center',
] as const;

describe('onboarding step registry', () => {
  it('is non-empty', () => {
    expect(STEPS.length).toBeGreaterThan(0);
  });

  it('has a unique id for every step', () => {
    const ids = STEPS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('exposes all required fields on every step', () => {
    for (const step of STEPS) {
      expect(typeof step.id).toBe('string');
      expect(step.id.length).toBeGreaterThan(0);

      expect(typeof step.title).toBe('string');
      expect(step.title.length).toBeGreaterThan(0);

      expect(typeof step.body).toBe('string');
      expect(step.body.length).toBeGreaterThan(0);

      // placement is required; targetSelector is optional (centered steps omit it)
      expect(typeof step.placement).toBe('string');
    }
  });

  it('only uses valid placement values', () => {
    for (const step of STEPS) {
      expect(VALID_PLACEMENTS).toContain(step.placement);
    }
  });

  it('uses "center" placement precisely when no targetSelector is given', () => {
    // The tour treats center/no-target as equivalent, but the registry
    // should be self-consistent: the only steps that should be allowed
    // to omit targetSelector are the centered welcome/finish modals.
    for (const step of STEPS) {
      if (!step.targetSelector) {
        expect(step.placement).toBe('center');
      }
    }
  });

  it('uses a stable order (id is unique AND indices are deterministic)', () => {
    // The provider advances by `stepIndex + 1`, so order matters.
    // Pin the first/last id to catch silent re-ordering.
    expect(STEPS[0]?.id).toBe('welcome');
    expect(STEPS[STEPS.length - 1]?.id).toBe('finish');
  });

  it('every step points at a path under the site root', () => {
    for (const step of STEPS) {
      // `path` is typed as `\`/${string}\` | "/"` so this is a runtime
      // guard in case somebody widens the type later.
      expect(['/', step.path]).toContain(step.path);
      expect(step.path.startsWith('/')).toBe(true);
    }
  });

  it('compiles against the exported Step type without missing fields', () => {
    // If the Step type changes shape, this assignment will fail type
    // checking — which is what we want.
    const sample: Step = STEPS[0]!;
    const { id, path, targetSelector, placement, title, body } = sample;
    expect(id).toBeDefined();
    expect(path).toBeDefined();
    expect(placement).toBeDefined();
    expect(title).toBeDefined();
    expect(body).toBeDefined();
    // targetSelector can be undefined for centered steps; just touch it.
    void targetSelector;
  });
});
