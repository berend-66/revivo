# Architecture

Single pnpm monorepo. Four Astro/Next.js apps share one Supabase Postgres and one TypeScript codebase. Pipeline orchestration is Vercel Cron + a Postgres `jobs` queue table — explicitly NOT Inngest or anything heavier.

## Repository layout

```
revivo/
├── apps/
│   ├── marketing/          # revivo.nl — Astro static
│   ├── customer-template/  # JSON-driven Astro template (renders any salon)
│   ├── mockups/            # mock.revivo.nl — Astro SSR, reads Supabase (NOT YET BUILT)
│   └── admin/              # Next.js operator workspace (NOT YET BUILT)
├── packages/
│   ├── llm/                # Mockup generator + model-agnostic LLM client (BUILT — manual-brief MVP)
│   ├── sourcing/           # Google Places, KvK, Insta (NOT YET BUILT)
│   ├── deploy/             # Vercel + TransIP API wrappers (NOT YET BUILT)
│   ├── db/                 # Supabase client + types (NOT YET BUILT)
│   └── shared/             # SiteConfig contract + shared types (BUILT)
├── scripts/cron/           # Scheduled jobs (NOT YET BUILT)
├── supabase/migrations/    # SQL migrations (NOT YET BUILT)
├── docs/                   # Living documentation
└── revivo-proposal.pdf     # Customer-facing proposal — brand & spec reference
```

NOT YET BUILT items are scaffolded as you reach each stage in [PROGRESS.md](PROGRESS.md).

## The full pipeline (target end-state)

```
┌────────────────────────────┐
│  Sourcing scripts (cron)   │  Google Places + KvK + Insta scrape
│  → Supabase.leads          │  Claude: screenshot-judge + extract
└────────────┬───────────────┘
             ▼
┌────────────────────────────┐
│  Mockup generator           │  Claude: copy + colors + layout pick
│  → Supabase.mockups         │  → trigger redeploy of mock.revivo.nl
│  → mock.revivo.nl/{slug}    │
└────────────┬───────────────┘
             ▼
┌────────────────────────────┐
│  Lead workspace (Next.js)   │  Browse leads → see mockup → tap WA/IG/Email
│  Per-lead status pipeline   │  Pre-filled messages from Claude
└────────────┬───────────────┘
             ▼
   Reply → Cal.com call → Stripe paid
             ▼
┌────────────────────────────┐
│  Customer build pipeline    │  Fork mockup → apply collected assets
│  → Vercel project per cust  │  → deploy → custom domain via TransIP
│  → Supabase.customers       │
└────────────────────────────┘
```

## Tech stack & why each pick

Boring, well-trodden tools that minimize the attention tax on a single solo operator.

| Concern | Choice | Why |
|---|---|---|
| Static sites (revivo.nl, customer sites, mockups) | **Astro** | Zero-JS by default, perfect for brochure sites; JSON-config-driven templates feel natural |
| Admin app | **Next.js App Router** | React for interactive surfaces; Server Actions for mutations |
| DB + auth | **Supabase** (EU region) | Postgres + auth + RLS in one click; cheap at this scale |
| Styling | **Tailwind v4** (`@tailwindcss/vite`) | CSS-first theming via `@theme`; no JS config file; pairs cleanly with Astro |
| LLM | **Model-agnostic client** (`packages/llm`), default **Claude via OpenRouter** | Generator depends on an `LLMClient` interface only; provider/model are env vars. OpenRouter works today with the user's key; native Anthropic (cheaper + prompt caching) is a one-edit migration. See `packages/llm/CLAUDE.md` |
| Mockup hosting | **single Astro+SSR project at `mock.revivo.nl`** | One `[slug].astro` reads `mockups.config_json` at request time, edge-cached |
| Customer site hosting | **Vercel, one project per customer** | Clean isolation, trivial custom-domain attach via API |
| Domain registration | **TransIP REST API** | NL-native, supports `.nl` programmatically + DNS |
| Pipeline orchestration | **Vercel Cron + Supabase `jobs` queue table** | Inngest / k8s / Kafka are overkill at <200 leads/week |
| Cold email infra | **Instantly.ai**, sender on `outreach.revivo.nl` | Warmed inboxes; kept distinct from main domain to protect deliverability |
| Payments | **Stripe Payment Links** (iDEAL via Stripe) | Add Mollie only if NL conversion drops |
| Calendar | **Cal.com** at `cal.com/revivo` | Self-hostable, generous free tier, embeddable |
| Booking widgets on customer sites | iframe whatever the salon already uses + Cal.com fallback | Detected during qualification, confirmed in asset collection |

If you find yourself adding Redis, Kafka, k8s, microservices, or anything more complex than "cron + queue table," **stop**. At this scale that is almost always overengineering.

## Data flow

### Lead → mockup

1. Cron job pulls Dutch salon Google Places results into `leads` table.
2. KvK enrichment attaches `kvk_number` + SBI code; drop rows outside SBI 9602.
3. Qualification job screenshots the current site (if any), Claude judges design quality, extracts services + brand voice. Score ≤6 or no site → `status='qualified'`.
4. Mockup generator runs Claude twice (cached system prompt): once to extract `{services, brand_voice, brand_colors, best_photo_urls, layout_variant, tagline}`, once to write Dutch section copy. Output: a valid `SiteConfig` written to `mockups.config_json` and surfaced at `mock.revivo.nl/{slug}`.

### Mockup → paying customer

1. Outreach via WhatsApp `wa.me` deep link (manual click-to-send from admin) or IG paste, with email follow-up via Instantly.
2. Reply → Cal.com 15-min call → Stripe payment link → asset-collection form.
3. Build pipeline: merge collected assets into `SiteConfig` → create Vercel project → deploy → register `.nl` domain via TransIP → attach domain → mark `customers.status='live'`.

## Branding constraints

Two separate brand systems. **Do not mix them up.**

- **revivo's own brand** (only used in `apps/marketing/` and `apps/admin/`) — deep burgundy `#3d0c0c` + cream `#f5efe0` + Cormorant Garamond serif with italic gold accents. Sourced from `revivo-proposal.pdf`. Brand tokens are in `apps/marketing/src/styles/global.css`.
- **Customer site brands** — every customer has their own colors, fonts, and identity. The customer-template variants apply a design DNA on top of `config.brand.colors.*`. See [apps/customer-template/CLAUDE.md](../apps/customer-template/CLAUDE.md) for variant details.

## Out of scope (defer until first 20 paying customers)

These items have been explicitly deferred. Don't add unless asked:

- Multi-language sites (DE/FR)
- White-label reseller flow
- Self-service customer dashboard for ongoing edits
- WhatsApp Business API for programmatic outreach
- Automated review/rating import on customer sites
- A/B testing of outreach copy
- AI-generated photos (use real Insta photos instead)
- Inngest, queues beyond a Postgres `jobs` table, any orchestrator
- Microservices / per-package independent deploys
