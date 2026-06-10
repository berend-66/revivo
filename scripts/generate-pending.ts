/**
 * Hand-run batch generate worker (roadmap B3): enqueue a generate_mockup job for
 * every pending marketplace lead, then drain due jobs sequentially through
 * `runGenerateMockupJob` (@revivo/llm) — the same core the C1 cron will drain
 * later. Keep this script THIN: arg parsing + the poll loop + the summary only.
 *
 *   pnpm generate-pending --dry-run            # report what would run, no writes, no LLM
 *   pnpm generate-pending --max-jobs 5         # bound the LLM spend of one run
 *   pnpm generate-pending --stub-llm           # full loop, stub configs, €0 (infra test)
 *
 * Sequential on purpose: the job claim is an optimistic CAS sized for worker
 * concurrency 1-2 (see @revivo/db jobs.ts) — at this scale parallelism is a
 * liability, not a win. Retries are NOT in-run: a failed attempt schedules
 * jobs.next_retry_at (5 min backoff, doubling) and a LATER run picks it up.
 */
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import dotenv from "dotenv";
import {
  createServiceClient,
  enqueueJobIfNone,
  claimNextPendingJob,
  listJobsByStatus,
  listLeadsByStatus,
  MAX_JOB_ATTEMPTS,
} from "@revivo/db";
import { runGenerateMockupJob } from "@revivo/llm";

// repo-root .env, same convention as gen-mockup / crawl-marketplace
dotenv.config({ path: resolve(fileURLToPath(import.meta.url), "../../.env") });

