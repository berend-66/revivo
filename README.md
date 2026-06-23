# revivo

Automated website service for NL hair & beauty salons.

**Brand:** Revivo Studios — _"Websites voor salons."_ (revivostudios.io)
**Offer:** Custom mobile-first salon website + booking integration, €999 eenmalig, klaar in 5 werkdagen.

## Repository layout

```
apps/
  marketing/          # revivostudios.io — Revivo Studios marketing site (Astro, nl + /en)
  customer-template/  # JSON-driven Astro template every customer site uses
  mockups/            # mock.revivo.nl — SSR mockups from Supabase
  admin/              # Next.js operator workspace

packages/
  llm/                # Claude wrappers (mockup-gen, message-draft, qual-judge)
  sourcing/           # Google Places, KvK, Instagram pipelines
  deploy/             # Vercel + TransIP API wrappers
  db/                 # Supabase client + generated types
  shared/             # Brand tokens, types, utils

scripts/cron/         # Scheduled jobs
supabase/migrations/  # SQL migrations
```

## Plan

Full design + staged build plan: `~/.claude/plans/i-want-to-build-peaceful-pumpkin.md`

## Local dev

```bash
pnpm install
pnpm dev          # runs apps/marketing
pnpm build        # builds every workspace
```
