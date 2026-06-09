import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The `jobs` table — the Postgres-table work queue (Stage 4). Mirrors
 * supabase/migrations/20260609100000_leads_jobs.sql — change both together.
 *
 * Deliberately NOT a queue service: at ~50-200 lifetime customers a polled table
 * is the whole orchestration layer. PostgREST has no SELECT ... FOR UPDATE SKIP
 * LOCKED, so claiming is an optimistic compare-and-swap on (status, attempt_count)
 * — fine at worker concurrency 1-2.
 */

export type JobType = "generate_mockup";

export type JobStatus = "pending" | "running" | "succeeded" | "failed";

export interface JobRow {
  id: string;
  lead_id: string;
  job_type: JobType;
  status: JobStatus;
  /** Claims so far — incremented when a worker claims, so "running" is attempt N. */
  attempt_count: number;
  last_error: string | null;
  /** Backoff after a failed attempt; null = due now. */
  next_retry_at: string | null;
  /** Set on terminal status (succeeded | failed). */
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "jobs";

/** A job that fails this many claims is marked failed and left for manual review. */
export const MAX_JOB_ATTEMPTS = 3;
/** Retry backoff: RETRY_BASE_MS · 2^(attempt-1), capped — 5 min, 10 min, 20 min, … */
export const RETRY_BASE_MS = 5 * 60_000;
export const RETRY_CAP_MS = 6 * 60 * 60_000;

export interface EnqueueJobResult {
  /** False when a live (pending/running) job of this type already exists for the lead. */
  enqueued: boolean;
  job: JobRow | null;
}

/** Enqueue a job unless a live one already exists for (lead, type) — idempotent via
 * the jobs_one_live_per_lead_type_key partial unique index. */
export async function enqueueJobIfNone(
  client: SupabaseClient,
  leadId: string,
  jobType: JobType = "generate_mockup",
): Promise<EnqueueJobResult> {
  const { data, error } = await client
    .from(TABLE)
    .insert({ lead_id: leadId, job_type: jobType })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: live, error: liveError } = await client
        .from(TABLE)
        .select("*")
        .eq("lead_id", leadId)
        .eq("job_type", jobType)
        .in("status", ["pending", "running"])
        .maybeSingle();
      if (liveError) throw new Error(`enqueueJobIfNone(${leadId}): live lookup failed: ${liveError.message}`);
      return { enqueued: false, job: (live as JobRow | null) ?? null };
    }
    throw new Error(`enqueueJobIfNone(${leadId}) failed: ${error.message}`);
  }
  return { enqueued: true, job: data as JobRow };
}

/** Claim the oldest due pending job: flip it to running and bump attempt_count.
 * Optimistic CAS — if another worker wins the row, try the next candidate.
 * Returns null when nothing is due. */
export async function claimNextPendingJob(
  client: SupabaseClient,
  jobType: JobType = "generate_mockup",
): Promise<JobRow | null> {
  for (let tries = 0; tries < 3; tries++) {
    const nowIso = new Date().toISOString();
    const { data: candidate, error } = await client
      .from(TABLE)
      .select("id, attempt_count")
      .eq("status", "pending")
      .eq("job_type", jobType)
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`claimNextPendingJob: candidate select failed: ${error.message}`);
    if (!candidate) return null;

    const { data: claimed, error: claimError } = await client
      .from(TABLE)
      .update({ status: "running", attempt_count: candidate.attempt_count + 1 })
      .eq("id", candidate.id)
      .eq("status", "pending")
      .eq("attempt_count", candidate.attempt_count)
      .select()
      .maybeSingle();
    if (claimError) throw new Error(`claimNextPendingJob: claim failed: ${claimError.message}`);
    if (claimed) return claimed as JobRow;
    // lost the race — loop and pick the next candidate
  }
  return null;
}

export type JobResult = { ok: true } | { ok: false; error: string };

/** Record the outcome of a claimed (running) job. Success → succeeded. Failure →
 * back to pending with exponential-backoff next_retry_at, or failed once
 * MAX_JOB_ATTEMPTS claims are used up (left for manual review — no auto-retry). */
export async function markJobResult(
  client: SupabaseClient,
  job: JobRow,
  result: JobResult,
): Promise<JobRow> {
  const nowIso = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (result.ok) {
    patch = { status: "succeeded", completed_at: nowIso, last_error: null, next_retry_at: null };
  } else if (job.attempt_count >= MAX_JOB_ATTEMPTS) {
    patch = { status: "failed", completed_at: nowIso, last_error: result.error, next_retry_at: null };
  } else {
    const backoffMs = Math.min(RETRY_BASE_MS * 2 ** (job.attempt_count - 1), RETRY_CAP_MS);
    patch = {
      status: "pending",
      last_error: result.error,
      next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
    };
  }
  const { data, error } = await client.from(TABLE).update(patch).eq("id", job.id).select().single();
  if (error) throw new Error(`markJobResult(${job.id}) failed: ${error.message}`);
  return data as JobRow;
}

/** Jobs in a given status, oldest first — for the batch summary / manual review. */
export async function listJobsByStatus(
  client: SupabaseClient,
  status: JobStatus,
  limit = 100,
): Promise<JobRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listJobsByStatus(${status}) failed: ${error.message}`);
  return (data as JobRow[]) ?? [];
}
