/**
 * OpenNext Cloudflare adapter configuration.
 *
 * Tunes the build behavior for our specific setup:
 *   - RSC + middleware (next-intl) are supported out of the box.
 *   - The default cache uses Cloudflare's Cache API; we keep it on for
 *     the static asset routes (rss.xml, atom.xml, etc.) and let
 *     per-route revalidation work via the standard Next.js APIs.
 *   - We don't enable incremental static regeneration here — the
 *     blog and tool pages are static enough that the build-time
 *     prerender covers us, and ISR is overkill at this scale.
 *   - No image optimization config — Next/Image falls back to the
 *     underlying browser loader, which is fine for the simple
 *     cover image use cases we have.
 *
 * See: https://opennext.js.org/cloudflare/config
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Default RSC support is on. Nothing to override.
  // The adapter auto-generates the worker entry that wrangler uses.
});
