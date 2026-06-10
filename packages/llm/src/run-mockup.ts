import { SiteConfigSchema, type ListingFacts, type SalonBrief, type SiteConfig } from "@revivo/shared";
import {
  assembleBriefFromFixture,
  assembleBriefFromPlaces,
  crossCheckListing,
  fetchTreatwellFacts,
  listingFactsToBrief,
  type FidelityReport,
  type InstagramHints,
  type PlaceToBriefOverrides,
  type RawListing,
} from "@revivo/sourcing";
import { createLLMClient, type LLMClient } from "./client";
import { generateMockup, applyListingFacts } from "./mockup-generator";
import { checkAboutFidelity, type AboutFidelityReport } from "./check-about";
import {
  classifyListingPhotos,
  curatePhotoSlots,
  type PhotoCuration,
  type PhotoKind,
} from "./curate-photos";
import { stubMockup } from "./dry-run";

/**
 * The reusable generation core (roadmap B3). `bin/gen-mockup.ts` and the batch
 * worker (`run-mockup-job.ts`, later the C1 cron) all run THIS path — there is
 * deliberately no second code path for batch.
 *
 *   resolveListingBrief      listing URL (+ optional Google enrichment) → brief + facts
 *   runMockupPipeline        brief (+ facts) → validated SiteConfig + gate reports
 *   generateMockupForListing the two composed — what the batch worker calls
 *
 * The fidelity checks are SOFT gates: this module returns structured reports
 * and a verdict ("ok" | "needs_review") and never prints or blocks — the CLI
 * formats them for the operator, the worker turns "needs_review" into a parked
 * lead. Library code: no @revivo/db, no process.exit, no console.
 */

export interface ListingBriefInput {
  /** Treatwell salon URL or slug (anything `normalizeTreatwellUrl` accepts). */
  listingUrl: string;
  /** Optionally combine with a places mode to borrow Google's postcode +
   * coordinates (Treatwell has no postcode); the listing facts win on
   * everything they cover. */
  places?: {
    placeId?: string;
    query?: string;
    /** Use the offline fixture Place instead of the live Google API. */
    useFixture?: boolean;
    instagram?: InstagramHints;
  };
  overrides?: PlaceToBriefOverrides;
}

export interface ResolvedListing {
  brief: SalonBrief;
  facts: ListingFacts;
  raw: RawListing;
  /** Set when combined with a places mode. */
  placeId?: string;
}

/** Fetch + parse the salon's real listing and turn it into the generation brief.
 * Extracted verbatim from the CLI's Treatwell branch. */
export async function resolveListingBrief(input: ListingBriefInput): Promise<ResolvedListing> {
  const { raw, facts } = await fetchTreatwellFacts(input.listingUrl);
  const overrides = input.overrides ?? {};

  if (input.places) {
    const assembled = input.places.useFixture
      ? await assembleBriefFromFixture({ instagram: input.places.instagram, overrides })
      : await assembleBriefFromPlaces({
          placeId: input.places.placeId,
          query: input.places.query,
          instagram: input.places.instagram,
          overrides,
        });
    const brief: SalonBrief = { ...assembled.brief };
    if (facts.name) brief.name = facts.name;
    if (facts.address) brief.address = facts.address;
    if (facts.lat !== undefined) brief.lat = facts.lat;
    if (facts.lng !== undefined) brief.lng = facts.lng;
    if (facts.reputation) {
      brief.rating = facts.reputation.rating;
      brief.reviewCount = facts.reputation.reviewCount;
    }
    return { brief, facts, raw, placeId: assembled.place.placeId };
  }

  return { brief: listingFactsToBrief(facts, overrides), facts, raw };
}

/** Outcome of the photo-curation step. NEVER gates the verdict — a failed
 * classification degrades to listing-order photos (degraded coverage, not
 * disagreement), exactly like an errored about-check. */
export interface PhotoCurationGate {
  status: "applied" | "skipped" | "failed";
  /** Why it didn't run / failed (dry run, no listing photos, model error). */
  reason?: string;
  model?: string;
  /** Post-dedupe kind counts — the operator-facing one-line summary. */
  counts?: Partial<Record<PhotoKind, number>>;
  droppedDuplicates?: number;
}

