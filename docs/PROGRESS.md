# revivo — progress log

Living document. Update after each shippable chunk. Keep dates absolute.

## TL;DR

**Current stage: Stage 2 complete (code).** Stage 0 (marketing site), Stage 1 (three-variant template), and all of Stage 2 are built: the mockup generator (manual-brief + **places mode**: Google Places + Instagram-light → SalonBrief), the Supabase **`mockups` table**, and the **`mock.revivo.nl` SSR app** that renders a salon at a shareable `/{slug}` URL through the customer-template variants. The moat is validated live via OpenRouter (Claude) — a fixture Place → real Claude → grounded SiteConfig → rendered in the mock app, all three variants screenshot-checked. Nothing is deployed to the web yet, and the live Places/Supabase paths await real API keys (see below). Next: Stage 3 (admin) or provisioning the keys to run the loop end-to-end.

## Stages

The full design + staged plan lives at `~/.claude/plans/i-want-to-build-peaceful-pumpkin.md`. Summary status:

- [x] **Stage 0** — revivo.nl marketing site + monorepo scaffold (commit `e7d5f91`)
- [x] **Stage 1** — customer-template with three variants (commits `f4ab7b8`, `87588ec`)
- [x] **Stage 2** — mockup generator (manual + places mode) + Supabase `mockups` table + `mock.revivo.nl/{slug}` SSR app. Code complete; live Places/Supabase paths need keys.
- [ ] **Stage 3** — lead workspace admin (Next.js + Supabase)
- [ ] **Stage 4** — sourcing pipeline (Google Places + KvK + qualification)
- [ ] **Stage 5** — build & deploy automation (TransIP + Vercel API)

## What's done in detail

### Stage 0 — revivo.nl marketing site (2026-05-25)

- pnpm workspace monorepo (`apps/*`, `packages/*`) with Turbo-friendly layout
- `apps/marketing/` — Astro 5 + Tailwind v4 single-page site
  - Sections: Hero · Wat je krijgt · Investering · Het proces · Contact · Footer
  - Brand palette + Cormorant Garamond serif headlines + italic gold accents
  - Faithful translation of `revivo-proposal.pdf` (committed for reference)
- Verified: production build passes, both desktop + mobile screenshots match PDF
- Cal.com URL placeholder hard-coded in `apps/marketing/src/components/Contact.astro:3`

### Stage 1 — Customer site template (2026-05-25)

- `apps/customer-template/` — Astro app, JSON-config-driven
- `SiteConfig` TypeScript type + Zod schema in `src/types/site-config.ts` — contract the mockup generator must produce
- `src/data/load-config.ts` loads from `REVIVO_CONFIG` env var (path to JSON)
- **Three variants**, same data, different design DNAs:
  - **Atelier** — warm editorial: Fraunces serif + DM Sans, asymmetric grid, drop caps
  - **Studio** — brutalist minimal: Bricolage Grotesque + IBM Plex Mono, hairlines, monumental headlines
  - **Neon** — bold contemporary: Unbounded + Hanken Grotesk, color-blocked sections, marquee
- `src/pages/index.astro` routes on `config.layout`
- Three example configs in `examples/`:
  - `lume-atelier.json` (Amsterdam-Zuid hair salon)
  - `mast-studio.json` (Rotterdam concept studio)
  - `spark-hair.json` (Rotterdam electric-blue concept salon)
- Verified: all three render correctly on desktop + mobile, both builds pass

### Stage 2 — Mockup generator MVP (2026-05-26)

- `packages/shared` — extracted the `SiteConfig` Zod schema here (the contract) so both the template (consumer) and generator (producer) share it. 29 imports updated.
- `packages/llm` — model-agnostic LLM pipeline:
  - `client.ts` — `LLMClient` interface + OpenAI-compatible adapter (covers OpenRouter + OpenAI). Provider/model/base-URL all from env; switching is a config change.
  - `prompts/mockup-system.ts` — the generator system prompt (variant-pick rubric, palette/copy/pricing guidance, schema).
  - `mockup-generator.ts` — brief → SiteConfig, Zod-validated, 1 retry on schema miss; image URLs rewritten to deterministic picsum BEFORE validation.
  - `dry-run.ts` — deterministic stub (no API call) for plumbing tests.
  - `bin/gen-mockup.ts` — CLI. `pnpm gen-mockup --name ... --city ... --vibe ...` (or `--brief file.json`, `--dry-run`).
- Verified live via OpenRouter (`anthropic/claude-sonnet-4.5`): "Bloom Beauty" (luxe beauty) → **atelier** with sage palette; "VOLT" (brutale Gen-Z) → **neon** with hot magenta + "Haar dat schreeuwt". Both rendered + screenshot-checked. ~€0.04/mockup, 1 attempt after the image-injection fix.
- Generated configs land in `apps/customer-template/examples/generated/` (gitignored — reproducible via CLI).

