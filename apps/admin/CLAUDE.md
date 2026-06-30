# @revivo/admin — agent context

The **operator workspace** (Stage 3): the Next.js App Router dashboard that is Berend's
point of reference for the outreach & sales pipeline. Reads the live Supabase pipeline
(`leads` / `jobs` / `mockups` / `lead_events` / `deals`) and turns sends + status moves into
one-tap actions. Deployed as its own git-connected Vercel project.

```
app/                → routes (all Server Components, all `export const dynamic = "force-dynamic"`)
  page.tsx          → funnel overview (home)
  outreach/         → worklist: mockup_generated leads → buildOpener → tap WA / copy IG / copy email → Mark sent
  leads/            → leads browser + leads/[id] detail (listing facts, mockup, opener, status + deal controls)
  review/           → needs_review queue + failed jobs → reset to pending
  deals/            → sales pipeline board (reply → … → won/lost), revenue + 5-werkdagen SLA
  jobs/             → queue monitor (batch worker health)
  mockups/          → mockups gallery (QA)
  actions.ts        → "use server" Server Actions (the ONLY mutation path)
components/          → Nav + small client components (OpenerCard, StatusControls, DealPanel — clipboard / action buttons)
lib/db.ts           → `import "server-only"` + the single service-role client (db())
lib/format.ts       → euros-from-cents, dates, status meta
lib/mock-url.ts     → mock host (matches the CLI/openers)
```

## Rules

- **Functional dashboard skin, NOT the marketing brand.** Berend's explicit call (2026-06-29):
  the admin is a tool, so it uses a neutral "light, KPI-forward" SaaS look — white surfaces on a
  soft-gray bg, **Inter**, a left **sidebar**, **blue/teal** accent, colour-coded KPI tiles +
  pipeline-stage chips. Do NOT reintroduce the revivo marketing brand here (burgundy/cream/
  Cormorant) — that's `apps/marketing` only. Never import a customer-template variant's CSS/fonts.
  Tokens live in `app/globals.css`; plain CSS, no Tailwind (avoids the v4 config dance).
- **Service-role key is server-side only.** All `@revivo/db` calls go through `lib/db.ts`
  (`import "server-only"`); no `NEXT_PUBLIC_` prefix; never a Client Component. **Auth =
  HTTP Basic in `middleware.ts`** (env `ADMIN_PASSWORD`, optional `ADMIN_USER`, default user
  `revivo`). We tried Vercel Authentication first, but on this Vercel plan it can't gate the
  **production** `*.vercel.app` URL (only preview), so without the middleware the live app would be
  public (it server-renders data via the service-role key). Keep `ADMIN_PASSWORD` set in prod. If
  the account ever upgrades to Pro, you can switch to Vercel Authentication and drop the middleware.
- **Reads via `@revivo/db`, mutations via Server Actions only.** Don't write Supabase from a
  component body. Each action calls a db helper then `revalidatePath`.
- **Reuse, never re-template.** Openers come from `@revivo/shared` `buildOpener` (same builder as
  the CLI/batch); validate `config_json` with `SiteConfigSchema.parse` and **skip `model ===
  'dry-run-stub'`** + parse failures (exactly what `build-openers` does). The wa.me/Dutch-mobile
  gate lives inside `buildOpener` — don't reimplement it.
- **Respect the funnel contracts.** "Mark sent" is an explicit operator act (never a side effect
  of rendering an opener). A parked `needs_review` lead is only re-pended by the operator
  (`resetToPending`) — the batch enqueue phase auto-picks `pending`.
- **Status-writes only (v1).** The dashboard does NOT trigger mockup generation yet. The seam is a
  future `regenerateLead` action that enqueues a `generate_mockup` job via `enqueueJobIfNone`.

## Running it

```bash
pnpm -F @revivo/admin dev      # http://localhost:3000  (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
pnpm -F @revivo/admin build
```

**Deployed:** Vercel project `revivo-admin` → https://revivo-admin.vercel.app (LIVE, 2026-06-29).
Project settings: Root Directory `apps/admin`, Framework Next.js, env `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` + `ADMIN_USER`/`ADMIN_PASSWORD`. It is **NOT git-connected yet** (the
Vercel GitHub App isn't installed for this repo), so deploys are manual from the **repo root**:

```bash
vercel deploy --prod --yes      # from repo root — uploads the whole monorepo so pnpm resolves
                                # @revivo/* workspace deps; Root Directory tells Vercel it's apps/admin
```

A subdir-only `vercel deploy` from `apps/admin` FAILS (npm install on `workspace:*` with no
workspace context). To get push-to-deploy later, install the Vercel GitHub App on the repo and
connect it (then production = `main`). DB migrations deploy separately via the existing
`supabase/migrations` GitHub Action on push to `main` (or `supabase db push` when linked).
