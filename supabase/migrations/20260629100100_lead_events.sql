-- 20260629100100_lead_events.sql
-- `lead_events` — an append-only audit log of what happened to a lead and WHEN.
-- The leads table carries current state (status + a few milestone timestamps);
-- this carries the history those overwritten columns lose: every status change,
-- the actual opener text/channel/hook that was sent, a received reply, an operator
-- note. One row per event, never updated. It's the substrate for funnel velocity
-- and the future "which hook converts" measurement.
--
-- Mirrors LeadEventRow in packages/db/src/lead-events.ts. Change both together.
-- Additive + idempotent (deploys via the GitHub Action `supabase db push`).

create table if not exists public.lead_events (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  -- what kind of event this row records
  event_type   text not null
               check (event_type in ('status_change', 'outreach_sent', 'reply_received', 'note')),
  -- for status_change: the transition (either may be null at the funnel edges)
  from_status  text,
  to_status    text,
  -- for outreach_sent / reply_received: how it went out / came in
  channel      text check (channel is null or channel in
                 ('whatsapp', 'instagram', 'email', 'phone', 'other')),
  -- which buildOpener hook the sent opener used (rating / menu-item / city)
  hook         text,
  -- the actual message text (opener sent, or reply received) — never stored before
  message_text text,
  -- full structured snapshot when useful (e.g. the whole Opener object)
  body_json    jsonb,
  -- when the event actually happened (operator may backdate); created_at is the row write
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

comment on table public.lead_events is
  'Append-only audit log of lead funnel events (status changes, sent openers, replies, notes). One row per event, never updated — the history the leads row overwrites.';

create index if not exists lead_events_lead_id_idx on public.lead_events (lead_id);
create index if not exists lead_events_occurred_at_idx on public.lead_events (occurred_at desc);

-- RLS: locked down, service-role only — same posture as leads/jobs/mockups. The
-- operator admin reads/writes it server-side with the service-role key; never
-- reachable through the public PostgREST API.
alter table public.lead_events enable row level security;
