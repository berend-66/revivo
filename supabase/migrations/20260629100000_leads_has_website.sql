-- 20260629100000_leads_has_website.sql
-- Add has_website to leads: true = salon has own site, false = confirmed none,
-- null = not yet checked (pre-existing rows). Used by build-openers --no-website
-- to target salons whose first website we would be building.
-- Derived at listing-scrape time from ListingFacts.websiteUrl (treatwell.ts).

alter table public.leads
  add column if not exists has_website boolean;

comment on column public.leads.has_website is
  'Whether the salon has its own website. true = yes (found at scrape time); false = confirmed none on this platform; null = not yet checked.';
