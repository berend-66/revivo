import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parseTreatwellHtml, treatwellListingToFacts } from "../src/treatwell";

/**
 * Regression anchor for the moat's load-bearing extractor.
 *
 * The Treatwell scraper deterministically turns a salon's public page into the
 * REAL facts a mockup mirrors (menu/prices/hours/team/reviews/photos). A silent
 * regression here ships a mockup that is confidently wrong about the owner's own
 * business — the one failure that destroys the moat — so this file pins the
 * behaviour against committed HTML fixtures: offline, deterministic, no keys.
 *
 * Fixtures are real captured bytes (see test/fixtures/treatwell/), so every
 * asserted value is frozen regardless of how the live page later drifts. They
 * are regression anchors for OUR parser, not a check on Treatwell's live data;
 * a live-page change is caught by an occasional manual smoke run, not here.
 */

const FIXTURE_URL = "https://www.treatwell.nl/salon/utrecht-hairstyle/";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/treatwell/${name}`, import.meta.url), "utf8");
}

describe("treatwellListingToFacts — Utrecht Hairstyle golden fixture", () => {
  const raw = parseTreatwellHtml(fixture("utrecht-hairstyle.html"), FIXTURE_URL);
  const facts = treatwellListingToFacts(raw);

  it("parses the embedded data blobs", () => {
    expect(raw.state).not.toBeNull();
    expect(raw.jsonLd).toHaveLength(1);
  });

  it("extracts identity, contact and geo", () => {
    expect(facts.name).toBe("Utrecht Hairstyle");
    expect(facts.city).toBe("Utrecht");
    expect(facts.address).toBe("Lange Jansstraat 6");
    expect(facts.phone).toBe("06 41348878");
    expect(facts.lat).toBeCloseTo(52.0936779, 4);
    expect(facts.lng).toBeCloseTo(5.1192412, 4);
    expect(facts.bookingUrl).toBe(FIXTURE_URL);
  });

  it("extracts the real reputation", () => {
    expect(facts.reputation).toEqual({ rating: 4.7, reviewCount: 2913, source: "Treatwell" });
  });

  it("extracts exactly 7 weekday hours rows, in order, with the salon's real hours", () => {
    expect(facts.hours).toHaveLength(7);
    expect(facts.hours?.map((h) => h.day)).toEqual([
      "Maandag",
      "Dinsdag",
      "Woensdag",
      "Donderdag",
      "Vrijdag",
      "Zaterdag",
      "Zondag",
    ]);
    expect(facts.hours?.[0]).toEqual({ day: "Maandag", open: "11:30", close: "19:00" });
    expect(facts.hours?.[3]).toEqual({ day: "Donderdag", open: "10:00", close: "20:00" });
    expect(facts.hours?.[6]).toEqual({ day: "Zondag", closed: true });
  });

  it("extracts the 5-person team with names, ratings and photos", () => {
    expect(facts.team?.map((t) => t.name)).toEqual(["Nael", "Hanan", "lana", "Carmen", "Ahmad"]);
    for (const member of facts.team ?? []) {
      expect(member.photoUrl).toMatch(/^https:\/\/cdn1\.treatwell\.net\//);
      expect(typeof member.rating).toBe("number");
    }
  });

  it("extracts services with correct euro prices (the original failure mode)", () => {
    const priceByName = new Map(
      (facts.services ?? []).flatMap((c) => c.items).map((i) => [i.name, i.price]),
    );
    // Exactly the facts a hand-audit of the first mockup found the LLM getting
    // wrong (e.g. balayage was invented as €165 vs the real €70; mannen €35 vs €25).
    expect(priceByName.get("Mannen - knippen")).toBe(25);
    expect(priceByName.get("Threaden - bovenlip")).toBe(5);
    expect(priceByName.get("Highlights")).toBe(55);
    expect(priceByName.get("Vrouwen - balayage")).toBe(70);
    // Every price is a number or an explicit null — never undefined/NaN.
    for (const category of facts.services ?? []) {
      for (const item of category.items) {
        expect(item.price === null || typeof item.price === "number").toBe(true);
      }
    }
  });

  it("uses the FULL menu price, never Treatwell's promo sale price, and flags from-prices", () => {
    const byName = new Map((facts.services ?? []).flatMap((c) => c.items).map((i) => [i.name, i]));
    // "Kleuren - Eén kleur" carries a 25% off-peak promo in the fixture (sale
    // €33,75 for the Kort haar option, full €45). The salon's menu price is
    // €45 — the discount is Treatwell's temporary slot promo, and quoting it
    // as the standard price misstates the salon's own pricing the moment the
    // promo ends (the B-batch audit found this live: a salon with every
    // off-peak service shown at 0.9× the price).
    expect(byName.get("Kleuren - Eén kleur")).toMatchObject({ price: 45, from: true });
    // Both from-flag triggers, pinned independently of the snapshot:
    // a "… vanaf"-NAMED item (flat full-price range, flagged purely by name) …
    expect(byName.get("Vrouwen - balayage")).toMatchObject({ price: 70, from: true });
    // … and a genuinely RANGED item (no vanaf in the raw name, full €32–40).
    expect(byName.get("Vrouwen - wassen en knippen")).toMatchObject({ price: 32, from: true });
    expect(byName.get("Highlights")).toMatchObject({ price: 55, from: true }); // both triggers
    // Flat-priced items never get the flag.
    expect(byName.get("Mannen - knippen")?.from).toBeUndefined();
  });

  it("curates reviews to >=4 stars, deduped by named author", () => {
    expect(facts.reviews?.length).toBeGreaterThan(0);
    expect(facts.reviews!.length).toBeLessThanOrEqual(6);
    for (const review of facts.reviews ?? []) {
      expect(review.rating === undefined || review.rating >= 4).toBe(true);
      expect(review.source).toBe("Treatwell");
    }
    const namedAuthors = (facts.reviews ?? [])
      .map((r) => r.author.toLowerCase())
      .filter((a) => a !== "anonieme klant" && a !== "klant");
    expect(new Set(namedAuthors).size).toBe(namedAuthors.length);
  });

  it("extracts only key-free, public photo URLs", () => {
    expect(facts.photos?.length).toBeGreaterThan(0);
    for (const photo of facts.photos ?? []) {
      expect(photo).toMatch(/^https:\/\/cdn1\.treatwell\.net\//);
      expect(photo).not.toMatch(/[?&]key=/i);
    }
  });

  it("matches the frozen golden ListingFacts snapshot", () => {
    expect(facts).toMatchSnapshot();
  });
});

describe("treatwellListingToFacts — graceful degradation when window.__state__ is absent", () => {
  it("falls back to JSON-LD scalars, warns once, and never invents services/team/reviews", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const raw = parseTreatwellHtml(fixture("no-state.html"), FIXTURE_URL);
    const facts = treatwellListingToFacts(raw);

    expect(raw.state).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain("window.__state__ not found");
    warn.mockRestore();

    // Scalars are recovered from the JSON-LD block.
    expect(facts.name).toBe("Utrecht Hairstyle");
    expect(facts.city).toBe("Utrecht");
    expect(facts.reputation).toEqual({ rating: 4.7, reviewCount: 2913, source: "Treatwell" });
    expect(facts.hours).toHaveLength(7);
    expect(facts.photos?.length).toBeGreaterThan(0);

    // The rich, state-only fields are OMITTED, not fabricated — omit-don't-invent.
    expect(facts.services).toBeUndefined();
    expect(facts.team).toBeUndefined();
    expect(facts.reviews).toBeUndefined();
  });
});
