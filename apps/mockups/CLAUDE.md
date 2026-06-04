# @revivo/mockups — agent context

`mock.revivo.nl` — the Astro **SSR** app that serves a personalized salon mockup at
`/{slug}`. This is the shareable artifact the moat produces: the URL we WhatsApp to a
prospect. It renders each mockup through the **same** customer-template variant
components the real customer site uses, so the mockup is pixel-identical to the deliverable.

```
src/pages/[slug].astro          → DISPATCHER: look up config, stash on Astro.locals, rewrite to /v/<layout>/<slug>
src/pages/v/<variant>/[slug].astro → render page: statically imports ONE variant Layout (CSS isolation, see below)
src/lib/render.ts                → resolveForVariant() + MOCKUP_CACHE_CONTROL (used by the v/* pages)
src/lib/load-mockup.ts           → dual-source loader: Supabase (prod) else local example JSON (dev)
src/pages/index.astro            → neutral root (mockups live at /{slug}; noindex)
src/pages/404.astro              → SSR fallback for unmatched routes
src/components/NotFound.astro    → un-branded dead end for a missing slug (styles scoped to .nf — never global body{})
```

`[slug].astro` does NOT render a Layout — it rewrites to the per-variant page so each
mockup ships only its own variant's CSS (see "How it reuses the variants" below).

## How it reuses the variants (don't duplicate them)

There is ONE source of the variant components: `apps/customer-template/src/variants/*`.
The mock app does **not** copy them. `astro.config.mjs` aliases `~` →
`../customer-template/src`, so `import AtelierLayout from "~/variants/atelier/Layout.astro"`
pulls the real component, and its internal `~/styles/...` / `./sections/...` imports
resolve correctly. The mock app's own files use **relative** imports (`~` is taken).

Tailwind v4 only scans the current app's cwd by default, which would miss the
customer-template's `.astro` files. The fix lives in the variant CSS: each
`src/styles/<variant>.css` has a `@source "../variants/<variant>"` directive so it
generates its own utilities no matter which app builds it. If you add a variant, add
that directive too.

## Data source

`load-mockup.ts` reads Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set
(service role, server-side only — never shipped to the client), else falls back to
`apps/customer-template/examples[/generated]/<slug>.json`. The local fallback is a dev aid;
production always uses Supabase. Every config is re-validated with `SiteConfigSchema`
before render — a drifted row fails loudly instead of painting a broken page.

## Rules

- **SSR, not static.** `output: "server"` + `@astrojs/vercel` (v8, Astro-5 line). Deploys to
  Vercel as a serverless function; build output lands in `.vercel/output` (gitignored). Needs
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set as Vercel env vars. The custom domain
  `mock.revivo.nl` is attached post-deploy; until then the `*.vercel.app` URL serves.
- **Don't fetch inside variant sections.** They read `props.config` only — the data work
  happened upstream (generator → DB).
- **Cache-Control** is set per mockup (`s-maxage` + `stale-while-revalidate`); mockups
  change rarely and regenerating overwrites the row in place (stable URL).
- This app has **no revivo branding** and **no customer branding of its own** — the
  `/{slug}` page IS the customer's brand; index/404 are deliberately neutral.

## Running it

```bash
cd apps/mockups && pnpm dev        # http://localhost:4321/<slug>  (e.g. /kapsalon-mira)
pnpm build                         # production SSR build → .vercel/output
vercel deploy --prebuilt           # deploy the built output (after `vercel link` + env vars)
```
Generate a mockup to view: `pnpm gen-mockup --fixture-place` (writes the local JSON the
dev fallback reads), or `... --push` once Supabase is configured.
