import { describe, expect, it } from "vitest";
import { SiteConfigSchema, type SiteConfig } from "../src/site-config";
import { ListingFactsSchema, type ListingFacts } from "../src/listing-facts";
import { isDutchMobile, dutchMobileToWaNumber } from "../src/phone";
import { buildOpener, MARKETING_URL } from "../src/opener";

/**
 * B4 regression anchor: the opener is the first thing a prospect reads. Three
 * things must never silently regress: the wa.me gate (never a dead link on a
 * landline), the truthfulness of every claim (platform, rating praise, "what's
 * in the mockup" — assembled only from data that is genuinely present), and
 * the link encoding (a salon name with ' or ( must not truncate the URL).
 */

function makeConfig(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return SiteConfigSchema.parse({
    slug: "test-salon",
    layout: "atelier",
    brand: {
      name: "Test Salon",
      colors: { primary: "#7a3a2a", accent: "#c98a64", ink: "#2b1d18", surface: "#f1e9dc" },
    },
    hero: { headline: "Welkom.", images: ["https://example.com/1.jpg"] },
    about: { heading: "Over ons.", body: ["Echte tekst."] },
    services: [{ category: "Knippen", items: [{ name: "Knippen dames", price: 42 }] }],
    gallery: [
      { url: "https://example.com/g1.jpg", aspect: "portrait" },
      { url: "https://example.com/g2.jpg", aspect: "landscape" },
    ],
    hours: [
      { day: "Maandag", closed: true },
      { day: "Dinsdag", open: "10:00", close: "18:00" },
      { day: "Woensdag", open: "10:00", close: "18:00" },
      { day: "Donderdag", open: "10:00", close: "20:00" },
      { day: "Vrijdag", open: "10:00", close: "18:00" },
      { day: "Zaterdag", open: "09:00", close: "17:00" },
      { day: "Zondag", closed: true },
    ],
    location: { address: "Teststraat 1", postcode: "3511 AB", city: "Utrecht", country: "Nederland" },
    booking: { provider: "treatwell", externalUrl: "https://www.treatwell.nl/salon/test-salon/" },
    contact: {},
    meta: { locale: "nl-NL" },
    ...overrides,
  });
}

function makeFacts(overrides: Partial<ListingFacts> = {}): ListingFacts {
  return ListingFactsSchema.parse({
    sourceUrl: "https://www.treatwell.nl/salon/test-salon/",
    ...overrides,
  });
}

const MOCK_URL = "https://mock.revivo.nl/test-salon";

describe("isDutchMobile / dutchMobileToWaNumber", () => {
  it("accepts the four common Dutch mobile spellings", () => {
    expect(isDutchMobile("06 12 34 56 78")).toBe(true);
    expect(isDutchMobile("+31 6 12345678")).toBe(true);
    expect(isDutchMobile("0031612345678")).toBe(true);
    expect(isDutchMobile("+31 (0)6 12345678")).toBe(true); // dominant NL website notation
  });

  it("rejects landlines, foreign numbers, and absence", () => {
    expect(isDutchMobile("030 123 4567")).toBe(false); // Utrecht landline
    expect(isDutchMobile("+31 30 1234567")).toBe(false);
    expect(isDutchMobile("+49 171 1234567")).toBe(false);
    expect(isDutchMobile(undefined)).toBe(false);
  });

  it("normalizes every spelling to the wa.me number", () => {
    expect(dutchMobileToWaNumber("06 12 34 56 78")).toBe("31612345678");
    expect(dutchMobileToWaNumber("+31 6 12345678")).toBe("31612345678");
    expect(dutchMobileToWaNumber("0031 6 12345678")).toBe("31612345678");
    expect(dutchMobileToWaNumber("+31 (0)6 12345678")).toBe("31612345678");
    expect(dutchMobileToWaNumber("030 123 4567")).toBeNull();
  });
});

