-- 20260603120000_mockups_source_listing.sql
-- Allow source = 'listing' — mockups sourced from a salon's public listing
-- (Treatwell): real menu/prices/team/hours/reviews/photos. Additive: widens the
-- CHECK constraint created inline in 20260603093000_mockups.sql.
--
-- Mirrors MockupSource in packages/db/src/mockups.ts — change both together.
-- Apply via the dashboard SQL editor / `supabase db push` / psql (the service-role
-- key can't run DDL). See supabase/README.md.

alter table public.mockups
  drop constraint if exists mockups_source_check;

alter table public.mockups
  add constraint mockups_source_check
  check (source in ('manual', 'places', 'listing'));
