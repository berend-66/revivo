-- 20260603093000_mockups.sql
-- The `mockups` table: one row per generated salon mockup, surfaced at
-- mock.revivo.nl/{slug}. config_json is a full, valid SiteConfig (@revivo/shared)
-- — everything the Astro customer-template needs to render the site.
--
-- Mirrors the MockupRow type in packages/db/src/mockups.ts. Change both together.

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

create table if not exists public.mockups (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  lead_id         uuid,            -- FK to leads added in Stage 4 (leads table doesn't exist yet)
  place_id        text,            -- Google Place id when generated via places mode
  source          text not null default 'manual' check (source in ('manual', 'places')),
  layout_variant  text not null check (layout_variant in ('atelier', 'studio', 'neon')),
  config_json     jsonb not null,  -- the full SiteConfig the template renders
  brief_json      jsonb,           -- the SalonBrief used (provenance / regeneration)
  deploy_url      text,
  model           text,            -- which LLM produced it
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.mockups is
  'Generated salon mockups served at mock.revivo.nl/{slug}. config_json is a valid SiteConfig (@revivo/shared).';

create index if not exists mockups_created_at_idx on public.mockups (created_at desc);
create index if not exists mockups_lead_id_idx on public.mockups (lead_id);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mockups_set_updated_at on public.mockups;
create trigger mockups_set_updated_at
  before update on public.mockups
  for each row
  execute function public.set_updated_at();

-- RLS: locked down by default. The generator (write) and the mock app (read) both
-- use the SERVICE ROLE key server-side, which bypasses RLS. With no anon/authenticated
-- policy, mockups cannot be enumerated through the public PostgREST API — the slug is
-- the capability. If a public anon-read path is ever wanted, add a narrow SELECT policy
-- here (and stop sending whole-table listings to the client).
alter table public.mockups enable row level security;
