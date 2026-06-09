import { SiteConfigSchema, slugify } from "@revivo/shared";
import {
  getLeadById,
  getMockupBySlug,
  getMockupsByLeadId,
  markJobResult,
  setLeadStatus,
  upsertMockupBySlug,
  MAX_JOB_ATTEMPTS,
  type JobRow,
  type LeadRow,
  type MockupRow,
  type MockupSource,
  type SupabaseClient,
} from "@revivo/db";
import type { FidelityReport } from "@revivo/sourcing";
import type { LLMClient } from "./client";
import { generateMockupForListing, type ListingMockupResult, type MockupGates } from "./run-mockup";

/**
 * One claimed `generate_mockup` job, start to finish (roadmap B3): load the
 * lead → `generateMockupForListing` → upsert the mockup → move the lead →
 * `markJobResult`. This is the worker core that `scripts/generate-pending.ts`
 * drains today and the C1 cron will drain later — both stay thin shells.
 *
 * It is the ONE module in `@revivo/llm` that composes `@revivo/db` (the rest of
 * src/ stays provider/pipeline-pure); it still creates no clients and reads no
 * env — the caller owns the Supabase client and any LLM client injection.
 *
 * Disposition rules:
 *  - lead not `pending`      → job completed WITHOUT generating (outcome
 *                              "skipped"). Jobs outlive runs (bounded drain,
 *                              retry backoff); the lead status is the operator's
 *                              control surface and the worker never overrides
 *                              it — a lead dropped or parked between enqueue and
 *                              claim must stay exactly where the operator put it.
 *  - clean run               → mockup upserted, lead `mockup_generated`
 *  - gate "needs_review"     → mockup STILL upserted (the operator reviews the
 *                              live mock URL against the listing), lead parked
 *                              `needs_review` with the gate reasons
 *  - stub run (opts.dryRun)  → mockup (stub config) upserted, lead UNTOUCHED —
 *                              it stays `pending`, so the next real run
 *                              regenerates it at the same slug. The infra test
 *                              must never consume the pending pool.
 *  - generation threw        → markJobResult schedules the backoff retry; after
 *                              MAX_JOB_ATTEMPTS the lead is parked `needs_review`
 *                              with the error FIRST and the job marked terminal
 *                              `failed` second — if the park fails, the job stays
 *                              `running` (visible, no silent re-enqueue) instead
 *                              of `failed` with a still-`pending` lead, which the
 *                              next run would happily re-enqueue forever.
 */

/** "utrecht" is in "salon-utrecht" but "ede" is NOT in "salon-bredene" —
 * city containment must respect slug segment boundaries. */
function slugHasCity(slug: string, citySlug: string): boolean {
  return (
    slug === citySlug ||
    slug.startsWith(`${citySlug}-`) ||
    slug.endsWith(`-${citySlug}`) ||
    slug.includes(`-${citySlug}-`)
  );
}

/** Slug candidates for a new mockup, claiming only what's free or already ours.
 * Two distinct salons can slugify to the same name (the roadmap's collision
 * risk) — never overwrite another lead's (or a hand-made) mockup behind its
 * live mock.revivo.nl URL. Pure given `lookup`; the worker passes `getMockupBySlug`. */
export async function pickMockupSlug(opts: {
  desired: string;
  leadId: string;
  city?: string | null;
  lookup: (slug: string) => Promise<{ lead_id: string | null } | null>;
}): Promise<string> {
  const citySlug = opts.city ? slugify(opts.city) : "";
  const base =
    citySlug && !slugHasCity(opts.desired, citySlug) ? `${opts.desired}-${citySlug}` : opts.desired;
  const candidates = [opts.desired];
  if (base !== opts.desired) candidates.push(base);
  for (let n = 2; n <= 9; n++) candidates.push(`${base}-${n}`);

  for (const slug of candidates) {
    const row = await opts.lookup(slug);
    if (!row || row.lead_id === opts.leadId) return slug;
  }
  throw new Error(`pickMockupSlug: no free slug found for "${opts.desired}" (lead ${opts.leadId})`);
}

/** Pure gate-verdict → funnel-state mapping (kept separate so it's testable). */
export function decideLeadDisposition(gates: MockupGates): {
  status: "mockup_generated" | "needs_review";
  reviewReason: string | null;
} {
  if (gates.verdict === "needs_review") {
    return { status: "needs_review", reviewReason: gates.reasons.join(" · ") };
  }
  // Clearing review_reason on a clean run un-parks a previously flagged lead.
  return { status: "mockup_generated", reviewReason: null };
}

export interface GenerateJobOpts {
  /** Deterministic stub config, no LLM cost — full-loop infrastructure test.
   * The stub is pushed at the lead's real slug but the lead STAYS `pending`,
   * so the next real run replaces it (same slug — see the pinning below). */
  dryRun?: boolean;
  client?: LLMClient;
}