describe("buildOpener — wa.me gate + encoding", () => {
  it("mobile salon: wa.me link pre-filled with the full message incl. the mock URL", () => {
    const config = makeConfig({
      contact: { phone: "06 12 34 56 78" },
      reputation: { rating: 4.7, reviewCount: 2913, source: "Treatwell" },
    });
    const opener = buildOpener({ config, mockUrl: MOCK_URL });

    expect(opener.whatsappUrl).toMatch(/^https:\/\/wa\.me\/31612345678\?text=/);
    const decoded = decodeURIComponent(opener.whatsappUrl!.split("?text=")[1]!);
    expect(decoded).toBe(opener.plainText);
    expect(opener.plainText).toContain("Test Salon");
    expect(opener.plainText).toContain(MOCK_URL);
    expect(opener.plainText).toContain("Groetjes, Berend (Revivo Studios)");
    // ONE link only: the mockup, never the marketing site, in the WhatsApp body
    expect(opener.plainText.split(MOCK_URL).length - 1).toBe(1);
    expect(opener.plainText).not.toContain(MARKETING_URL);
    // single opinion-question CTA + an opt-out line on every message
    expect(opener.plainText).toContain("wat zou je als eerste anders willen zien?");
    expect(opener.plainText).toContain("hoort niets meer van me");
    // the marketing link belongs in the e-mail signature, not the chat body
    expect(opener.emailBody).toContain(MARKETING_URL);
  });

  it("landline salon: NO wa.me link, IG/e-mail copy still carries the URL", () => {
    const config = makeConfig({ contact: { phone: "030 123 4567" } });
    const opener = buildOpener({ config, mockUrl: MOCK_URL });

    expect(opener.whatsappUrl).toBeUndefined();
    expect(opener.igDmText).toContain(MOCK_URL);
    expect(opener.emailBody).toContain(MOCK_URL);
    expect(opener.emailSubject).toContain("Test Salon");
  });

  it("picks the first genuine mobile: a landline phone must not shadow the listing's mobile", () => {
    const opener = buildOpener({
      config: makeConfig({ contact: { phone: "030 123 4567" } }),
      mockUrl: MOCK_URL,
      facts: makeFacts({ phone: "+31612345678" }),
    });
    expect(opener.whatsappUrl).toMatch(/^https:\/\/wa\.me\/31612345678\?/);

    const viaWhatsappField = buildOpener({
      config: makeConfig({ contact: { phone: "030 123 4567", whatsapp: "06 87 65 43 21" } }),
      mockUrl: MOCK_URL,
    });
    expect(viaWhatsappField.whatsappUrl).toMatch(/^https:\/\/wa\.me\/31687654321\?/);
  });

  it("a salon name with ' and ( ) survives linkification: fully percent-encoded", () => {
    const config = makeConfig({
      brand: {
        name: "Sam's Salon (centrum)",
        colors: { primary: "#7a3a2a", accent: "#c98a64", ink: "#2b1d18", surface: "#f1e9dc" },
      },
      contact: { phone: "0612345678" },
    });
    const opener = buildOpener({ config, mockUrl: MOCK_URL });
    const query = opener.whatsappUrl!.split("?text=")[1]!;
    expect(query).not.toMatch(/['()!*]/);
    expect(decodeURIComponent(query)).toContain("Sam's Salon (centrum)");
  });
});

describe("buildOpener — every claim must be true", () => {
  it("strong hook needs ≥4.5★ AND ≥25 reviews; NL formatting", () => {
    const opener = buildOpener({
      config: makeConfig({ reputation: { rating: 4.7, reviewCount: 2913, source: "Treatwell" } }),
      mockUrl: MOCK_URL,
    });
    expect(opener.hook).toContain("4,7★");
    expect(opener.hook).toContain("2.913 reviews");
    expect(opener.hook).toContain("mooi om te zien");
  });

  it("a good-but-thin rating gets the mild compliment, count unmentioned", () => {
    const opener = buildOpener({
      config: makeConfig({ reputation: { rating: 4.8, reviewCount: 12 } }),
      mockUrl: MOCK_URL,
    });
    expect(opener.hook).toContain("4,8★");
    expect(opener.hook).toContain("mooi om te zien");
    expect(opener.hook).not.toContain("reviews");
  });

  it("a mediocre rating is NOT a hook — no fake enthusiasm, falls through", () => {
    const opener = buildOpener({
      config: makeConfig({ reputation: { rating: 2.9, reviewCount: 120, source: "Treatwell" } }),
      mockUrl: MOCK_URL,
    });
    expect(opener.hook).not.toContain("★");
    expect(opener.hook).toContain("Utrecht"); // degraded to the city, honestly
  });

  it("menu-item hook only cites a SCRAPED item that is still on the config", () => {
    const real = buildOpener({
      config: makeConfig(),
      mockUrl: MOCK_URL,
      facts: makeFacts({ services: [{ category: "Knippen", items: [{ name: "Knippen dames", price: 42 }] }] }),
    });
    expect(real.hook).toContain("knippen dames");

    // Stale facts (item no longer on the config) → no citation, city fallback.
    const stale = buildOpener({
      config: makeConfig(),
      mockUrl: MOCK_URL,
      facts: makeFacts({ services: [{ category: "Kleur", items: [{ name: "Balayage", price: 180 }] }] }),
    });
    expect(stale.hook).not.toContain("balayage");

    // Config-only services are LLM-invented (manual/places mode) → never cited.
    const invented = buildOpener({ config: makeConfig(), mockUrl: MOCK_URL });
    expect(invented.hook).not.toContain("knippen dames");
    expect(invented.hook).toContain("Utrecht");
  });

  it("never names where we found them — no 'op Treatwell'/'op Google'/'online' (don't imply their web presence is set)", () => {
    const withFacts = buildOpener({
      config: makeConfig({ reputation: { rating: 4.6, reviewCount: 200, source: "Treatwell" } }),
      mockUrl: MOCK_URL,
      facts: makeFacts(),
    });
    expect(withFacts.plainText).toContain("Ik kwam Test Salon tegen");
    expect(withFacts.plainText).not.toContain("Treatwell");
    expect(withFacts.plainText).not.toContain("online");

    const googleRep = buildOpener({
      config: makeConfig({ reputation: { rating: 4.3, reviewCount: 230, source: "Google" } }),
      mockUrl: MOCK_URL,
    });
    expect(googleRep.plainText).not.toContain("Google");
    expect(googleRep.plainText).not.toContain("Treatwell");
  });

  it('"what\'s in the mockup" lists only what is genuinely scraped + present', () => {
    // Manual/places: nothing scraped → no contents claim, plainer copy.
    const manual = buildOpener({ config: makeConfig(), mockUrl: MOCK_URL });
    expect(manual.plainText).not.toContain("echte prijzen");
    expect(manual.plainText).not.toContain("erin"); // no "Met … erin." clause when nothing is scraped
    expect(manual.plainText).toContain("alvast eentje gemaakt");

    // Full listing: prices + team + reviews all real and on the config.
    const full = buildOpener({
      config: makeConfig({
        team: [{ name: "Anna" }],
        testimonials: [{ author: "Eva", quote: "Top!", rating: 5 }],
      }),
      mockUrl: MOCK_URL,
      facts: makeFacts({
        services: [{ category: "Knippen", items: [{ name: "Knippen dames", price: 42 }] }],
        team: [{ name: "Anna" }],
        reviews: [{ author: "Eva", quote: "Top!", rating: 5 }],
      }),
    });
    expect(full.plainText).toContain("jullie echte prijzen, jullie team en echte reviews");

    // Partial listing (prices only) → only prices claimed.
    const partial = buildOpener({
      config: makeConfig(),
      mockUrl: MOCK_URL,
      facts: makeFacts({ services: [{ category: "Knippen", items: [{ name: "Knippen dames", price: 42 }] }] }),
    });
    expect(partial.plainText).toContain("jullie echte prijzen erin");
    expect(partial.plainText).not.toContain("team");
  });

  it("weak hook (city only) drops the flattery — Variant B: opt-out + one CTA, no second link", () => {
    const opener = buildOpener({ config: makeConfig(), mockUrl: MOCK_URL });
    // city tier: no rating to lead with → no "Ik kwam … tegen" flattery line
    expect(opener.plainText).not.toContain("Ik kwam");
    expect(opener.plainText).toContain("alvast eentje gemaakt");
    expect(opener.plainText).toContain("wat zou je graag anders zien?");
    expect(opener.plainText).toContain("hoort niets meer van me");
    expect(opener.plainText).not.toContain(MARKETING_URL);
  });
});
