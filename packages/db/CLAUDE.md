# @revivo/db — agent context

The Supabase data layer. Thin, typed helpers over `@supabase/supabase-js`. Covers the
`mockups` table (Stage 2) and the `leads` + `jobs` tables (Stage 4); `customers` etc.
land in later stages.

```
config.ts      → SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY → settings (null when unset, so callers can fall back)
client.ts      → createServiceClient() / createServiceClientOrNull()  ← service role, SERVER-SIDE ONLY
mockups.ts     → MockupRow type + upsertMockupBySlug / getMockupBySlug / getMockupsByLeadId / listRecentMockups
leads.ts       → LeadRow + insertLeadIfNew / getLeadById / listLeadsByStatus / setLeadStatus
                 + outreach transitions (markOutreachSent / markReplied / dropLead / resetToPending / setFollowUp)
                 + dashboard reads (leadStatusCounts / listLeads)
jobs.ts        → JobRow + enqueueJobIfNone / claimNextPendingJob / markJobResult / listJobsByStatus
lead-events.ts → LeadEventRow + appendLeadEvent / listLeadEventsByLead (append-only funnel audit log)
deals.ts       → DealRow + getDealByLeadId / getOrCreateDealForLead / setDealStage / updateDeal / listDeals
                 + dealStageCounts / wonRevenueCents (the sales pipeline past 'replied')
```

Schema lives in `supabase/migrations/*.sql` (repo root). Row types hand-mirror the
migrations (`mockups` ↔ `20260603093000`, `leads`/`jobs` ↔ `20260609100000` +
`20260609100200` for `needs_review`/`review_reason` + `20260629100300` for the
outreach-milestone columns; `lead_events` ↔ `20260629100100`; `deals` ↔
`20260629100200`) — **change both together**.
The index also re-exports the `SupabaseClient` **type** so consumers (e.g.
`@revivo/llm`'s worker core) type their handles via this package instead of
growing a direct supabase-js dependency.

## Rules

- **Service-role key is server-side only.** It bypasses RLS; never import this package
  into client-side code or expose the key in a browser bundle. The mock app uses it in
  SSR frontmatter (server); the generator CLI uses it from Node.
- **`slug` is the natural key.** `upsertMockupBySlug` overwrites in place so a salon's
  mock.revivo.nl URL stays stable across regenerations.
- **`config_json` is a `SiteConfig`** (`@revivo/shared`) — validate before trusting it on
  read (the mock app does). `layout_variant` is denormalised from `config.layout` for cheap filtering.
- Helpers return plain rows / throw on error — no silent failures.
- **Leads dedup is per source** (partial unique indexes: `listing_url` for marketplace,
  `place_id` for google_places — deliberately NOT one composite key). PostgREST can't
  target a partial index via `on_conflict`, so `insertLeadIfNew` is select-then-insert
  with the index as the 23505 race backstop. Don't "simplify" it to `.upsert()` — that
  call fails against a partial unique index.
- **Job claiming is an optimistic CAS** (`update … eq(status,'pending').eq(attempt_count, seen)`),
  because PostgREST has no `FOR UPDATE SKIP LOCKED`. Correct at worker concurrency 1-2 —
  which is the design point; don't raise concurrency without revisiting this.
- **Jobs are a polled Postgres table, not a queue service** (the ~50-200-customers anchor).
  A job exhausting `MAX_JOB_ATTEMPTS` goes to `failed` for manual review — no dead-letter
  infra. A crashed worker leaves a `running` row; at this scale the operator re-queues by
  hand (no reaper until that actually hurts).
- **`needs_review` is the single operator-attention status** (B3): gate findings AND
  terminally failed generate jobs both park the lead there with a `review_reason`. Recovery
  is uniform — fix the cause, set the lead back to `pending`. The batch enqueue phase only
  looks at `pending`, so parked leads are never silently re-queued. A clean later run clears
  `review_reason` (pass `reviewReason: null`).

## Applying schema

See `supabase/README.md`. The service-role key can't run DDL; use the dashboard SQL
editor, the Supabase CLI (`db push`), or psql.