### Stage 2 — places mode + Supabase sink + mock app (2026-06-03)

- **`SalonBrief` + `slugify` moved to `@revivo/shared`** (was in `packages/llm`). Both the brief *producer* (`@revivo/sourcing`) and *consumer* (`@revivo/llm`) now share the input contract without coupling, mirroring how `SiteConfig` already lives there.
- **`packages/sourcing`** — places mode: Google **Places API (New)** client (`getPlaceDetails` / `searchSalonByText` / photo URLs, header auth + field masks, `fetch` only), **Instagram-light** (handle normalize + pasted bio/captions + env-gated provider seam — no scraping), and `placeToBrief()` which passes through *real* facts (name, address, phone, **real opening hours**, rating, reviews, IG bio) and never invents character. `assembleBriefFromPlaces()` / `assembleBriefFromFixture()` are the entry points; `FIXTURE_PLACE` powers offline/dry-run + the e2e test.
- **`packages/db`** — service-role Supabase client (server-side only) + `mockups` helpers (`upsertMockupBySlug` / `getMockupBySlug`, `config_json` typed as `SiteConfig`). `supabase/migrations/20260603093000_mockups.sql`: the table + RLS (service-role-only) + `updated_at` trigger.
- **`apps/mockups`** — Astro **SSR** (`@astrojs/node`) at `mock.revivo.nl/{slug}`. `[slug].astro` looks up the config (Supabase, or local example JSON when unset) and **rewrites to a per-variant render page** that reuses the customer-template variant components via a `~`→`../customer-template/src` alias. Per-variant pages are deliberate: under SSR a single page importing all three variant Layouts merges their Tailwind globals into one sheet. Each variant CSS now self-declares `@source` so Tailwind generates its utilities when built from the mock app.
- **CLI** (`pnpm gen-mockup`) gained `--place-id` / `--query` / `--fixture-place`, `--ig` / `--ig-bio` / `--ig-captions`, and `--push` (upsert into Supabase). `--dry-run` still costs nothing.
- **Verified**: all packages typecheck; customer-template + marketing + mockups build; a **real** places-mode run (`--fixture-place`, fixture Place → Claude via OpenRouter, 1 attempt, ~€0.04) produced a SiteConfig grounded in the fixture's real hours/address/IG and review voice; the mock app served all three variants (desktop + mobile) + 404, screenshot-checked. Two SSR-specific bugs were found and fixed during verification: (1) all-variant CSS merging under SSR → fixed with the rewrite-to-per-variant-page pattern; (2) the mock app's `NotFound`/`index` chrome used global `body{}` styles, which Astro leaves *unscoped*, leaking `display:grid` into every page that imports them and breaking the neon hero's layout → fixed by scoping those styles to a wrapper.
- **Now live (2026-06-03)**: Supabase is provisioned (EU/Ireland, ref `zbdmmdzqwaynijspbacu`) and the `mockups` table is deployed. Migrations ship via a **GitHub Action** (`.github/workflows/deploy-supabase-migrations.yml`) that runs `supabase db push` on push to `main` — the native Supabase↔GitHub integration only does PR preview branches, not prod deploys, so the Action is what actually deploys schema (needs repo secrets `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD`). Full loop verified against real infra: `--fixture-place --push` → row in Supabase → mock app serves `/kapsalon-mira` straight from the DB (proven by hiding the local file). `GOOGLE_PLACES_API_KEY` is set + validated (live text search returns real NL salons). **Next action: the first real-prospect `--place-id` run.**

## Manually pending (Berend's TODO)

These steps need a human — Claude can't do them.

| What | How | Why |
|---|---|---|
| Register **revivo.nl** | TransIP (~€10/yr) | Domain needed before deploy |
| Set up **hallo@revivo.nl** mailbox | TransIP mailbox or Google Workspace | Contact CTA needs to land somewhere |
| Set up **cal.com/revivo/kennismaking** | Free Cal.com account | Hero + Contact CTAs link here |
| Deploy `apps/marketing` to Vercel | `cd apps/marketing && npx vercel --prod` or connect repo via Vercel UI | Go live |
| Get **Anthropic API key** | console.anthropic.com | Optional — generator runs on the existing OpenRouter key today; native Anthropic later for cheaper + prompt caching |
| Get **TransIP API key** | TransIP control panel | Required for Stage 5 automated domain reg |

✅ Done since: **Google Places API key** (set + validated, live), **Supabase project + `mockups` table** (deployed via the migrations GitHub Action).

## Open decisions / unknowns

