-- 20260629100300_leads_outreach_milestones.sql
-- (renamed from 20260629100000 — that slot collided with main's
--  20260629100000_leads_has_website.sql, so this never applied; bumped to 100300.)
-- Outreach-funnel velocity columns on `leads`. The single `updated_at` is
-- overwritten on every write, so it can't tell us WHEN a lead was contacted or
-- replied — these per-transition timestamps can. They are written by the new
-- @revivo/db transition helpers (markOutreachSent / markReplied / setFollowUp);
-- the operator admin reads them for reply-rate + follow-up nudges.
--
-- Mirrors LeadRow in packages/db/src/leads.ts. Change both together.
-- Additive + idempotent (deploys via the GitHub Action `supabase db push`).

alter table public.leads add column if not exists outreach_sent_at timestamptz;
alter table public.leads add column if not exists replied_at        timestamptz;
alter table public.leads add column if not exists follow_up_at       timestamptz;

-- Which channel the opener was sent on, and which buildOpener hook it used — the
-- substrate for "which hook converts" once ~20 sends are out (NO LLM A/B yet).
alter table public.leads add column if not exists outreach_channel text
  check (outreach_channel is null or outreach_channel in ('whatsapp', 'instagram', 'email'));
alter table public.leads add column if not exists outreach_hook text;

-- Drives the "no reply after N days → nudge" worklist; partial so it only indexes
-- the few leads that actually have a follow-up scheduled.
create index if not exists leads_follow_up_at_idx
  on public.leads (follow_up_at) where follow_up_at is not null;

-- NOTE: leads.next_retry_at stays RESERVED/unused (D1 KvK retry) — do NOT overload
-- it for outreach follow-ups; follow_up_at above is the dedicated column.