export interface MockupGates {
  /** Deterministic state↔JSON-LD scalar cross-check (sourcing's `crossCheckListing`).
   * Undefined when there is no raw listing to check (manual/places modes). */
  scrapeFidelity?: FidelityReport;
  /** LLM about-prose fabrication check. Null when it didn't run — see
   * `aboutFidelitySkipped` for why. */
  aboutFidelity: AboutFidelityReport | null;
  /** Why `aboutFidelity` is null (dry-run, no real description, or the check errored). */
  aboutFidelitySkipped?: string;
  /** Vision photo classification + deterministic slotting (report only). */
  photoCuration: PhotoCurationGate;
  verdict: "ok" | "needs_review";
  /** Human-readable, operator-facing reasons behind a "needs_review" verdict. */
  reasons: string[];
}

/** Pure gate aggregation — which findings park a lead for the operator.
 * A scrape MISMATCH (the state parse is suspect → the facts may be wrong) and a
 * confirmed about-prose FABRICATION are hard disagreements. An "uncheckable"
 * cross-check or an errored about-check is degraded coverage, not disagreement —
 * reported, never gating (warn-don't-block parity with the CLI's history). */
export function aggregateGates(
  scrapeFidelity: FidelityReport | undefined,
  aboutFidelity: AboutFidelityReport | null,
): Pick<MockupGates, "verdict" | "reasons"> {
  const reasons: string[] = [];
  if (scrapeFidelity?.verdict === "mismatch") {
    reasons.push(`scrape-fidelity mismatch: ${scrapeFidelity.summary}`);
  }
  if (aboutFidelity?.verdict === "fabrication") {
    const quotes = aboutFidelity.claims
      .slice(0, 2)
      .map((c) => `"${c.quote}"`)
      .join(", ");
    reasons.push(
      `about-tekst: ${aboutFidelity.claims.length} mogelijk verzonnen claim(s)${quotes ? ` — ${quotes}` : ""}`,
    );
  }
  return { verdict: reasons.length ? "needs_review" : "ok", reasons };
}

export interface RunMockupInput {
  brief: SalonBrief;
  /** Real listing facts — applied deterministically over the model's output. */
  facts?: ListingFacts;
  /** Raw scraped blobs — enables the deterministic scrape-fidelity cross-check. */
  raw?: RawListing;
  /** Deterministic stub config, no LLM call, no cost. */
  dryRun?: boolean;
  /** Injected for tests; defaults to the env-configured client (also reused for
   * the about-fidelity check, so a test double covers the whole run). */
  client?: LLMClient;
  /** Injected for tests; defaults to the env-configured VISION_LLM_MODEL client
   * (a separate, cheaper multimodal model — see curate-photos.ts). */
  visionClient?: LLMClient;
}

export interface MockupRun {
  config: SiteConfig;
  /** Model slug, or "dry-run-stub". */
  model: string;
  /** LLM attempts used (0 on a dry run). */
  attempts: number;
  usage?: { inputTokens: number; outputTokens: number };
  gates: MockupGates;
}

/** brief (+ facts) → validated SiteConfig + gate reports. The single generation
 * path behind every mode: CLI manual/places/treatwell AND the batch worker. */