export type GenerateJobOutcome =
  | {
      status: "succeeded";
      job: JobRow;
      lead: LeadRow;
      mockup: MockupRow;
      result: ListingMockupResult;
      /** "pending" = stub run, lead deliberately untouched. */
      leadStatus: "mockup_generated" | "needs_review" | "pending";
    }
  | {
      /** Stale job: the lead left `pending` between enqueue and claim. The job
       * is completed (nothing to do), the lead is NOT touched. */
      status: "skipped";
      job: JobRow;
      lead: LeadRow;
      reason: string;
    }
  | {
      status: "retry_scheduled" | "failed";
      job: JobRow;
      lead: LeadRow | null;
      error: string;
      /** Tokens spent before the failure (e.g. generation OK, sink failed). */
      usage?: { inputTokens: number; outputTokens: number };
    };

export async function runGenerateMockupJob(
  db: SupabaseClient,
  job: JobRow,
  opts: GenerateJobOpts = {},
): Promise<GenerateJobOutcome> {
  const lead = await getLeadById(db, job.lead_id);
  if (!lead) return failJob(db, job, null, "lead bestaat niet meer");

  if (lead.status !== "pending") {
    // Operator moved the lead (dropped / parked / already generated) after this
    // job was enqueued. Complete the job without generating; never override.
    const finalJob = await markJobResult(db, job, { ok: true });
    return {
      status: "skipped",
      job: finalJob,
      lead,
      reason: `lead status is '${lead.status}' — overgeslagen, niets gegenereerd`,
    };
  }

  if (!lead.listing_url) {
    return failJob(
      db,
      job,
      lead,
      `lead heeft geen listing_url (source ${lead.source}) — generate_mockup kan alleen listing-leads aan`,
    );
  }

  let result: ListingMockupResult;
  try {
    result = await generateMockupForListing({
      listingUrl: lead.listing_url,
      dryRun: opts.dryRun,
      client: opts.client,
    });
  } catch (err) {
    // A scrape-fidelity MISMATCH diagnosis rides on generation errors (see
    // runMockupPipeline) — keep it in last_error for the manual review.
    const fidelity = (err as Error & { scrapeFidelity?: FidelityReport }).scrapeFidelity;
    const suffix = fidelity?.verdict === "mismatch" ? ` [scrape-fidelity mismatch: ${fidelity.summary}]` : "";
    return failJob(db, job, lead, `${(err as Error).message}${suffix}`);
  }

  // Sinks. A failure here goes through the same retry path — regenerating costs
  // ~€0.04; a funnel state that matches what's actually persisted wins.
  try {
    let config = result.config;

    // URL stability: a lead that already has a mockup keeps its slug, whatever
    // slug the model picked this run — re-runs (incl. stub → real) overwrite in
    // place, never orphan the old row behind its live mock URL.
    const existing = await getMockupsByLeadId(db, lead.id);
    const slug = existing[0]
      ? existing[0].slug
      : await pickMockupSlug({
          desired: config.slug,
          leadId: lead.id,
          city: lead.city,
          lookup: (s) => getMockupBySlug(db, s),
        });
    if (slug !== config.slug) config = SiteConfigSchema.parse({ ...config, slug });

    // Mockup provenance follows the lead's source ("marketplace" today; a
    // hypothetical listing-bearing google_places lead would be "places").
    const source: MockupSource = lead.source === "marketplace" ? "marketplace" : "places";
    const mockup = await upsertMockupBySlug(db, {
      slug,
      config,
      source,
      leadId: lead.id,
      placeId: lead.place_id ?? undefined,
      brief: result.brief,
      model: result.model,
    });

    let updatedLead = lead;
    let leadStatus: "mockup_generated" | "needs_review" | "pending" = "pending";
    if (!opts.dryRun) {
      const disposition = decideLeadDisposition(result.gates);
      updatedLead = await setLeadStatus(db, lead.id, disposition.status, {
        reviewReason: disposition.reviewReason,
        listingFacts: result.facts,
      });
      leadStatus = disposition.status;
    }

    const finalJob = await markJobResult(db, job, { ok: true });
    return { status: "succeeded", job: finalJob, lead: updatedLead, mockup, result, leadStatus };
  } catch (err) {
    return failJob(db, job, lead, `sink na generatie mislukt: ${(err as Error).message}`, result.usage);
  }
}

async function failJob(
  db: SupabaseClient,
  job: JobRow,
  lead: LeadRow | null,
  error: string,
  usage?: { inputTokens: number; outputTokens: number },
): Promise<GenerateJobOutcome> {
  // attempt_count was incremented at claim; this mirrors markJobResult's own
  // terminal predicate. Park the lead BEFORE flipping the job terminal: the
  // park leaving `pending` is the only thing stopping the next run's enqueue
  // phase from re-queueing a terminally failed lead (the one-live-job index
  // doesn't cover 'failed'). If the park throws, the job stays `running` —
  // visible and re-queued by hand, per the documented no-reaper stance.
  const willBeTerminal = job.attempt_count >= MAX_JOB_ATTEMPTS;
  if (willBeTerminal && lead) {
    await setLeadStatus(db, lead.id, "needs_review", {
      reviewReason: `generatie definitief mislukt na ${job.attempt_count} pogingen: ${error}`,
    });
  }
  const finalJob = await markJobResult(db, job, { ok: false, error });
  return {
    status: finalJob.status === "failed" ? "failed" : "retry_scheduled",
    job: finalJob,
    lead,
    error,
    usage,
  };
}