- **Booking widget UX per provider** — Treatwell vs Salonized vs Booksy each have their own embed quirks. Defer until first 1–2 real customers tell us which they use.
- **Photography fallback** — what to do when a salon's Insta photos are unusable (low res, all vertical, all selfies). Layout-variant choice mitigates somewhat; long-term may need a paid "shoot day" upsell.
- **Domain ownership at delivery** — plan says register in customer's name; need to confirm TransIP API supports that path or whether we have to use a transfer flow.

## Decision log

Append-only. Date, decision, why.

- **2026-05-25 — €1.000 flat one-time + optional €10–15/mo care plan.** Locked in via PDF proposal. Subscription primary was considered but rejected — one-time matches existing proposal and lower commitment for shop owners.
- **2026-05-25 — WhatsApp click-to-send via `wa.me` deep links + IG manual paste + email follow-up via Instantly.** Berend's preferred channels. Postcards rejected. WhatsApp Business API deferred until volume justifies.
- **2026-05-25 — pnpm monorepo + Astro + Next.js + Supabase + Claude.** All "boring" choices to keep one-operator load low. Inngest deferred unless cron + queue table prove insufficient.
- **2026-05-25 — Three layout variants (Atelier / Studio / Neon).** Polar-opposite design DNAs from the same SiteConfig. LLM will pick variant per-salon based on extracted brand vibe in Stage 2.
- **2026-05-25 — Customer site hosting model: revivo hosts on its own Vercel account, one project per customer, custom domain attached at go-live.** Care plan (€10–15/mo) is the upsell that makes this sustainable.
- **2026-05-26 — LLM is model-agnostic, defaulting to OpenRouter with Claude models.** Berend has an OpenRouter key today (and OpenAI); Anthropic gettable. OpenRouter lets us use Claude (`anthropic/claude-sonnet-4.5`) without waiting. Generator depends only on an `LLMClient` interface; provider is an env change. Reason to keep it swappable: OpenRouter has a markup, so native Anthropic (cheaper + prompt caching) stays a one-edit migration. This supersedes the plan's "Anthropic SDK direct" default for now.
- **2026-05-26 — `SiteConfig` contract relocated to `packages/shared`.** Both the template and the generator depend on it; it no longer lives inside an app.
- **2026-05-26 — Stage 2 built CLI-first / file-based** (chosen over full Supabase flow) to validate the moat cheaply before investing in DB + deploy infra. Generated configs are local files rendered by the existing template.
- **2026-05-26 — Generator rewrites image URLs to placeholders before Zod validation**, not after — a malformed model URL must never trigger a costly retry over a field we discard anyway.
- **2026-06-03 — `SalonBrief` + `slugify` moved to `@revivo/shared`.** It's the *input* contract (the SiteConfig of inputs); co-locating it with `SiteConfig` lets `@revivo/sourcing` (producer) and `@revivo/llm` (consumer) share it without sourcing depending on llm.
- **2026-06-03 — Places mode goes through the existing `SalonBrief` → `generateMockup` path**, not a separate generator. `placeToBrief` maps a Google Place (+ Instagram-light) into a brief; the LLM step is unchanged. Real facts (hours/address/phone/reviews/IG bio) ride along in `brief.notes` so the mockup mirrors reality — credibility is what makes the WhatsApp opener land.
- **2026-06-03 — Instagram-light is intentionally minimal**: handle + human-pasted bio/captions + an env-gated `InstagramProvider` seam (no adapter yet). No scraping — TOS/ban risk; matches the plan's "manual, no scraper" stance.
- **2026-06-03 — `mockups` RLS locked to service-role only.** Both the generator (write) and the mock app (read, in SSR) use the service-role key server-side; no anon policy means mockups can't be enumerated via the public API — the slug is the capability. Revisit if a public listing is ever needed.
- **2026-06-03 — Mock app reuses the customer-template variants (one source) via a `~` alias**, rather than forking them. To keep each mockup page shipping only its variant's CSS under SSR, `[slug].astro` rewrites to a per-variant render page (statically importing all three would merge their Tailwind globals). Each variant CSS self-declares `@source` so it's portable across apps.
- **2026-06-03 — Mock app adapter is `@astrojs/node` (standalone)** for portable local verification; swapping to `@astrojs/vercel` for edge deploy is a one-line change. Edge caching is via `Cache-Control: s-maxage`.
- **2026-06-03 — Migrations deploy via a GitHub Action, not the native Supabase integration.** The native Supabase↔GitHub integration only powers PR preview branches; it does not apply migrations to production on a plain push. `.github/workflows/deploy-supabase-migrations.yml` runs `supabase db push` on push to `main` (repo secrets `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD`; project ref hardcoded, not secret). Verified end-to-end: push → table created → `--push` row → mock app serves it from the DB.
