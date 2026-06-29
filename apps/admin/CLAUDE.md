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

- **revivo's OWN brand only** — burgundy `#3d0a0e` / cream `#f0e4cc` / Cormorant Garamond
  (tokens in `app/globals.css`, mirror `apps/marketing/src/styles/global.css`). NEVER import a
  customer-template variant's CSS/fonts. Plain CSS, no Tailwind (avoids the v4 config dance).
- **Service-role key is server-side only.** All `@revivo/db` calls go through `lib/db.ts`
  (`import "server-only"`); no `NEXT_PUBLIC_` prefix; never a Client Component. Auth is **Vercel
  Authentication / Deployment Protection** on the project (no in-app auth code).
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

Deploy: a separate Vercel project, Root Directory `apps/admin`, Framework Next.js (no adapter, no
`vercel.json`). Set the two Supabase env vars; **enable Vercel Authentication** on the project
(opposite of the mock app, which disabled it). New `deals`/`lead_events`/milestone columns deploy
via the existing `supabase/migrations` GitHub Action on push to `main`.
