import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canonicalSalonUrl,
  crawlTreatwellDirectory,
  directoryUrl,
  parseTreatwellDirectoryHtml,
} from "../src/marketplace/treatwell-directory";

/**
 * Offline regression harness for the directory crawler (B2) — captured real
 * bytes of the Utrecht × kapper browse (66 salons over 4 pages at capture
 * time), same posture as treatwell.test.ts: the fixtures anchor OUR parser,
 * not Treatwell's live data. No network, no keys.
 */

const P1_URL = "https://www.treatwell.nl/salons/bij-kapper/in-utrecht-nl/";
const P2_URL = "https://www.treatwell.nl/salons/bij-kapper/in-utrecht-nl/pagina-2/";
const P3_URL = "https://www.treatwell.nl/salons/bij-kapper/in-utrecht-nl/pagina-3/";
const P4_URL = "https://www.treatwell.nl/salons/bij-kapper/in-utrecht-nl/pagina-4/";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/treatwell-directory/${name}`, import.meta.url), "utf8");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("directoryUrl / canonicalSalonUrl", () => {
  it("builds the city × treatment browse URL", () => {
    expect(directoryUrl("utrecht")).toBe(P1_URL);
    expect(directoryUrl("Den Haag", "kapper")).toBe("https://www.treatwell.nl/salons/bij-kapper/in-den-haag-nl/");
  });

  it("canonicalizes salon links and rejects non-salon links", () => {
    // the directory's anchors carry ?serviceIds=… junk that must not reach the dedup key
    expect(
      canonicalSalonUrl("https://www.treatwell.nl/salon/cremode/?serviceIds=TR1621948,TR1621936", P1_URL),
    ).toBe("https://www.treatwell.nl/salon/cremode/");
    expect(canonicalSalonUrl("/salon/davey-de-barber/?x=1#top", P1_URL)).toBe(
      "https://www.treatwell.nl/salon/davey-de-barber/",
    );
    expect(canonicalSalonUrl("/salons/bij-kapper/in-utrecht-nl/pagina-2/", P1_URL)).toBeNull();
    expect(canonicalSalonUrl("https://www.treatwell.nl/", P1_URL)).toBeNull();
  });
});

describe("parseTreatwellDirectoryHtml", () => {
  it("parses a first page: 20 venues from the state blob, pagination, next link", () => {
    const page = parseTreatwellDirectoryHtml(fixture("utrecht-kapper-p1.html"), P1_URL, "utrecht");

    expect(page.usedFallback).toBe(false);
    expect(page.pagination).toEqual({ page: 0, totalPages: 4, totalElements: 66 });
    expect(page.nextUrl).toBe(P2_URL);
    expect(page.venues).toHaveLength(20);

    const first = page.venues[0]!;
    expect(first).toEqual({
      listingUrl: "https://www.treatwell.nl/salon/karinka-hairsalon/",
      name: "Karinka Hairsalon",
      city: "utrecht",
      rating: 4.81,
      reviewCount: 21,
      directoryUrl: P1_URL,
    });

    // every listing URL is canonical — bare /salon/<slug>/, no query strings
    for (const v of page.venues) {
      expect(v.listingUrl).toMatch(/^https:\/\/www\.treatwell\.nl\/salon\/[^/?#]+\/$/);
    }
    // freeze the full prospect list — a parser regression that drops/garbles
    // venues must show up as a crisp diff
    expect(page.venues.map((v) => v.listingUrl)).toMatchSnapshot();
  });

  it("parses the LAST page: 6 venues, no next link", () => {
    const page = parseTreatwellDirectoryHtml(fixture("utrecht-kapper-p4.html"), P4_URL, "utrecht");

    expect(page.usedFallback).toBe(false);
    expect(page.pagination).toEqual({ page: 3, totalPages: 4, totalElements: 66 });
    expect(page.nextUrl).toBeNull();
    expect(page.venues).toHaveLength(6);
    expect(page.venues[0]!.name).toBe("Haar & Nagel boutique");
  });

  it("finds rel=next inside a token list and survives a malformed href earlier in the head", () => {
    // rel is a space-separated token list per the HTML spec; one bad href must
    // not abandon the remaining <link> tags
    const html = fixture("utrecht-kapper-p1.html").replace(
      /<link rel="next" href="([^"]*)"\s*\/>/,
      '<link rel="next" href="https://["bad"]/"/><link rel="next prefetch" href="$1"/>',
    );
    const page = parseTreatwellDirectoryHtml(html, P1_URL, "utrecht");
    expect(page.nextUrl).toBe(P2_URL);
  });

  it("flags an EXPANDED search (Treatwell widened a sparse query)", () => {
    const real = parseTreatwellDirectoryHtml(fixture("utrecht-kapper-p1.html"), P1_URL, "utrecht");
    expect(real.searchExpanded).toBe(false);

    const widened = fixture("utrecht-kapper-p1.html").replace(
      '"expandedSearch":false',
      '"expandedSearch":true',
    );
    const page = parseTreatwellDirectoryHtml(widened, P1_URL, "utrecht");
    expect(page.searchExpanded).toBe(true);
  });

  it("degrades to anchor hrefs when the state blob is gone (warns, still finds all salons + next)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // same real bytes, state marker renamed — exactly the failure a layout change causes
    const html = fixture("utrecht-kapper-p1.html").replaceAll("window.__state__", "window.__state_gone__");

    const page = parseTreatwellDirectoryHtml(html, P1_URL, "utrecht");

    expect(warn).toHaveBeenCalledOnce();
    expect(page.usedFallback).toBe(true);
    expect(page.pagination).toBeNull();
    // rel=next is plain HTML — pagination survives without the blob
    expect(page.nextUrl).toBe(P2_URL);
    // all 20 salons recovered from anchors, canonical + deduped, no names/ratings invented
    expect(page.venues).toHaveLength(20);
    for (const v of page.venues) {
      expect(v.listingUrl).toMatch(/^https:\/\/www\.treatwell\.nl\/salon\/[^/?#]+\/$/);
      expect(v.name).toBeUndefined();
      expect(v.rating).toBeUndefined();
    }
    const fromState = parseTreatwellDirectoryHtml(fixture("utrecht-kapper-p1.html"), P1_URL, "utrecht");
    expect(new Set(page.venues.map((v) => v.listingUrl))).toEqual(
      new Set(fromState.venues.map((v) => v.listingUrl)),
    );
  });
});

describe("crawlTreatwellDirectory", () => {
  /** Offline fetch stub: serves the captured pages by URL. The p2 fixture's
   * rel=next points at pagina-3; the stub serves the (captured) last page for
   * it, so the crawl walks a real 3-fetch chain ending without a next link. */
  function stubFetch(log: string[] = []): typeof fetch {
    const byUrl: Record<string, string> = {
      [P1_URL]: fixture("utrecht-kapper-p1.html"),
      [P2_URL]: fixture("utrecht-kapper-p2.html"),
      [P3_URL]: fixture("utrecht-kapper-p4.html"),
      [P4_URL]: fixture("utrecht-kapper-p4.html"),
    };
    return (async (input: any) => {
      const url = String(input);
      log.push(url);
      const body = byUrl[url];
      if (!body) return new Response("not found", { status: 404, statusText: "Not Found" });
      return new Response(body, { status: 200 });
    }) as typeof fetch;
  }

  it("walks the rel=next chain and yields deduped canonical leads", async () => {
    const fetched: string[] = [];
    const leads = [];
    for await (const lead of crawlTreatwellDirectory({
      cities: ["utrecht"],
      delayMs: 0,
      fetchImpl: stubFetch(fetched),
    })) {
      leads.push(lead);
    }

    expect(fetched).toEqual([P1_URL, P2_URL, P3_URL]);
    // 20 + 20 + 6, no overlap in the captured pages
    expect(leads).toHaveLength(46);
    expect(new Set(leads.map((l) => l.listingUrl)).size).toBe(46);
    expect(leads.every((l) => l.city === "utrecht")).toBe(true);
  });

  it("dedups across cities/pages serving the same salons", async () => {
    const sameEverywhere: typeof fetch = (async () =>
      new Response(fixture("utrecht-kapper-p4.html"), { status: 200 })) as typeof fetch;
    const leads = [];
    for await (const lead of crawlTreatwellDirectory({
      cities: ["utrecht", "amersfoort"],
      maxPagesPerCity: 2,
      delayMs: 0,
      fetchImpl: sameEverywhere,
    })) {
      leads.push(lead);
    }
    // the last-page fixture has no rel=next → 1 page per city; 6 salons, once
    expect(leads).toHaveLength(6);
  });

  it("honors the page cap and says what it dropped", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const leads = [];
    for await (const lead of crawlTreatwellDirectory({
      cities: ["utrecht"],
      maxPagesPerCity: 1,
      delayMs: 0,
      fetchImpl: stubFetch(),
    })) {
      leads.push(lead);
    }
    expect(leads).toHaveLength(20); // page 1 only
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]![0])).toContain("page cap");
  });

  it("skips an EXPANDED-search page entirely (wrong-city leads must not enter the funnel)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const widened = fixture("utrecht-kapper-p1.html").replace(
      '"expandedSearch":false',
      '"expandedSearch":true',
    );
    const serveWidened: typeof fetch = (async () => new Response(widened, { status: 200 })) as typeof fetch;
    const leads = [];
    for await (const lead of crawlTreatwellDirectory({
      cities: ["flurbeltown"],
      delayMs: 0,
      fetchImpl: serveWidened,
    })) {
      leads.push(lead);
    }
    expect(leads).toHaveLength(0);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]![0])).toContain("EXPANDED");
  });

  it("clamps a NaN page cap to the default instead of failing open", async () => {
    // a typo'd --max-pages would arrive as NaN: `page > NaN` is always false, so
    // without the clamp this self-referencing rel=next chain would never end.
    // (delayMs NaN clamps to the 5000ms default via the same safeNumber path —
    // asserting it here would make the test sleep 45s, so it uses a valid 0.)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetched: string[] = [];
    const selfChain: typeof fetch = (async (input: any) => {
      fetched.push(String(input));
      return new Response(fixture("utrecht-kapper-p1.html"), { status: 200 });
    }) as typeof fetch;
    const leads = [];
    for await (const lead of crawlTreatwellDirectory({
      cities: ["utrecht"],
      maxPagesPerCity: Number.NaN,
      delayMs: 0,
      fetchImpl: selfChain,
    })) {
      leads.push(lead);
    }
    expect(fetched).toHaveLength(10); // the default cap, not an endless crawl
    expect(leads).toHaveLength(20); // same 20 salons, deduped across the repeats
    expect(String(warn.mock.calls.at(-1)![0])).toContain("page cap");
  });

  it("warns when the rel=next chain ends before pagination says it should", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // page 1 of 4 with its rel=next link broken — exactly what a markup drift causes
    const broken = fixture("utrecht-kapper-p1.html").replace('rel="next"', 'rel="nope"');
    const serveBroken: typeof fetch = (async () => new Response(broken, { status: 200 })) as typeof fetch;
    const leads = [];
    for await (const lead of crawlTreatwellDirectory({
      cities: ["utrecht"],
      delayMs: 0,
      fetchImpl: serveBroken,
    })) {
      leads.push(lead);
    }
    expect(leads).toHaveLength(20); // page 1 still yields
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]![0])).toContain("ended early");
  });

  it("throws on a non-OK page instead of yielding a silently-short list", async () => {
    const broken: typeof fetch = (async () =>
      new Response("nope", { status: 403, statusText: "Forbidden" })) as typeof fetch;
    const crawl = crawlTreatwellDirectory({ cities: ["utrecht"], delayMs: 0, fetchImpl: broken });
    await expect(crawl.next()).rejects.toThrow(/403/);
  });
});
