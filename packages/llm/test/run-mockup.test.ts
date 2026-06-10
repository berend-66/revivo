import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListingFactsSchema, SalonBriefSchema, type ListingFacts, type SalonBrief } from "@revivo/shared";
import type { FidelityReport } from "@revivo/sourcing";
import type { CompleteOptions, CompleteResult, LLMClient } from "../src/client";
import { stubMockup } from "../src/dry-run";
import {
  aggregateGates,
  resolveListingBrief,
  runMockupPipeline,
} from "../src/run-mockup";
import { decideLeadDisposition, pickMockupSlug } from "../src/run-mockup-job";

// The photo-curation step defaults to createVisionClient() (env-configured).
// Scrub any key inherited from the dev shell so a unit test that forgets to
// inject a vision double degrades (caught, reported) instead of escalating
// into a real network call.
delete process.env.LLM_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;

/**
 * B3 regression anchor: the extracted generation core (`runMockupPipeline` /
 * `resolveListingBrief`) and the worker's pure decision helpers. Everything the
 * CLI and the batch worker share runs through here — offline, no keys, no cost.
 */

// ── fixtures ────────────────────────────────────────────────────────────────

/** Queue-based LLM test double: each complete() call consumes the next queued
 * response, regardless of prompt wording — order is generate first, then the
 * about-fidelity check. Records every call's options for prompt assertions. */
function fakeClient(
  responses: Array<string | object>,
): LLMClient & { calls: number; prompts: CompleteOptions[] } {
  const queue = [...responses];
  const client = {
    provider: "fake",
    model: "fake-model",
    calls: 0,
    prompts: [] as CompleteOptions[],
    async complete(opts: CompleteOptions): Promise<CompleteResult> {
      client.calls++;
      client.prompts.push(opts);
      const next = queue.shift();
      if (next === undefined) throw new Error("fakeClient: no response queued for this call");
      return {
        text: typeof next === "string" ? next : JSON.stringify(next),
        usage: { inputTokens: 100, outputTokens: 200 },
      };
    },
  };
  return client;
}

const BRIEF: SalonBrief = SalonBriefSchema.parse({
  name: "Test Salon",
  city: "Utrecht",
  type: "hair",
  language: "nl",
});

// Parsed through the real schema so the fixture can't drift from the contract.
const FACTS: ListingFacts = ListingFactsSchema.parse({
  sourceUrl: "https://www.treatwell.nl/salon/test-salon/",
  name: "Test Salon",
  description: "Knippen en kleuren in het centrum van Utrecht, met een klein vast team.",
  phone: "+31612345678",
  address: "Teststraat 1",
  city: "Utrecht",
  lat: 52.09,
  lng: 5.12,
  bookingUrl: "https://www.treatwell.nl/salon/test-salon/",
  services: [{ category: "Knippen", items: [{ name: "Knippen dames", price: 42 }] }],
  hours: [
    { day: "Maandag", closed: true },
    { day: "Dinsdag", open: "10:00", close: "18:00" },
    { day: "Woensdag", open: "10:00", close: "18:00" },
    { day: "Donderdag", open: "10:00", close: "20:00" },
    { day: "Vrijdag", open: "10:00", close: "18:00" },
    { day: "Zaterdag", open: "09:00", close: "17:00" },
    { day: "Zondag", closed: true },
  ],
  team: [{ name: "Anna" }, { name: "Berat" }],
  reputation: { rating: 4.8, reviewCount: 120, source: "Treatwell" },
  reviews: [{ author: "Eva", quote: "Heel blij mee!", rating: 5 }],
  photos: ["https://images.example.com/1.jpg", "https://images.example.com/2.jpg"],
});

const CLEAN_ABOUT = { claims: [], verdict: "clean" };

// ── runMockupPipeline ───────────────────────────────────────────────────────

