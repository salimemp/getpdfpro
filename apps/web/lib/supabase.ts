import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * from the environment at build/render time.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Don't throw at import time — let the consumer decide.
    // This makes the file safe to import in tests / storybooks.
    return null;
  }

  return createBrowserClient(url, anonKey);
}
