import { describe, expect, it } from "vitest";
import { ListingFactsSchema, SalonBriefSchema } from "@revivo/shared";
import type { CompleteOptions, CompleteResult, LLMClient } from "../src/client";
import {
  classifyListingPhotos,
  curatePhotoSlots,
  type PhotoKind,
  type PhotoLabel,
} from "../src/curate-photos";
import { applyListingFacts } from "../src/mockup-generator";
import { stubMockup } from "../src/dry-run";

/**
 * Photo curation: the vision call only LABELS; these tests pin the RULES
 * (pure `curatePhotoSlots`) and the strict parse of the labelling
 * (`classifyListingPhotos`). Offline — no keys, no tokens. The measured
 * failure modes they encode: 0-scored junk leading the listing while the
 * good shots sit at the tail, product bottles in heroes, re-uploaded
 * duplicates, and partial/garbled model labellings.
 */

// Same posture as run-mockup.test.ts: never let a dev shell's key turn a
// missing test double into a real network call.
delete process.env.LLM_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;

const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://img.example/p${i}.jpg`);

const L = (
  index: number,
  kind: PhotoKind,
  heroScore: 0 | 1 | 2 = 1,
  extra: Partial<PhotoLabel> = {},
): PhotoLabel => ({ index, kind, heroScore, ...extra });

// ── curatePhotoSlots (pure rules) ───────────────────────────────────────────

describe("curatePhotoSlots", () => {
  it("hero: usable work first, then interiors by score — never product/exterior/menu", () => {
    const photos = urls(6);
    const labels = [
      L(0, "product", 2),
      L(1, "interior", 1),
      L(2, "work", 1),
      L(3, "exterior", 2),
      L(4, "menu", 1),
      L(5, "interior", 2),
    ];
    expect(curatePhotoSlots(photos, labels).hero).toEqual([photos[2], photos[5], photos[1]]);
  });

  it("listing order is overruled: 0-scored leading photos lose to strong shots at the tail", () => {
    // The measured Salon Dani case: hero slots 0-3 were junk, the best shots
    // sat at indices 8-9.
    const photos = urls(10);
    const labels = [
      L(0, "team", 1),
      L(1, "product", 0),
      L(2, "interior", 0),
      L(3, "interior", 0),
      L(4, "product", 0),
      L(5, "product", 0),
      L(6, "interior", 1),
      L(7, "product", 0),
      L(8, "interior", 2),
      L(9, "work", 2),
    ];
    expect(curatePhotoSlots(photos, labels).hero).toEqual([photos[9], photos[8], photos[6], photos[2]]);
  });

  it("a 0-scored work shot does not beat a striking interior", () => {
    const photos = urls(2);
    expect(curatePhotoSlots(photos, [L(0, "work", 0), L(1, "interior", 2)]).hero).toEqual([
      photos[1],
      photos[0],
    ]);
  });

  it("a library with neither work nor interior falls back to best-ranked anything", () => {
    const photos = urls(3);
    const labels = [L(0, "product", 0), L(1, "product", 2), L(2, "exterior", 1)];
    expect(curatePhotoSlots(photos, labels).hero).toEqual([photos[1], photos[2], photos[0]]);
  });

  it("vision-flagged duplicates are dropped everywhere and counted", () => {
    const photos = urls(4);
    const labels = [
      L(0, "interior", 2),
      L(1, "interior", 2, { duplicateOf: 0 }),
      L(2, "work", 1),
      L(3, "product", 1),
    ];
    const slots = curatePhotoSlots(photos, labels);
    expect(slots.droppedDuplicates).toBe(1);
    expect(slots.hero).toEqual([photos[2], photos[0]]);
    expect(slots.gallery.map((g) => g.url)).not.toContain(photos[1]);
    expect(slots.counts).toEqual({ interior: 1, work: 1, product: 1 });
  });

  it("gallery: work+interior+team ranked; products only pad below 4", () => {
    const photos = urls(6);
    const labels = [
      L(0, "interior", 1),
      L(1, "product", 2),
      L(2, "interior", 2),
      L(3, "product", 1),
      L(4, "product", 0),
      L(5, "team", 1),
    ];
    // 3 lead photos, padded with exactly one product (the best-ranked).
    expect(curatePhotoSlots(photos, labels).gallery.map((g) => g.url)).toEqual([
      photos[2],
      photos[0],
      photos[5],
      photos[1],
    ]);
  });

  it("gallery reaches the schema minimum via exterior/menu only as a last resort", () => {
    const photos = urls(2);
    const slots = curatePhotoSlots(photos, [L(0, "menu", 0), L(1, "interior", 1)]);
    expect(slots.gallery.map((g) => g.url)).toEqual([photos[1], photos[0]]);
  });

  it("portrait prefers a team shot, then an interior outside the hero", () => {
    const photos = urls(6);
    const withTeam = [
      L(0, "interior", 2),
      L(1, "team", 0),
      L(2, "work", 1),
      L(3, "interior", 1),
      L(4, "interior", 1),
      L(5, "interior", 1),
    ];
    expect(curatePhotoSlots(photos, withTeam).portrait).toBe(photos[1]);

    const noTeam = [
      L(0, "interior", 2),
      L(1, "interior", 1),
      L(2, "work", 1),
      L(3, "interior", 1),
      L(4, "interior", 1),
      L(5, "interior", 0),
    ];
    // hero = [work2, interiors 0,1,3] → the first interior outside it is 4.
    expect(curatePhotoSlots(photos, noTeam).portrait).toBe(photos[4]);
  });

  it("portrait falls back: anything outside the hero, then the hero itself", () => {
    const two = urls(2);
    expect(curatePhotoSlots(two, [L(0, "interior", 1), L(1, "product", 1)]).portrait).toBe(two[1]);
    const one = urls(1);
    expect(curatePhotoSlots(one, [L(0, "interior", 1)]).portrait).toBe(one[0]);
  });

  it("label/photo count mismatch throws (callers validate coverage first)", () => {
    expect(() => curatePhotoSlots(urls(2), [L(0, "interior", 1)])).toThrow(/1 labels voor 2/);
  });
});

