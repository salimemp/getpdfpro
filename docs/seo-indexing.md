# Search engine indexing — what to do after every blog post

This doc covers the fastest path from "post is live" to "post appears in
Google/Bing search results".

## 1. What happens automatically (no work needed)

When you push a new blog post to `main` on the salimemp/getpdfpro repo:

1. **Vercel auto-deploys** the change to `https://app.getpdfpro.com` (~30s).
2. Our `sitemap.xml` is regenerated at build time and includes every
   published post. URL: <https://app.getpdfpro.com/sitemap.xml>
3. Our 4 blog feeds (`/rss.xml`, `/atom.xml`, `/feed.xml`, `/feed.json`)
   are regenerated alongside it.
4. **Google** discovers new posts via the sitemap on its next crawl
   (usually 1–7 days for a new URL, faster once you have a GSC
   property).
5. **Bing/Yandex/Naver/Seznam/DuckDuckGo** may also pick them up from
   the same sitemap (slower, 1–4 weeks typical).

The post **will** be indexed eventually with no further work. Steps 2–4
below make it happen faster.

## 2. Google Search Console (one-time 5-minute setup)

Google Search Console is the official channel for telling Google about
your site. It shortens indexing from days to hours, and gives you
search performance data.

### Setup (do this once)

1. Open <https://search.google.com/search-console/> and sign in with the
   Google account that owns `getpdfpro.com` (or whichever Google
   account manages the workspace).
2. Click **Add property** → choose **URL prefix** → enter
   `https://app.getpdfpro.com`.
3. Verify ownership. The fastest method is **DNS**:
   - Copy the TXT record GSC shows you.
   - In Cloudflare DNS for `app.getpdfpro.com`, add a TXT record on
     the `_dnsauth.app` subdomain (GSC gives you the exact name).
   - Wait ~2 minutes, then click **Verify** in GSC.
4. Once verified, go to **Sitemaps** in the left nav.
5. Enter `sitemap.xml` in the "Add a new sitemap" box → click **Submit**.
6. After verification, GSC will show the submitted sitemap and its
   last successful crawl. Every blog post we add is automatically
   included.

### What you get

- **URL Inspection** — paste any post URL to ask Google to crawl it
  right now. Recommended for the first 2–3 posts to jumpstart indexing.
- **Coverage** report — see which URLs are indexed, which have errors.
- **Performance** — actual search queries that bring users to your
  site, once you have traffic.

### For each new post

1. Open GSC → **URL Inspection**.
2. Paste the new post URL (e.g.
   `https://app.getpdfpro.com/blog/how-to-merge-pdfs/`).
3. Click **Request Indexing**. (You get ~10–12 of these per day, so
   use them for the highest-value posts.)
4. Done — Google will crawl it within minutes to hours.

## 3. IndexNow (automatic Bing/Yandex/Naver/DuckDuckGo)

These engines support a real-time "ping me when this URL is new" API
called IndexNow. We have a script for it.

### One-time setup

1. Generate an API key (any 16+ hex char string):
   ```sh
   openssl rand -hex 16
   ```
2. Save it as `INDEXNOW_API_KEY` in your local `.env` or shell rc.
3. Submit it once to register the key with IndexNow. The script below
   does this on its first run by writing the key to
   `apps/web/public/<key>.txt`.

### Run after every new post

```sh
cd /Users/abdulsalim/.mavis/sessions/mvs_8d65a47f9a324c51ac81951a431ed1d9/workspace
INDEXNOW_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  npx tsx scripts/submit-indexnow.ts                # all posts
INDEXNOW_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  npx tsx scripts/submit-indexnow.ts how-to-merge-pdfs  # one post
```

The script POSTs the URL list to `https://api.indexnow.org/IndexNow`.
The receiving engines will crawl within minutes.

### Automate it (optional)

The blog-publisher cron (`mavis cron list mavis`) could be extended to
call submit-indexnow.ts after each new post goes live. For now it's a
manual one-liner — about 10 seconds of work per new post.

## 4. Bing Webmaster Tools (recommended, 2-minute setup)

Bing's equivalent of GSC. Less data than Google but faster indexing of
new URLs, and Bing's index is used by DuckDuckGo and partially by
Apple's Spotlight.

1. Open <https://www.bing.com/webmasters> and sign in with a Microsoft
   account.
2. Add a site for `https://app.getpdfpro.com`.
3. Verify via DNS (same TXT-record flow as GSC, different record).
4. Submit sitemap: `https://app.getpdfpro.com/sitemap.xml`.
5. Optional: enable the IndexNow plugin in the Bing dashboard to skip
   step 3 entirely once it's wired.

## 5. Backlinks (medium-term, not for today)

The biggest factor in long-term ranking is backlinks from other
sites. Strategies to consider once the blog has 10+ posts:

- Submit to directories that curate PDF / productivity content.
- Cross-post summaries to Medium, dev.to, and Hacker News (with a
  canonical link back to the post).
- Pitch specific posts to newsletters in the productivity / devtools
  space.

These are not for today. Focus on the technical setup first.

---

## TL;DR

| Engine       | Time to index without help | With our setup       | Action needed                      |
| ------------ | -------------------------- | -------------------- | ---------------------------------- |
| Google       | 1–7 days                   | minutes to hours     | Set up GSC + sitemap (one-time)    |
| Bing         | 1–4 weeks                  | minutes              | Run `submit-indexnow.ts` per post  |
| DuckDuckGo   | 1–4 weeks                  | minutes (via Bing)   | Same as Bing                       |
| Yandex/Naver | weeks                      | minutes              | Same as Bing                       |
| Apple Spotlight | weeks                   | days (no direct API) | Add structured data (done)         |

The current state of the codebase already includes everything needed
for automatic discovery: `sitemap.xml`, 4 feed formats, per-post
JSON-LD, robots.txt, and the IndexNow submission script. The only
manual work is the GSC + Bing Webmaster Tools one-time setup (~10 min
total), plus a 10-second `submit-indexnow.ts` run after each new post.
