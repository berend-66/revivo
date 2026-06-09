# supabase

SQL migrations for the shared revivo Postgres. Plain `.sql` files in
`migrations/`, named `<timestamp>_<name>.sql` and applied in filename order. No ORM —
the schema is the source of truth; `@revivo/db` hand-mirrors the row types (regenerate
with `supabase gen types typescript` once that workflow is set up).

`config.toml` is the Supabase project config (from `supabase init`); `project_id` is just
a local label, and `[db] major_version` is for local dev only (set it to match your
project's Postgres version if you ever run `supabase start`).

## Migrations

- `migrations/20260603093000_mockups.sql` — the `mockups` table (Stage 2). Surfaced at
  `mock.revivo.nl/{slug}`. RLS on, service-role-only access.
- `migrations/20260603120000_mockups_source_listing.sql` — widen `mockups.source` to
  allow `'listing'` (Treatwell-sourced mockups).
- `migrations/20260609100000_leads_jobs.sql` — the `leads` + `jobs` tables (Stage 4):
  prospect funnel with per-source partial-unique dedup, and the polled work queue.
  RLS on, service-role-only access.
- `migrations/20260609100100_mockups_marketplace_lead_fk.sql` — widen `mockups.source`
  to allow `'marketplace'`; resolve the `mockups.lead_id` FK stub (`on delete set null`).
- `migrations/20260609100200_leads_needs_review.sql` — widen `leads.status` with
  `'needs_review'` (the operator parking spot for gate findings / exhausted jobs) +
  add `leads.review_reason`.

## Applying migrations

**A. GitHub integration (default — this repo is connected to the Supabase project).**
Anything committed under `supabase/migrations/` is applied **automatically** when pushed to
the production branch (`main`). So the normal flow is just: commit the migration → push →
Supabase runs it. (PRs may get a preview-branch database if branching is enabled; prod
applies on merge.) Keep migrations **additive and idempotent** — they run unattended.

Manual options, for when you're not going through git:

**B. Dashboard SQL Editor** — paste the contents of the migration file, run.

**C. Supabase CLI**
```bash
supabase login                       # interactive, one-time
supabase link --project-ref <ref>    # <ref> is the subdomain of SUPABASE_URL
supabase db push                     # applies everything in migrations/
```

**D. psql** (if you have the direct connection string)
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260603093000_mockups.sql
```

## Runtime keys (separate from schema)

The GitHub integration only deploys schema. The app still needs `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` in `.env` (Project Settings → API) so the generator can
`--push` rows and the mock app can read them. The service-role key is server-side only.