// ── classifyListingPhotos (strict parse of the vision labelling) ────────────

function visionFake(response: string | object): LLMClient & { prompts: CompleteOptions[] } {
  const client = {
    provider: "fake",
    model: "fake-vision",
    prompts: [] as CompleteOptions[],
    async complete(opts: CompleteOptions): Promise<CompleteResult> {
      client.prompts.push(opts);
      return {
        text: typeof response === "string" ? response : JSON.stringify(response),
        usage: { inputTokens: 50, outputTokens: 60 },
      };
    },
  };
  return client;
}

const photos3 = urls(3);

const VALID = {
  photos: [
    { n: 2, kind: "interior", heroScore: 2, note: "  stoelen en spiegels  " },
    { n: 1, kind: "work", heroScore: 1 },
    { n: 3, kind: "product", heroScore: 0, duplicateOf: 1 },
  ],
};

describe("classifyListingPhotos", () => {
  it("parses the 1-based labelling into 0-based sorted labels, notes trimmed", async () => {
    const client = visionFake(VALID);
    const r = await classifyListingPhotos({ photos: photos3, client });

    expect(r.labels).toEqual([
      { index: 0, kind: "work", heroScore: 1 },
      { index: 1, kind: "interior", heroScore: 2, note: "stoelen en spiegels" },
      { index: 2, kind: "product", heroScore: 0, duplicateOf: 0 },
    ]);
    expect(r.model).toBe("fake-vision");
    expect(r.usage).toEqual({ inputTokens: 50, outputTokens: 60 });
    // One multimodal call: every photo, listing order, low detail.
    expect(client.prompts).toHaveLength(1);
    expect(client.prompts[0]!.images?.map((i) => i.url)).toEqual(photos3);
    expect(client.prompts[0]!.images?.every((i) => i.detail === "low")).toBe(true);
  });

  it("tolerates a ```json fence around the object", async () => {
    const client = visionFake("```json\n" + JSON.stringify(VALID) + "\n```");
    const r = await classifyListingPhotos({ photos: photos3, client });
    expect(r.labels).toHaveLength(3);
  });

  it("incomplete coverage throws — a partial labelling would silently drop photos", async () => {
    const client = visionFake({ photos: [{ n: 1, kind: "work", heroScore: 1 }] });
    await expect(classifyListingPhotos({ photos: photos3, client })).rejects.toThrow(/dekt 1\/3/);
  });

  it("duplicate or out-of-range numbering throws", async () => {
    const dup = visionFake({
      photos: [
        { n: 1, kind: "work", heroScore: 1 },
        { n: 1, kind: "work", heroScore: 1 },
        { n: 3, kind: "work", heroScore: 1 },
      ],
    });
    await expect(classifyListingPhotos({ photos: photos3, client: dup })).rejects.toThrow(/ongeldig/);

    const oob = visionFake({
      photos: [
        { n: 1, kind: "work", heroScore: 1 },
        { n: 2, kind: "work", heroScore: 1 },
        { n: 4, kind: "work", heroScore: 1 },
      ],
    });
    await expect(classifyListingPhotos({ photos: photos3, client: oob })).rejects.toThrow(/ongeldig/);
  });

  it("field-level junk downgrades the field, never the call", async () => {
    const client = visionFake({
      photos: [
        { n: 1, kind: "selfie", heroScore: 7 },
        { n: 2, kind: "interior", heroScore: "mooi" },
        { n: 3, kind: "work", heroScore: 1.6, duplicateOf: 3 },
      ],
    });
    const r = await classifyListingPhotos({ photos: photos3, client });
    // Off-enum kind → other; heroScore clamped/caught; self-duplicate stripped.
    expect(r.labels[0]).toEqual({ index: 0, kind: "other", heroScore: 2 });
    expect(r.labels[1]).toEqual({ index: 1, kind: "interior", heroScore: 0 });
    expect(r.labels[2]).toEqual({ index: 2, kind: "work", heroScore: 2 });
  });

  it("non-JSON output throws (the pipeline degrades to listing order)", async () => {
    const client = visionFake("sorry, geen idee");
    await expect(classifyListingPhotos({ photos: photos3, client })).rejects.toThrow(/geen JSON/);
  });

  it("an empty photo list throws before any client is constructed", async () => {
    await expect(classifyListingPhotos({ photos: [] })).rejects.toThrow(/geen foto's/);
  });
});

// ── applyListingFacts × curation ────────────────────────────────────────────

describe("applyListingFacts with curation", () => {
  const brief = SalonBriefSchema.parse({ name: "X", city: "Utrecht", type: "hair", language: "nl" });

  it("curated slots replace listing order; captions map positionally onto slot order", () => {
    const config = stubMockup(brief);
    const facts = ListingFactsSchema.parse({
      sourceUrl: "https://www.treatwell.nl/salon/x/",
      photos: urls(3),
    });
    const labels = [L(0, "product", 1), L(1, "interior", 2), L(2, "work", 1)];
    const curation = { labels, slots: curatePhotoSlots(facts.photos!, labels), model: "m" };

    const next = applyListingFacts(config, facts, curation);
    expect(next.hero.images).toEqual([facts.photos![2], facts.photos![1]]);
    // Gallery slot order is score-ranked (unlike the work-first hero):
    // interior (2), work (1), product (padding).
    expect(next.gallery.map((g) => g.url)).toEqual([
      facts.photos![1],
      facts.photos![2],
      facts.photos![0],
    ]);
    // The model's first caption lands on the FIRST SLOT — the grounding lists
    // slots in this exact order, so caption 1 was written for this photo.
    expect(next.gallery[0]?.caption).toBe(config.gallery[0]?.caption);
  });

  it("a curated gallery under the schema min falls back to listing order", () => {
    const config = stubMockup(brief);
    const facts = ListingFactsSchema.parse({
      sourceUrl: "https://www.treatwell.nl/salon/x/",
      photos: urls(2),
    });
    // Two photos, one a duplicate → one unique gallery item (< min 2).
    const labels = [L(0, "interior", 1), L(1, "interior", 1, { duplicateOf: 0 })];
    const curation = { labels, slots: curatePhotoSlots(facts.photos!, labels), model: "m" };

    const next = applyListingFacts(config, facts, curation);
    expect(next.hero.images).toEqual([facts.photos![0]]);
    // Repeating the listing set still beats picsum placeholders.
    expect(next.gallery.map((g) => g.url)).toEqual(facts.photos);
  });
});