describe("runMockupPipeline", () => {
  it("dry run + facts: stub config with the real facts applied, no LLM, gate ok", async () => {
    // No client passed: the dry-run path must never construct one (this test
    // runs without any LLM_API_KEY in the environment).
    const run = await runMockupPipeline({ brief: BRIEF, facts: FACTS, dryRun: true });

    expect(run.model).toBe("dry-run-stub");
    expect(run.attempts).toBe(0);
    expect(run.config.services).toEqual(FACTS.services);
    expect(run.config.hours).toEqual(FACTS.hours);
    expect(run.config.team).toEqual(FACTS.team);
    expect(run.config.reputation).toEqual(FACTS.reputation);
    expect(run.config.testimonials).toEqual(FACTS.reviews);
    expect(run.config.contact.phone).toBe(FACTS.phone);
    expect(run.config.hero.images[0]).toBe(FACTS.photos![0]);
    expect(run.gates.verdict).toBe("ok");
    expect(run.gates.aboutFidelity).toBeNull();
    expect(run.gates.aboutFidelitySkipped).toContain("dry run");
    expect(run.gates.scrapeFidelity).toBeUndefined();
  });

  it("LLM path: model output validated, facts overwrite it, about check clean", async () => {
    // The fake model "invents" a config (the stub doubles as valid model
    // output); the deterministic passthrough must overwrite its facts.
    const client = fakeClient([stubMockup(BRIEF), CLEAN_ABOUT]);
    const run = await runMockupPipeline({ brief: BRIEF, facts: FACTS, client });

    expect(client.calls).toBe(2); // generate + about-fidelity
    expect(run.model).toBe("fake-model");
    expect(run.attempts).toBe(1);
    // Both LLM calls count — the about-check is real spend too.
    expect(run.usage).toEqual({ inputTokens: 200, outputTokens: 400 });
    expect(run.config.services).toEqual(FACTS.services);
    expect(run.config.reputation).toEqual(FACTS.reputation);
    expect(run.gates.aboutFidelity?.verdict).toBe("clean");
    expect(run.gates.verdict).toBe("ok");
  });

  it("fabrication finding → verdict needs_review with the claim quoted", async () => {
    const client = fakeClient([
      stubMockup(BRIEF),
      { claims: [{ quote: "al sinds 1998", issue: "jaartal staat niet in de bron" }], verdict: "fabrication" },
    ]);
    const run = await runMockupPipeline({ brief: BRIEF, facts: FACTS, client });

    expect(run.gates.aboutFidelity?.verdict).toBe("fabrication");
    expect(run.gates.verdict).toBe("needs_review");
    expect(run.gates.reasons.join(" ")).toContain("al sinds 1998");
  });

  it("about check erroring degrades to skipped — never a verdict", async () => {
    const client = fakeClient([stubMockup(BRIEF), "this is not json at all"]);
    const run = await runMockupPipeline({ brief: BRIEF, facts: FACTS, client });

    expect(run.gates.aboutFidelity).toBeNull();
    expect(run.gates.aboutFidelitySkipped).toContain("check mislukt");
    expect(run.gates.verdict).toBe("ok");
  });

  it("no facts (manual/places mode): no passthrough, about check skipped", async () => {
    const client = fakeClient([stubMockup(BRIEF)]);
    const run = await runMockupPipeline({ brief: BRIEF, client });

    expect(client.calls).toBe(1);
    expect(run.gates.aboutFidelitySkipped).toContain("geen echte salon-omschrijving");
    expect(run.gates.verdict).toBe("ok");
  });

  it("a schema retry's tokens are counted, not just the last attempt's", async () => {
    const client = fakeClient(["not json {{", stubMockup(BRIEF), CLEAN_ABOUT]);
    const run = await runMockupPipeline({ brief: BRIEF, facts: FACTS, client });

    expect(run.attempts).toBe(2);
    // 2 generate calls + 1 about call, each 100/200.
    expect(run.usage).toEqual({ inputTokens: 300, outputTokens: 600 });
  });

  // FACTS has two photos; this labelling makes the slotting observable (the
  // product shot leads on the listing, the striking interior must win).
  const LABELS_PRODUCT_INTERIOR = {
    photos: [
      { n: 1, kind: "product", heroScore: 0, note: "flessen op plank" },
      { n: 2, kind: "interior", heroScore: 2, note: "stoelen en spiegels" },
    ],
  };

  it("photo curation: vision labels reorder the slots, spend counted, gate reports the mix", async () => {
    const client = fakeClient([stubMockup(BRIEF), CLEAN_ABOUT]);
    const visionClient = fakeClient([LABELS_PRODUCT_INTERIOR]);
    const run = await runMockupPipeline({ brief: BRIEF, facts: FACTS, client, visionClient });

    // The product shot may not lead: hero = the striking interior only.
    expect(run.config.hero.images).toEqual([FACTS.photos![1]]);
    // Gallery: interior first (ranked), product only as padding; portrait =
    // the only photo outside the hero.
    expect(run.config.gallery.map((g) => g.url)).toEqual([FACTS.photos![1], FACTS.photos![0]]);
    expect(run.config.about.portrait).toBe(FACTS.photos![0]);
    expect(run.gates.photoCuration).toMatchObject({
      status: "applied",
      model: "fake-model",
      counts: { product: 1, interior: 1 },
      droppedDuplicates: 0,
    });
    // vision + generate + about, each 100/200.
    expect(run.usage).toEqual({ inputTokens: 300, outputTokens: 600 });
    // One multimodal call: every photo, listing order, low detail.
    expect(visionClient.prompts[0]?.images?.map((i) => i.url)).toEqual(FACTS.photos);
    expect(visionClient.prompts[0]?.images?.every((i) => i.detail === "low")).toBe(true);
  });

  it("photo curation: the generate prompt grounds gallery captions in slot order", async () => {
    const client = fakeClient([stubMockup(BRIEF), CLEAN_ABOUT]);
    const visionClient = fakeClient([LABELS_PRODUCT_INTERIOR]);
    await runMockupPipeline({ brief: BRIEF, facts: FACTS, client, visionClient });

    const generateUser = client.prompts[0]!.user;
    expect(generateUser).toContain("PRECIES deze 2 echte salonfoto's");
    expect(generateUser).toContain("1. interieur — stoelen en spiegels");
    expect(generateUser).toContain("2. producten — flessen op plank");
    // Live catch: the model captioned a staff portrait with a REAL team
    // member's name ("Paolo, ...") — but who is in a photo is unverifiable.
    expect(generateUser).toContain("GEEN namen van personen");
  });

  it("photo curation: a single-unique-photo salon gets NO caption grounding and a valid gallery", async () => {
    // Review-fleet repro: a 1-item curated gallery (2 photos, one a vision-
    // flagged duplicate) must not make the grounding demand "Geef exact 1
    // gallery-items" — an obedient model would fail the schema's gallery.min(2)
    // and the whole generation would hard-fail instead of degrading.
    const client = fakeClient([stubMockup(BRIEF), CLEAN_ABOUT]);
    const visionClient = fakeClient([
      {
        photos: [
          { n: 1, kind: "interior", heroScore: 1 },
          { n: 2, kind: "interior", heroScore: 1, duplicateOf: 1 },
        ],
      },
    ]);
    const run = await runMockupPipeline({ brief: BRIEF, facts: FACTS, client, visionClient });

    expect(client.prompts[0]!.user).not.toContain("Geef exact");
    expect(client.prompts[0]!.user).not.toContain("PRECIES");
    // Hero/portrait still curated (the unique photo); gallery falls back to
    // listing order, which honours the schema min.
    expect(run.config.hero.images).toEqual([FACTS.photos![0]]);
    expect(run.config.gallery.map((g) => g.url)).toEqual(FACTS.photos);
    expect(run.gates.photoCuration).toMatchObject({ status: "applied", droppedDuplicates: 1 });
  });

  it("photo curation: a failing vision call degrades to listing order — reported, never gating", async () => {
    const client = fakeClient([stubMockup(BRIEF), CLEAN_ABOUT]);
    const visionClient: LLMClient = {
      provider: "fake",
      model: "fake-vision",
      async complete() {
        throw new Error("vision 503");
      },
    };
    const run = await runMockupPipeline({ brief: BRIEF, facts: FACTS, client, visionClient });

    expect(run.gates.photoCuration.status).toBe("failed");
    expect(run.gates.photoCuration.reason).toContain("503");
    expect(run.gates.verdict).toBe("ok");
    // Old behaviour stands: photos slot in listing order.
    expect(run.config.hero.images[0]).toBe(FACTS.photos![0]);
    expect(run.usage).toEqual({ inputTokens: 200, outputTokens: 400 });
  });

  it("photo curation: dry run skips it (no LLM) and says so", async () => {
    const run = await runMockupPipeline({ brief: BRIEF, facts: FACTS, dryRun: true });
    expect(run.gates.photoCuration).toEqual({ status: "skipped", reason: "dry run (geen LLM)" });
  });

  it("photo curation: no listing photos → skipped with the reason", async () => {
    const client = fakeClient([stubMockup(BRIEF)]);
    const run = await runMockupPipeline({ brief: BRIEF, client });
    expect(run.gates.photoCuration).toEqual({ status: "skipped", reason: "geen listingfoto's" });
  });

  it("a generation failure carries the precomputed scrape-fidelity report on the error", async () => {
    const throwing: LLMClient = {
      provider: "fake",
      model: "fake-model",
      async complete() {
        throw new Error("401 unauthorized");
      },
    };
    const raw = { sourceUrl: FACTS.sourceUrl, state: null, jsonLd: [], html: "" };
    const err = await runMockupPipeline({ brief: BRIEF, facts: FACTS, raw, client: throwing }).then(
      () => null,
      (e) => e as Error & { scrapeFidelity?: FidelityReport },
    );

    expect(err?.message).toContain("401");
    // The deterministic cross-check ran before the LLM call; its report must
    // not vanish because generation failed.
    expect(err?.scrapeFidelity?.verdict).toBe("uncheckable");
  });
});

