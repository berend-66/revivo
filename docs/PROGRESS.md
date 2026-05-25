# revivo — progress log

Living document. Update after each shippable chunk. Keep dates absolute.

## TL;DR

**Current stage: Stage 1 complete.** Stage 0 (revivo.nl marketing site) and Stage 1 (customer site template with three design variants) are built and committed. Nothing is deployed yet. Stage 2 (mockup generator) is the next major build and is gated on Berend providing API keys.

## Stages

The full design + staged plan lives at `~/.claude/plans/i-want-to-build-peaceful-pumpkin.md`. Summary status:

- [x] **Stage 0** — revivo.nl marketing site + monorepo scaffold (commit `e7d5f91`)
- [x] **Stage 1** — customer-template with three variants (commits `f4ab7b8`, `87588ec`)
- [ ] **Stage 2** — mockup generator (LLM pipeline, `mock.revivo.nl/{slug}`)
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

## Manually pending (Berend's TODO)

These steps need a human — Claude can't do them.

| What | How | Why |
|---|---|---|
| Register **revivo.nl** | TransIP (~€10/yr) | Domain needed before deploy |
| Set up **hallo@revivo.nl** mailbox | TransIP mailbox or Google Workspace | Contact CTA needs to land somewhere |
| Set up **cal.com/revivo/kennismaking** | Free Cal.com account | Hero + Contact CTAs link here |
| Deploy `apps/marketing` to Vercel | `cd apps/marketing && npx vercel --prod` or connect repo via Vercel UI | Go live |
| Get **Anthropic API key** | console.anthropic.com | Required for Stage 2 mockup generator |
| Get **Google Places API key** | Google Cloud Console | Required for Stage 2 + Stage 4 sourcing |
| Provision **Supabase project** in EU region | supabase.com | Required for Stage 2 onward |
| Get **TransIP API key** | TransIP control panel | Required for Stage 5 automated domain reg |

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
