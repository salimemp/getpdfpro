import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client.
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * from the environment at build/render time.
 *
 * Returns a singleton — re-instantiating the client on every render
 * breaks realtime subscriptions and auth state listeners.
 */
let _client: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
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
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
