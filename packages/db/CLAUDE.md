# @revivo/db — agent context

The Supabase data layer. Thin, typed helpers over `@supabase/supabase-js`. Today it
covers the `mockups` table (Stage 2); `leads`, `customers`, `jobs` etc. land in later stages.

```
config.ts   → SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY → settings (null when unset, so callers can fall back)
client.ts   → createServiceClient() / createServiceClientOrNull()  ← service role, SERVER-SIDE ONLY
mockups.ts  → MockupRow type + upsertMockupBySlug / getMockupBySlug / listRecentMockups
```

Schema lives in `supabase/migrations/*.sql` (repo root). `MockupRow` hand-mirrors
`20260603093000_mockups.sql` — **change both together**.

## Rules

- **Service-role key is server-side only.** It bypasses RLS; never import this package
  into client-side code or expose the key in a browser bundle. The mock app uses it in
  SSR frontmatter (server); the generator CLI uses it from Node.
- **`slug` is the natural key.** `upsertMockupBySlug` overwrites in place so a salon's
  mock.revivo.nl URL stays stable across regenerations.
- **`config_json` is a `SiteConfig`** (`@revivo/shared`) — validate before trusting it on
  read (the mock app does). `layout_variant` is denormalised from `config.layout` for cheap filtering.
- Helpers return plain rows / throw on error — no silent failures.

## Applying schema

See `supabase/README.md`. The service-role key can't run DDL; use the dashboard SQL
editor, the Supabase CLI (`db push`), or psql.
