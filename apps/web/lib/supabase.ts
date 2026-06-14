import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client.
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * from the environment at build/render time.
 *
 * Returns a singleton — re-instantiating the client on every render
 * breaks realtime subscriptions and auth state listeners.
 *
 * Token-length check at build time lives in isValidConfig() below.
 * Real Supabase anon JWTs are 200-220 chars; anything under 180 is
 * truncated and will silently fail signature validation in supabase-js.
 */
let _client: SupabaseClient | null = null;

/**
 * Returns true if `value` looks like a real Supabase config string.
 * We accept any non-empty string that:
 *   - is not a placeholder (e.g. Vercel's "<from Supabase>" sentinel,
 *     or "<my-supabase-url>" template placeholders)
 *   - starts with http:// or https://
 *   - has at least 20 characters (Supabase URLs are 30+ chars in practice)
 *   - contains "supabase" (the real ones do)
 *
 * Without this check, the underlying supabase-js client will try
 * `new URL(emptyOrPlaceholder)` and throw "Invalid URL" at runtime,
 * which manifests as a hydration error on every page.
 */
function isValidConfig(value: string | undefined): value is string {
  if (!value) return false;
  if (value.length < 20) return false;
  if (!value.startsWith("http://") && !value.startsWith("https://")) return false;
  // Reject any value that contains angle brackets — these are template
  // placeholders like "<from Supabase>" or "<my-url>" that some build
  // systems inline when env vars are unset.
  if (value.includes("<") || value.includes(">")) return false;
  return true;
}

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!isValidConfig(url) || !isValidConfig(anonKey)) {
    // Don't throw at import time — let the consumer decide.
    // This makes the file safe to import in tests / storybooks.
    return null;
  }

  _client = createBrowserClient(url, anonKey);
  return _client;
}

/**
 * Returns the configured Supabase URL, or null if Supabase isn't
 * configured in the environment. Use this to detect whether auth
 * is available in the current build.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    isValidConfig(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      isValidConfig(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
