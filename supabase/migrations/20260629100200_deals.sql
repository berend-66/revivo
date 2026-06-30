-- 20260629100200_deals.sql
-- `deals` — the sales pipeline PAST first reply. The leads funnel ends at
-- 'replied'; from there a prospect moves through call → proposal → won/lost, and a
-- won deal carries revenue (the €999 price) and delivery/SLA timing. One row per
-- commercial attempt for a lead.
--
-- Delivery/SLA fields (build_started_at, delivered_at) live here rather than in a
-- separate `customers` table — at ~50-200 lifetime customers one pipeline table is
-- the boring choice; split `customers` out later if deliveries need their own entity.
--
-- Mirrors DealRow in packages/db/src/deals.ts. Change both together.
-- Additive + idempotent (deploys via the GitHub Action `supabase db push`).

create table if not exists public.deals (
  id                  uuid primary key default gen_random_uuid(),
  -- nullable + on delete set null: a won deal / its revenue must outlive a lead
  -- delete (same posture as mockups.lead_id), never cascade away cash.
  lead_id             uuid references public.leads(id) on delete set null,
  stage               text not null default 'reply'
                      check (stage in ('reply', 'call_booked', 'call_held',
                                       'proposal_sent', 'won', 'lost')),
  -- money in integer cents (€999 → 99900); never a float for currency.
  amount_cents        integer,
  currency            text not null default 'EUR',
  -- why a deal was lost; only meaningful with stage = 'lost' (mirrors the
  -- drop_reason / review_reason '_reason' convention on leads).
  lost_reason         text,
  -- per-stage timestamps → pipeline velocity (set when the stage is reached)
  call_booked_at      timestamptz,
  call_held_at        timestamptz,
  proposal_sent_at    timestamptz,
  won_at              timestamptz,
  lost_at             timestamptz,
  -- delivery / 5-werkdagen SLA on a won deal: SLA = delivered_at - build_started_at
  build_started_at    timestamptz,
  delivered_at        timestamptz,
  -- external refs from the data flow (ARCHITECTURE.md): the call + the payment link
  cal_com_url         text,
  stripe_payment_link text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.deals is
  'Sales pipeline past first reply: call → proposal → won/lost, revenue (amount_cents) and delivery/SLA timing. lead_id is nullable on delete set null so revenue outlives a lead delete.';

create index if not exists deals_lead_id_idx on public.deals (lead_id);
create index if not exists deals_stage_idx on public.deals (stage);

-- set_updated_at() already exists (created in 20260603093000_mockups.sql).
drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at
  before update on public.deals
  for each row
  execute function public.set_updated_at();

-- RLS: locked down, service-role only — same posture as the rest of the schema.
alter table public.deals enable row level security;
