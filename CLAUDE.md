# revivo — agent context

Productized website service for NL hair & beauty salons. **€999 one-time** per site, **5 working days** delivery, lifestyle scale (~50–200 customers total). Berend builds solo on evenings + weekends.

## Read first

- [docs/PROGRESS.md](docs/PROGRESS.md) — what's built, what's pending, decision log
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system shape, tech choices, the WHY
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — code patterns, tool gotchas
- `~/.claude/plans/i-want-to-build-peaceful-pumpkin.md` — original staged build plan
- `revivo-proposal.pdf` — the customer-facing proposal that locked in brand + product spec

Read when working on **outreach / sales / the close** (or the opener copy in `packages/shared/src/opener.ts`):
- [docs/OUTREACH.md](docs/OUTREACH.md) — the outreach + conversion playbook (legal posture, channels, message, cadence, close, measurement). Note: **do NOT pitch a Treatwell-commission saving** — our site embeds the Treatwell booking link, so there's no saving; lead value on brand / Google-vindbaarheid / ownership (see §6).
- [docs/OUTREACH-RESEARCH.md](docs/OUTREACH-RESEARCH.md) — the raw per-angle research findings + all sources behind the playbook.
- [docs/PRICING.md](docs/PRICING.md) — grounded pricing recommendation (what to charge, the model, the care plan). Key call: **hold €999 fixed for batch one, then raise behind funnel data** — €999 is at the *average (solo) salon's affordability ceiling* (3% of revenue) yet *below value* (2–5× under an agency); the underpricing is the **staffed minority (0,4% of their revenue) + care plan**, not a broad hike. Constraint is build **throughput** (~50–100/yr), not a customer-count cap → optimize **€-per-operator-hour**, not volume.

Read when working on **SEO / discoverability / the customer-template `<head>` / schema / structured data**:
- [docs/SEO.md](docs/SEO.md) — the SEO + AEO playbook (verified research). Key calls: **local-first**; **structured data = eligibility, not a ranking factor**; **omit self-serving `AggregateRating`/`Review`** (embedded Treatwell widget = self-controlled reviews → star-ineligible); **`robots.txt` default-allow** AI crawlers (never copy block-AI boilerplate); **`llms.txt` deferred — don't sell it**. The map pack is **owner-side** (a GBP runbook you ship); the website wins **local-organic + the entity layer**.
- [docs/SEO-MASTERPLAN.md](docs/SEO-MASTERPLAN.md) — the phased build plan: template the SEO/schema/meta layer **once** into the customer-template, driven entirely by `SiteConfig`.

App-level guidance (read when working in that app):
- [apps/customer-template/CLAUDE.md](apps/customer-template/CLAUDE.md) — variant system rules

## Mental model

Three pillars: **Sourcing → Outreach → Build/Close**. Plumbing in/out of one shared Supabase Postgres.

**The moat** is the mockup generator: per-prospect, deploy a fully personalized site at `mock.revivo.nl/{slug}` (their photos, copy in their voice, color palette) and send it as the WhatsApp/IG opener. Humans can't economically build a custom mockup for every prospect; LLMs can do it for ~€0.05 of compute. Everything else supports that loop.

## Anchors when making design decisions

Keep these in front of you whenever scope/architecture choices come up:

1. **~50–200 lifetime customers.** Don't optimize for hyperscale. If you reach for k8s, Inngest, Redis, microservices — stop. At this scale a Vercel Cron + a Postgres `jobs` table is enough.
2. **5-werkdagen SLA.** Whatever you build must hold this end-to-end. If a step grows past one weekend of operator work, it has to be automated.
3. **Berend operates solo.** Tools should be boring and well-trodden — Astro / Next.js / Supabase / Vercel / Claude. Novel infra taxes attention he doesn't have.
4. **The mockup is the moat — invest there before peripheral features.** Self-service customer dashboards, A/B tests, AI photos, etc are explicitly out of scope until the first 20 paying customers.

## Commands

