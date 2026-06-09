-- 20260609100000_leads_jobs.sql
-- Stage 4 / roadmap Phase B1: the `leads` table (prospect salons discovered by
-- sourcing) and the `jobs` table (the Postgres-table work queue the batch worker
-- polls). At ~50-200 lifetime customers these two tables + a polling script (later
-- one Vercel Cron) are the ENTIRE orchestration layer — deliberately no queue service.
--
-- Mirrors LeadRow in packages/db/src/leads.ts and JobRow in packages/db/src/jobs.ts.
-- Change both together.

-- ── leads ────────────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id                  uuid primary key default gen_random_uuid(),
  -- where this prospect was discovered
  source              text not null check (source in ('marketplace', 'google_places')),
  -- dedup key per source (enforced by the partial unique indexes below):
  --   marketplace   → listing_url (the salon's public listing page, e.g. Treatwell)
  --   google_places → place_id
  listing_url         text,
  place_id            text,
  query_text          text,         -- the crawl/search query that surfaced this lead
  name                text,
  city                text,
  postcode            text,
  kvk_number          text,         -- KvK enrichment (roadmap D1) — null until then
  sbi_code            text,
  listing_facts_json  jsonb,        -- ListingFacts snapshot (@revivo/shared), filled at generation time
  place_details_json  jsonb,        -- Google Place details snapshot, when sourced via Places
  status              text not null default 'pending'
                      check (status in ('pending', 'qualified', 'mockup_generated',
                                        'outreach_sent', 'replied', 'dropped')),
  drop_reason         text,         -- why status = 'dropped'
  -- RESERVED, currently unused: lead-level scheduling (D1 KvK-enrichment retry,
  -- outreach follow-ups). Job execution backoff lives on jobs.next_retry_at, not here.
  next_retry_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- the dedup key for a source must actually be present
  constraint leads_marketplace_needs_listing_url
    check (source <> 'marketplace' or listing_url is not null),
  constraint leads_google_places_needs_place_id
    check (source <> 'google_places' or place_id is not null)
);

comment on table public.leads is
  'Prospect salons discovered by sourcing (Stage 4). Dedup is per source: listing_url for marketplace, place_id for google_places (partial unique indexes — deliberately NOT one composite key).';

-- Dedup: PARTIAL unique per source, not one composite key — a composite would either
-- reject valid leads (a marketplace lead has no place_id) or merge distinct ones.
-- NOTE: PostgREST cannot target a partial index via on_conflict, so insertLeadIfNew
-- in @revivo/db does select-then-insert and treats a 23505 as "already exists".
create unique index if not exists leads_marketplace_listing_url_key
  on public.leads (listing_url) where source = 'marketplace';
create unique index if not exists leads_google_places_place_id_key
  on public.leads (place_id) where source = 'google_places';

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- set_updated_at() already exists (created in 20260603093000_mockups.sql).
drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row
  execute function public.set_updated_at();

-- RLS: locked down, service-role only — same posture as mockups. No anon/authenticated
-- policies; prospect data is never reachable through the public PostgREST API.
alter table public.leads enable row level security;

-- ── jobs ─────────────────────────────────────────────────────────────────────

create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.leads(id) on delete cascade,
  job_type      text not null default 'generate_mockup'
                check (job_type in ('generate_mockup')),
  status        text not null default 'pending'
                check (status in ('pending', 'running', 'succeeded', 'failed')),
  attempt_count integer not null default 0,  -- claims so far; incremented when a worker claims
  last_error    text,
  next_retry_at timestamptz,                 -- backoff after a failed attempt; null = due now
  completed_at  timestamptz,                 -- set on terminal status (succeeded | failed)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.jobs is
  'Postgres-table work queue (Stage 4). Polled by the batch worker (later one Vercel Cron) — deliberately not a queue service at this scale.';

-- at most one live job per (lead, type) → enqueueJobIfNone is idempotent
create unique index if not exists jobs_one_live_per_lead_type_key
  on public.jobs (lead_id, job_type) where status in ('pending', 'running');

-- the poll: due pending jobs, oldest first
create index if not exists jobs_pending_due_idx
  on public.jobs (created_at) where status = 'pending';

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row
  execute function public.set_updated_at();

alter table public.jobs enable row level security;