const { values } = parseArgs({
  options: {
    "max-jobs": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "stub-llm": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

function usage(exitCode: number): never {
  console.log(
    `Usage: pnpm generate-pending [options]

  --max-jobs <n>   Max jobs to run this invocation (default 20 ≈ €0.80 LLM spend).
  --dry-run        Report pending leads + due jobs, write nothing, call no LLM.
  --stub-llm       Run the full loop with deterministic stub configs (no LLM cost).
                   Stubs land at the real slugs but leads STAY 'pending', so the
                   next real run regenerates them in place. Post-deploy infra test.`,
  );
  process.exit(exitCode);
}

if (values.help) usage(0);

/** Fail CLOSED on a typo'd number — a NaN would otherwise unbound the LLM spend. */
function requirePositiveInt(raw: string | undefined, flag: string, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`${flag} must be a positive integer, got "${raw}"\n`);
    usage(1);
  }
  return n;
}

const maxJobs = requirePositiveInt(values["max-jobs"], "--max-jobs", 20);
const dryRun = values["dry-run"]!;
const stubLlm = values["stub-llm"]!;

// Cost estimate only — the default model (Sonnet via OpenRouter) is ~$3/M input,
// ~$15/M output tokens; EUR conversion is approximate. Update if the model moves.
const EST_USD_PER_M_INPUT = 3;
const EST_USD_PER_M_OUTPUT = 15;
const USD_TO_EUR = 0.93;

const client = createServiceClient();

// ── Phase 1 · enqueue: every pending lead with a listing gets exactly one live job
const pending = await listLeadsByStatus(client, "pending", 500);
const eligible = pending.filter((l) => l.listing_url);
const withoutListing = pending.length - eligible.length;

if (dryRun) {
  const pendingJobs = await listJobsByStatus(client, "pending", 500);
  const now = Date.now();
  const due = pendingJobs.filter((j) => !j.next_retry_at || Date.parse(j.next_retry_at) <= now);
  console.log(`[dry-run] ${eligible.length} pending lead(s) with a listing URL:`);
  for (const lead of eligible) console.log(`  · ${lead.name ?? lead.listing_url} (${lead.city ?? "?"})`);
  if (withoutListing) console.log(`  (${withoutListing} pending lead(s) without listing_url — skipped)`);
  console.log(
    `[dry-run] ${due.length} due job(s) of ${pendingJobs.length} pending — a real run would process up to ${maxJobs}.`,
  );
  process.exit(0);
}

let enqueued = 0;
for (const lead of eligible) {
  const r = await enqueueJobIfNone(client, lead.id);
  if (r.enqueued) enqueued++;
}
console.log(
  `${eligible.length} pending lead(s) → ${enqueued} new job(s) enqueued` +
    (withoutListing ? ` (${withoutListing} without listing_url skipped)` : ""),
);
if (stubLlm) {
  console.log(`⚠ stub-llm: pusht STUB-configs op echte slugs; leads blijven 'pending' — een echte run regenereert ze.`);
}

// ── Phase 2 · drain due jobs, sequentially, bounded by --max-jobs
let ok = 0;
let review = 0;
let skipped = 0;
let retry = 0;
let failed = 0;
let totalIn = 0;
let totalOut = 0;
let scriptErrors = 0;

/** Degraded gate coverage must reach the operator, not just the gate verdict —
 * "report, never gate" means the ✓ line says when a check didn't run. */
function gateNotes(gates: {
  aboutFidelitySkipped?: string;
  scrapeFidelity?: { verdict: string };
  photoCuration?: { status: string; reason?: string };
}): string {
  const notes: string[] = [];
  if (!stubLlm && gates.aboutFidelitySkipped) notes.push(`about-check overgeslagen: ${gates.aboutFidelitySkipped}`);
  if (gates.scrapeFidelity?.verdict === "uncheckable") notes.push("scrape-cross-check niet mogelijk");
  if (!stubLlm && gates.photoCuration?.status === "failed") {
    notes.push(`foto-curatie mislukt (listingvolgorde gebruikt): ${gates.photoCuration.reason ?? "?"}`);
  }
  return notes.length ? ` (let op: ${notes.join("; ")})` : "";
}

for (let i = 0; i < maxJobs; i++) {
  const job = await claimNextPendingJob(client);
  if (!job) break;

  try {
    const outcome = await runGenerateMockupJob(client, job, { dryRun: stubLlm });
    const name = outcome.lead?.name ?? outcome.lead?.listing_url ?? job.lead_id;

    if (outcome.status === "succeeded") {
      totalIn += outcome.result.usage?.inputTokens ?? 0;
      totalOut += outcome.result.usage?.outputTokens ?? 0;
      const notes = gateNotes(outcome.result.gates);
      if (outcome.leadStatus === "needs_review") {
        review++;
        console.log(`  ⚠ ${name} → ${outcome.mockup.slug} NEEDS REVIEW — ${outcome.result.gates.reasons.join(" · ")}`);
      } else if (outcome.leadStatus === "pending") {
        ok++;
        console.log(`  ✓ ${name} → ${outcome.mockup.slug} [stub — lead blijft pending]${notes}`);
      } else {
        ok++;
        console.log(`  ✓ ${name} → ${outcome.mockup.slug} [${outcome.result.model}]${notes}`);
      }
    } else if (outcome.status === "skipped") {
      skipped++;
      console.log(`  – ${name}: ${outcome.reason}`);
    } else {
      totalIn += outcome.usage?.inputTokens ?? 0;
      totalOut += outcome.usage?.outputTokens ?? 0;
      if (outcome.status === "retry_scheduled") {
        retry++;
        console.log(
          `  ↻ ${name}: poging ${outcome.job.attempt_count}/${MAX_JOB_ATTEMPTS} mislukt — ${outcome.error} (retry na ${outcome.job.next_retry_at})`,
        );
      } else {
        failed++;
        console.log(`  ✗ ${name}: definitief mislukt na ${outcome.job.attempt_count} pogingen — ${outcome.error}`);
      }
    }
    scriptErrors = 0;
  } catch (err) {
    // runGenerateMockupJob handles job-level failure itself; reaching here means
    // the DB plumbing failed. Don't grind through a dead connection.
    scriptErrors++;
    console.error(`  ✗ job ${job.id}: ${(err as Error).message}`);
    if (scriptErrors >= 3) {
      console.error("3 opeenvolgende infrastructuurfouten — run afgebroken.");
      break;
    }
  }
}

const processed = ok + review + skipped + retry + failed;
const estEur = ((totalIn * EST_USD_PER_M_INPUT + totalOut * EST_USD_PER_M_OUTPUT) / 1e6) * USD_TO_EUR;
console.log(
  `\n${processed} job(s) verwerkt: ${ok} ok, ${review} needs_review, ${skipped} overgeslagen, ${retry} retry gepland, ${failed} definitief mislukt.` +
    (totalIn || totalOut ? `\n${totalIn} in / ${totalOut} out tokens ≈ €${estEur.toFixed(2)} (schatting; excl. mislukte calls zonder usage)` : ""),
);