export async function runMockupPipeline(input: RunMockupInput): Promise<MockupRun> {
  const { brief, facts, raw, dryRun } = input;

  // Deterministic, free — run it first so a broken scrape is in the report
  // regardless of what the model does afterwards.
  const scrapeFidelity = raw && facts ? crossCheckListing(raw, facts) : undefined;

  let config: SiteConfig;
  let model = "dry-run-stub";
  let attempts = 0;
  let usage: MockupRun["usage"];

  // Photo curation BEFORE generation: the labels feed the caption grounding in
  // the generate prompt AND the deterministic slotting afterwards. Soft by
  // construction — any failure leaves `curation` undefined and the photos in
  // listing order (measured why that's not good enough: 3% work shots, avg 2.2
  // of 4 hero slots usable; see curate-photos.ts).
  let curation: PhotoCuration | undefined;
  let photoCuration: PhotoCurationGate;
  if (dryRun) {
    photoCuration = { status: "skipped", reason: "dry run (geen LLM)" };
  } else if (!facts?.photos?.length) {
    photoCuration = { status: "skipped", reason: "geen listingfoto's" };
  } else {
    try {
      const cls = await classifyListingPhotos({ photos: facts.photos, client: input.visionClient });
      const slots = curatePhotoSlots(facts.photos, cls.labels);
      curation = { labels: cls.labels, slots, model: cls.model, usage: cls.usage };
      photoCuration = {
        status: "applied",
        model: cls.model,
        counts: slots.counts,
        droppedDuplicates: slots.droppedDuplicates,
      };
      // The vision call is real spend — count it, or the estimate lies.
      if (cls.usage) {
        usage = {
          inputTokens: (usage?.inputTokens ?? 0) + cls.usage.inputTokens,
          outputTokens: (usage?.outputTokens ?? 0) + cls.usage.outputTokens,
        };
      }
    } catch (err) {
      photoCuration = { status: "failed", reason: (err as Error).message };
    }
  }

  if (dryRun) {
    config = stubMockup(brief);
    // Apply the real facts even to the stub, so a dry run with a listing is a
    // zero-cost offline preview of the deterministic passthrough.
    if (facts) config = SiteConfigSchema.parse(applyListingFacts(config, facts));
  } else {
    const client = input.client ?? createLLMClient();
    let result;
    try {
      result = await generateMockup(brief, client, facts, curation);
    } catch (err) {
      // The deterministic cross-check already ran; a MISMATCH diagnosis must not
      // vanish just because generation then failed — ride it on the error so the
      // caller (CLI catch, worker failJob) can still report it.
      if (scrapeFidelity) {
        (err as Error & { scrapeFidelity?: FidelityReport }).scrapeFidelity = scrapeFidelity;
      }
      throw err;
    }
    config = result.config;
    model = client.model;
    attempts = result.attempts;
    // Sum onto the vision spend already accumulated above, don't overwrite it.
    if (result.usage) {
      usage = {
        inputTokens: (usage?.inputTokens ?? 0) + result.usage.inputTokens,
        outputTokens: (usage?.outputTokens ?? 0) + result.usage.outputTokens,
      };
    }
  }

  // About-fidelity guard. Facts are deterministic, but the LLM-authored prose can
  // still invent a concrete claim (a music genre, an award, a year). Skipping is
  // reported, never silent; an errored check degrades to "skipped", not a verdict.
  let aboutFidelity: AboutFidelityReport | null = null;
  let aboutFidelitySkipped: string | undefined;
  if (dryRun) {
    aboutFidelitySkipped = "dry run (geen LLM)";
  } else if (!facts?.description) {
    aboutFidelitySkipped = "geen echte salon-omschrijving om tegen te checken";
  } else {
    try {
      aboutFidelity = await checkAboutFidelity({ config, facts, client: input.client });
      // The check is a second LLM call — count it, or the spend estimate lies.
      if (aboutFidelity.usage) {
        usage = {
          inputTokens: (usage?.inputTokens ?? 0) + aboutFidelity.usage.inputTokens,
          outputTokens: (usage?.outputTokens ?? 0) + aboutFidelity.usage.outputTokens,
        };
      }
    } catch (err) {
      aboutFidelitySkipped = `check mislukt: ${(err as Error).message}`;
    }
  }

  const gates: MockupGates = {
    scrapeFidelity,
    aboutFidelity,
    aboutFidelitySkipped,
    photoCuration,
    ...aggregateGates(scrapeFidelity, aboutFidelity),
  };

  return { config, model, attempts, usage, gates };
}

export interface ListingMockupInput extends ListingBriefInput {
  dryRun?: boolean;
  client?: LLMClient;
  visionClient?: LLMClient;
}

export interface ListingMockupResult extends MockupRun {
  brief: SalonBrief;
  facts: ListingFacts;
  raw: RawListing;
  placeId?: string;
}

/** Listing URL in, gated mockup out — the batch worker's (and C1 cron's) entry point. */
export async function generateMockupForListing(input: ListingMockupInput): Promise<ListingMockupResult> {
  const resolved = await resolveListingBrief(input);
  const run = await runMockupPipeline({
    brief: resolved.brief,
    facts: resolved.facts,
    raw: resolved.raw,
    dryRun: input.dryRun,
    client: input.client,
    visionClient: input.visionClient,
  });
  return { ...run, ...resolved };
}