// ── aggregateGates (pure) ───────────────────────────────────────────────────

function fidelity(verdict: FidelityReport["verdict"]): FidelityReport {
  return {
    sourceUrl: "https://www.treatwell.nl/salon/test-salon/",
    crossCheckable: verdict !== "uncheckable",
    verdict,
    checks: [],
    mismatches: [],
    summary: `synthetic ${verdict}`,
  };
}

describe("aggregateGates", () => {
  it("scrape mismatch parks the lead", () => {
    const g = aggregateGates(fidelity("mismatch"), null);
    expect(g.verdict).toBe("needs_review");
    expect(g.reasons[0]).toContain("scrape-fidelity");
  });

  it("uncheckable is degraded coverage, not disagreement", () => {
    expect(aggregateGates(fidelity("uncheckable"), null).verdict).toBe("ok");
  });

  it("pass + clean → ok, both findings stack", () => {
    expect(aggregateGates(fidelity("pass"), { verdict: "clean", claims: [], model: "m" }).verdict).toBe("ok");
    const g = aggregateGates(fidelity("mismatch"), {
      verdict: "fabrication",
      claims: [{ quote: "x", issue: "y" }],
      model: "m",
    });
    expect(g.reasons).toHaveLength(2);
  });
});

// ── worker decision helpers (pure) ──────────────────────────────────────────