```bash
# Install all workspaces
pnpm install

# Marketing site — Revivo Studios (revivostudios.io); nl at /, en at /en/
pnpm -F @revivo/marketing dev          # localhost:4321  (and /en/)
pnpm -F @revivo/marketing build

# Customer template — pick a variant via env var
cd apps/customer-template
pnpm dev:atelier                       # warm editorial
pnpm dev:studio                        # brutalist minimal
pnpm dev:neon                          # bold contemporary
# or:
REVIVO_CONFIG=examples/<your>.json pnpm dev

# Mockup generator (brief/places → SiteConfig). From repo root.
pnpm gen-mockup --name "Lume" --city Amsterdam --vibe "warm, rustig"   # manual
pnpm gen-mockup --place-id "ChIJ..."                                   # places (needs GOOGLE_PLACES_API_KEY)
pnpm gen-mockup --fixture-place                                        # offline fixture → real LLM
pnpm gen-mockup --dry-run --fixture-place                             # no LLM, no cost
pnpm gen-mockup --fixture-place --push                                # upsert into Supabase mockups
pnpm gen-mockup --help

# Mock app (mock.revivo.nl/{slug}) — SSR; reads Supabase, else local example JSON
cd apps/mockups && pnpm dev            # http://localhost:4321/<slug>

# Operator admin — outreach funnel + sales pipeline (Next.js; needs Supabase env)
pnpm -F @revivo/admin dev              # http://localhost:3000
pnpm -F @revivo/admin build            # deploy as its OWN Vercel project + enable Vercel Auth

# Lead sourcing — crawl a Treatwell marketplace directory into the leads table. From repo root.
pnpm crawl-marketplace --city utrecht --dry-run    # crawl + print, no DB writes
pnpm crawl-marketplace --city utrecht              # insert deduped pending leads (Supabase env)
pnpm crawl-marketplace --help

# Batch worker — pending leads → jobs → mockups (Supabase env + LLM key). From repo root.
pnpm generate-pending --dry-run                    # report pending leads + due jobs, no writes
pnpm generate-pending --max-jobs 5                 # bound one run's LLM spend
pnpm generate-pending --stub-llm                   # full loop, stub configs, €0 (infra test)

# Openers — mockup_generated leads → ready-to-send Dutch openers (no LLM). From repo root.
pnpm build-openers                                 # print openers; status unchanged
pnpm build-openers --out openers.txt --mark-sent   # write file + flip leads → outreach_sent
```

## Hard rules

- **Don't create new top-level apps or packages without checking [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).** The repo layout is intentional.
- **Don't break the `SiteConfig` contract.** It is the artifact the mockup-generator LLM must produce — adding or renaming fields without a migration plan breaks downstream. See [apps/customer-template/CLAUDE.md](apps/customer-template/CLAUDE.md).
- **Don't reach for Tailwind v3 patterns.** This repo uses Tailwind v4 with CSS-first theming (`@theme` in `global.css`). No `tailwind.config.js`. `@utility` cannot be nested in `@media` — use a plain `.class` for responsive overrides.
- **Don't add a `tailwind.config.js`.** v4 reads tokens from `@theme` blocks in CSS only.
- **Never commit secrets.** `.env` files are gitignored. When adding env vars, document them in `.env.example` (when that file exists) and reference in code via `process.env.X`.
- **Don't ship new fonts without thinking.** The customer-template variants each have a distinctive font system that defines their DNA — don't accidentally use the same fonts across variants.

## Project context

- The user (Berend) has a strong math/ML background — be precise and correct, don't oversimplify. He pushes back on hand-wavy explanations.
- Berend builds via coding agents; structure code/naming for agent navigation.
- He works in NL — defaults to Dutch copy, .nl domains, EU regions for services.

## Memory store

Cross-session memories for this project live at `~/.claude/projects/-Users-berendvannieuwland-Projects-Personal-websites-revivo/memory/`. Index in `MEMORY.md` there. Notable entries:

- `revivo-overview.md` — strategic anchor (brand, scale, moat)
- `revivo-tech-stack.md` — locked-in tech defaults
