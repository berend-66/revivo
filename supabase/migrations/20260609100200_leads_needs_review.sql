-- B3 (batch generate worker): the 'needs_review' lead status + review_reason.
--
-- The fidelity checks (scrape cross-check, about-prose fabrication) are SOFT
-- gates: a batch run that hits a hard disagreement must neither silently ship
-- the mockup as done nor silently drop the lead — it parks the lead for the
-- operator. The same parking spot is used when a generate job exhausts its
-- attempts (jobs.status = 'failed'): one place to look, one status to reset
-- back to 'pending' after fixing the cause.
--
-- Additive + idempotent (deploys via the GitHub Action `supabase db push`).

-- Postgres auto-names the inline column check leads_status_check.
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('pending', 'qualified', 'mockup_generated', 'needs_review',
                    'outreach_sent', 'replied', 'dropped'));

-- Why the lead is parked (gate findings / terminal job error). Cleared when a
-- later clean run moves the lead on. Only meaningful with status = 'needs_review'.
alter table public.leads add column if not exists review_reason text;