describe("decideLeadDisposition", () => {
  it("needs_review verdict → parked with joined reasons", () => {
    const d = decideLeadDisposition({
      aboutFidelity: null,
      photoCuration: { status: "skipped" },
      verdict: "needs_review",
      reasons: ["a", "b"],
    });
    expect(d).toEqual({ status: "needs_review", reviewReason: "a · b" });
  });

  it("ok verdict → mockup_generated and the stale review_reason cleared", () => {
    const d = decideLeadDisposition({
      aboutFidelity: null,
      photoCuration: { status: "skipped" },
      verdict: "ok",
      reasons: [],
    });
    expect(d).toEqual({ status: "mockup_generated", reviewReason: null });
  });
});

describe("pickMockupSlug", () => {
  const lookup =
    (rows: Record<string, string | null>) =>
    async (slug: string): Promise<{ lead_id: string | null } | null> =>
      slug in rows ? { lead_id: rows[slug]! } : null;

  it("free slug is used as-is", async () => {
    expect(await pickMockupSlug({ desired: "salon-x", leadId: "L1", city: "Utrecht", lookup: lookup({}) })).toBe(
      "salon-x",
    );
  });

  it("a slug already owned by this lead is reused (re-run overwrites in place)", async () => {
    expect(
      await pickMockupSlug({ desired: "salon-x", leadId: "L1", city: "Utrecht", lookup: lookup({ "salon-x": "L1" }) }),
    ).toBe("salon-x");
  });

  it("another lead's slug is never overwritten — city disambiguates", async () => {
    expect(
      await pickMockupSlug({ desired: "salon-x", leadId: "L2", city: "Utrecht", lookup: lookup({ "salon-x": "L1" }) }),
    ).toBe("salon-x-utrecht");
  });

  it("a hand-made mockup (lead_id null) is protected too, numeric suffix as last resort", async () => {
    expect(
      await pickMockupSlug({
        desired: "salon-x",
        leadId: "L2",
        city: "Utrecht",
        lookup: lookup({ "salon-x": null, "salon-x-utrecht": "L9" }),
      }),
    ).toBe("salon-x-utrecht-2");
  });

  it("city already in the slug is not appended twice", async () => {
    expect(
      await pickMockupSlug({
        desired: "salon-utrecht",
        leadId: "L2",
        city: "Utrecht",
        lookup: lookup({ "salon-utrecht": "L1" }),
      }),
    ).toBe("salon-utrecht-2");
  });

  it("city containment respects slug boundaries — 'oss' in 'glossy' is not the city", async () => {
    expect(
      await pickMockupSlug({
        desired: "glossy-beauty",
        leadId: "L2",
        city: "Oss",
        lookup: lookup({ "glossy-beauty": "L1" }),
      }),
    ).toBe("glossy-beauty-oss");
  });
});

