"""
GetPDFPro — Cost Optimization Playbook
======================================

The product brief mandates aggressive cost minimization. This doc lists
every concrete tactic, the service it applies to, and the savings.
"""

## 1. Compute (Railway + Vercel)

| Tactic | Saving |
|---|---|
| Railway auto-sleep for low-traffic workers | ~60% on idle compute |
| Celery concurrency tuned to actual queue depth | ~40% on worker hours |
| Vercel ISR for marketing pages | 0 SSR cost on cached pages |
| Edge cache static assets via Cloudflare | ~80% bandwidth to Vercel |
| Single Railway project for API + workers | $5/mo plan covers both |

## 2. Storage (Cloudflare R2)

| Tactic | Saving |
|---|---|
| Use R2 over S3 (zero egress) | ~95% on file delivery cost |
| Auto-delete uploads after 24h via Cloudflare Worker | ~70% storage cost |
| Lossless compression on upload (PyMuPDF `save(garbage=4)`) | ~25% avg size reduction |
| Thumbnail-only retention for old file history | ~80% on long-term storage |
| Deduplicate identical files (hash check) | ~15% on user-uploaded duplicates |

## 3. AI (Google Gemini)

| Tactic | Saving |
|---|---|
| Default to gemini-1.5-flash-8b (not Pro) | ~10× cost reduction |
| Cache responses in Redis (24h TTL, hash by pdf+question) | ~30% on repeat queries |
| Truncate PDF context to relevant pages only | ~40% input token cost |
| Cap max output tokens at 8K | Caps worst-case spend |
| Hard daily cap per user (enforced in middleware) | Prevents abuse |
| Stream tokens to client (no buffering) | Better UX, no duplicate calls |

## 4. Email (Resend)

| Tactic | Saving |
|---|---|
| Resend free tier (3K/mo) over SendGrid (100/day) | $0 vs $15+/mo |
| Template caching — pre-build common emails | Faster, cheaper |
| Batch digest emails (daily, not real-time) | Lower send count |
| Suppress hard bounces immediately | Avoid re-send costs |

## 5. Database (Supabase)

| Tactic | Saving |
|---|---|
| Stay on free tier (50K MAU, 500MB DB) | $0/mo until scale |
| Connection pooling via Supavisor | Reduces connection overhead |
| Read replicas only when needed | Defer cost to Phase 3 |
| VACUUM and analyze weekly | Better query plans, less compute |

## 6. Auth (Supabase Auth)

| Tactic | Saving |
|---|---|
| Use Supabase Auth (not roll-our-own) | $0 dev cost, $0/mo infra |
| Self-host Supabase if free tier exceeded | Avoid $25+/mo Pro tier |
| Rate limit at edge (Cloudflare Worker) | Reduces Supabase load |

## 7. Observability (Sentry + Better Stack)

| Tactic | Saving |
|---|---|
| Sentry free tier (5K events/mo) | $0 vs $26/mo Team |
| Sample low-priority events | Stay in free tier longer |
| Better Stack free tier for uptime | $0 vs $25/mo |

## 8. Marketing (WordPress on Hostinger)

| Tactic | Saving |
|---|---|
| Keep on existing Hostinger plan | Already paid for |
| WP Super Cache plugin | Reduces server load |
| Cloudflare proxy in front | Offloads 95% of traffic |

## 9. App Store Fees

| Tactic | Saving |
|---|---|
| Apple Developer at $99/yr (1 year) | Required, no workaround |
| Google Play at $25 one-time | Required, no workaround |
| Microsoft Store at $19/yr | Required, no workaround |
| **Total fixed**: $143/yr | |

## Cost Ceilings by Phase

| Phase | When | Monthly OpEx Target |
|---|---|---|
| **MVP (launch)** | Months 1–3 | $30–60 |
| **Growth** (10K users) | Months 4–9 | $100–300 |
| **Scale** (100K users) | Months 10–18 | $500–1,500 |
| **Mature** (1M users) | Year 2+ | $2,000–5,000 |

At each phase, run a cost review. If we're >2× target, identify the driver
and optimize (e.g. move to Pro tier only if MRR justifies it).

## Revenue per User Targets

| Tier | ARPU/mo | Target conversion | Notes |
|---|---|---|---|
| Free → Pro | $4.99 | 2–4% | Industry norm |
| Pro → Team | +$7/user | 5–10% of paid | After PMF |
| Free → Business | Custom | <1% | Enterprise sales |

**Break-even at ~150 paid users** ($750/mo MRR vs $500/mo OpEx at growth phase).

## Cost Traps to Avoid

1. **Egress fees on AWS S3** — the #1 PDF-app cost killer. Use R2.
2. **GPT-4o for everything** — use Flash 8B, only escalate when needed.
3. **Idle Celery workers** — autoscale aggressively.
4. **Long-term file storage** — auto-delete after 24h unless saved.
5. **AWS Lambda cold starts + minimum bill** — Railway is cheaper at our scale.
6. **Over-provisioned Supabase** — stay on free tier until 50K MAU.
7. **Premium LLM plans for code review** — use open-source tools (ruff, mypy).
8. **Cloud-only AI** — add on-device fallback for power users in Phase 3.

## Quarterly Cost Review Checklist

- [ ] Pull billing from Railway, Vercel, Supabase, Cloudflare, Resend, Sentry
- [ ] Compare against target
- [ ] Identify top 3 cost drivers
- [ ] Identify top 3 cost optimizations not yet implemented
- [ ] Update this doc with learnings
- [ ] Set next quarter's cost target
