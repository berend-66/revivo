/** One-off targeted regeneration after the generator hardening: re-run exactly
 * the leads that already have a mockup row (the 13 audited + Karinka's stub),
 * leaving the rest of the pending queue untouched for later bounded runs.
 * Uses the worker's own primitives — enqueue + CAS-claim by id + runGenerateMockupJob. */
import { createServiceClient, listLeadsByStatus, getMockupsByLeadId, enqueueJobIfNone, type JobRow } from "@revivo/db";
import { runGenerateMockupJob } from "@revivo/llm";

const c = createServiceClient();
const targets = [];
for (const lead of await listLeadsByStatus(c, "pending", 100)) {
  if ((await getMockupsByLeadId(c, lead.id)).length) targets.push(lead);
}
console.log(`${targets.length} leads with an existing mockup to regenerate\n`);

let ok = 0, review = 0, failed = 0, totalIn = 0, totalOut = 0;
for (const lead of targets) {
  const { job } = await enqueueJobIfNone(c, lead.id);
  if (!job) { console.log(`  ✗ ${lead.name}: no job`); failed++; continue; }
  // Targeted CAS claim (same shape as claimNextPendingJob, by id).
  const { data: claimed, error } = await c
    .from("jobs")
    .update({ status: "running", attempt_count: job.attempt_count + 1 })
    .eq("id", job.id).eq("status", "pending").eq("attempt_count", job.attempt_count)
    .select().maybeSingle();
  if (error || !claimed) { console.log(`  ✗ ${lead.name}: claim failed`); failed++; continue; }

  const outcome = await runGenerateMockupJob(c, claimed as JobRow);
  if (outcome.status === "succeeded") {
    totalIn += outcome.result.usage?.inputTokens ?? 0;
    totalOut += outcome.result.usage?.outputTokens ?? 0;
    if (outcome.leadStatus === "needs_review") {
      review++;
      console.log(`  ⚠ ${lead.name} → ${outcome.mockup.slug} NEEDS REVIEW — ${outcome.result.gates.reasons.join(" · ")}`);
    } else {
      ok++;
      console.log(`  ✓ ${lead.name} → ${outcome.mockup.slug}`);
    }
  } else {
    failed++;
    console.log(`  ✗ ${lead.name}: ${outcome.status}${"error" in outcome ? ` — ${outcome.error}` : ""}`);
  }
}
console.log(`\n${ok} ok, ${review} needs_review, ${failed} failed · ${totalIn} in / ${totalOut} out tokens`);