// ── resolveListingBrief (offline, against the committed real listing) ───────

const FIXTURE_HTML = readFileSync(
  fileURLToPath(new URL("../../sourcing/test/fixtures/treatwell/utrecht-hairstyle.html", import.meta.url)),
  "utf-8",
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveListingBrief", () => {
  it("pure listing mode: real facts + brief, offline via stubbed fetch", async () => {
    vi.stubGlobal("fetch", async () => new Response(FIXTURE_HTML, { status: 200 }));
    const resolved = await resolveListingBrief({
      listingUrl: "https://www.treatwell.nl/salon/utrecht-hairstyle/",
    });

    expect(resolved.brief.name).toBe(resolved.facts.name);
    expect(resolved.facts.services?.length).toBeGreaterThan(0);
    expect(resolved.raw.state).toBeTruthy();
    expect(resolved.placeId).toBeUndefined();
  });

  it("places combo: fixture Place enriches, listing facts win on what they cover", async () => {
    vi.stubGlobal("fetch", async () => new Response(FIXTURE_HTML, { status: 200 }));
    const resolved = await resolveListingBrief({
      listingUrl: "https://www.treatwell.nl/salon/utrecht-hairstyle/",
      places: { useFixture: true },
    });

    // Identity comes from the listing, not the (different) fixture Place.
    expect(resolved.brief.name).toBe(resolved.facts.name);
    expect(resolved.brief.rating).toBe(resolved.facts.reputation?.rating);
    expect(resolved.placeId).toBeTruthy();
  });
});
