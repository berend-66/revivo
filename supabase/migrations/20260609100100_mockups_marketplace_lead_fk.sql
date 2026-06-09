-- 20260609100100_mockups_marketplace_lead_fk.sql
-- Stage 4 / roadmap Phase B1, second half:
--   1. allow source = 'marketplace' — mockups batch-generated from a marketplace
--      lead (vs 'listing' = operator-run --treatwell). Widens the CHECK like
--      20260603120000_mockups_source_listing.sql did.
--   2. resolve the Stage-2 FK stub: mockups.lead_id now really references leads.
--
-- Mirrors MockupSource in packages/db/src/mockups.ts — change both together.
-- Runs after 20260609100000_leads_jobs.sql (leads must exist for the FK).

alter table public.mockups
  drop constraint if exists mockups_source_check;

alter table public.mockups
  add constraint mockups_source_check
  check (source in ('manual', 'places', 'listing', 'marketplace'));

-- on delete set null: deleting a lead must never delete its mockup — the mockup row
-- is the artifact behind a live mock.revivo.nl/{slug} URL.
alter table public.mockups
  drop constraint if exists mockups_lead_id_fkey;

alter table public.mockups
  add constraint mockups_lead_id_fkey
  foreign key (lead_id) references public.leads(id) on delete set null;
