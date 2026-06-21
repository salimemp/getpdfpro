/**
 * Tests for the PasswordInput component.
 *
 * Focuses on:
 *   - Visibility toggle (eye icon)
 *   - Strength meter shows correct level
 *   - Rule checklist reflects each rule's state
 *   - PASSWORD_RULES export behavior
 *
 * Timing-based breach-check tests live in __tests__/auth-breach.test.tsx
 * because they need network mocking that's cleaner in isolation.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordInput, PASSWORD_RULES } from "@/components/PasswordInput";

// Stub fetch — return a safe-by-default unless the test queues a response.
const fetchMock = vi.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ is_strong: true, is_breached: false, message: null }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

function renderPasswordInput(
  props: Partial<React.ComponentProps<typeof PasswordInput>> = {},
) {
  const onChange = vi.fn();
  const onBreachStatusChange = vi.fn();
  const utils = render(
    <PasswordInput
      mode="signup"
      value=""
      onChange={onChange}
      onBreachStatusChange={onBreachStatusChange}
      data-testid="password"
      {...props}
    />,
  );
  return { ...utils, onChange, onBreachStatusChange };
}

describe("PasswordInput", () => {
  describe("visibility toggle", () => {
    it("starts with type=password and toggles to text on click", () => {
      renderPasswordInput({ value: "hunter2!" });

      const input = screen.getByTestId("password") as HTMLInputElement;
      expect(input.type).toBe("password");

      fireEvent.click(screen.getByTestId("password-toggle"));
      expect(input.type).toBe("text");

      fireEvent.click(screen.getByTestId("password-toggle"));
      expect(input.type).toBe("password");
    });

    it("toggle has accessible name that flips with state", () => {
      renderPasswordInput({ value: "hunter2!" });
      const toggle = screen.getByTestId("password-toggle");
      expect(toggle).toHaveAttribute("aria-label", "Show password");

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-label", "Hide password");
    });
  });

  describe("rule checklist", () => {
    it("renders the checklist in signup mode even with empty input (rules upfront)", () => {
      renderPasswordInput({ value: "" });
      expect(
        screen.getByRole("list", { name: /password requirements/i }),
      ).toBeInTheDocument();
    });

    it("renders 4 rule items in signup mode", () => {
      renderPasswordInput({ value: "" });
      const list = screen.getByRole("list", { name: /password requirements/i });
      expect(list.children).toHaveLength(4);
    });

    it("does NOT render the checklist in login mode", () => {
      renderPasswordInput({ value: "anything", mode: "login" });
      expect(
        screen.queryByRole("list", { name: /password requirements/i }),
      ).not.toBeInTheDocument();
    });

    it("marks passed rules with the success color class", () => {
      // "Abc12345" — 8 chars, has letter (A,b,c), has number (1,2,3,4,5), no special
      renderPasswordInput({ value: "Abc12345" });
      const list = screen.getByRole("list", { name: /password requirements/i });
      const items = list.querySelectorAll("li");

      // length: passed (8 chars)
      expect(items[0]?.className).toMatch(/emerald/);
      // letter: passed
      expect(items[1]?.className).toMatch(/emerald/);
      // number: passed
      expect(items[2]?.className).toMatch(/emerald/);
      // special: failed
      expect(items[3]?.className).not.toMatch(/emerald/);
    });
  });

  describe("strength meter", () => {
    it("renders the meter in signup mode even with empty input (placeholder state)", () => {
      renderPasswordInput({ value: "" });
      expect(screen.getByRole("status")).toBeInTheDocument();
      // Empty placeholder label
      expect(screen.getByText("Type to start")).toBeInTheDocument();
    });

    it("renders the meter in LOGIN mode too (informational, not gated)", () => {
      renderPasswordInput({ mode: "login", value: "anything" });
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("displays 'Strong' label when all 4 rules pass", () => {
      renderPasswordInput({ value: "Abc12345!" });
      expect(screen.getByText("Strong")).toBeInTheDocument();
    });

    it("displays 'Weak' label when only 1 rule passes", () => {
      renderPasswordInput({ value: "a" });
      expect(screen.getByText("Weak")).toBeInTheDocument();
    });
  });

  describe("PASSWORD_RULES export", () => {
    it("exposes 4 rules in stable order", () => {
      expect(PASSWORD_RULES.map((r) => r.id)).toEqual([
        "length",
        "letter",
        "number",
        "special",
      ]);
    });

    it("length rule requires >= 8 chars", () => {
      const rule = PASSWORD_RULES.find((r) => r.id === "length")!;
      expect(rule.test("1234567")).toBe(false);
      expect(rule.test("12345678")).toBe(true);
      expect(rule.test("123456789012")).toBe(true);
    });

    it("letter rule requires at least one ASCII letter", () => {
      const rule = PASSWORD_RULES.find((r) => r.id === "letter")!;
      expect(rule.test("12345678!")).toBe(false);
      expect(rule.test("12345678a")).toBe(true);
      expect(rule.test("12345678Z")).toBe(true);
    });

    it("number rule requires at least one digit", () => {
      const rule = PASSWORD_RULES.find((r) => r.id === "number")!;
      expect(rule.test("abcdefgh!")).toBe(false);
      expect(rule.test("abcdefgh1")).toBe(true);
      expect(rule.test("abcdefgh9")).toBe(true);
    });

    it("special rule requires at least one symbol", () => {
      const rule = PASSWORD_RULES.find((r) => r.id === "special")!;
      expect(rule.test("Abc12345")).toBe(false);
      expect(rule.test("Abc12345!")).toBe(true);
      expect(rule.test("Abc12345@")).toBe(true);
      expect(rule.test("Abc12345#")).toBe(true);
    });
  });
});
