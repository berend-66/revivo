import { BROWSER_UA, extractStateObject } from "../treatwell";

/**
 * Treatwell marketplace directory crawler (roadmap B2) — the first lead producer.
 *
 * WHY marketplace before Google Places: each directory entry IS the listing URL
 * the deterministic scraper (treatwell.ts) already consumes, so one crawl yields
 * both the prospect list and the rich-facts path — no separate Places lookup, and
 * a salon on Treatwell has proven demand (real reviews) but typically no owned
 * website: a strong revivo fit.
 *
 * Same posture as treatwell.ts: the directory pages are server-rendered with a
 * `window.__state__` blob (`browse.results` = venue cards, `browse.pagination`),
 * so extraction is deterministic JSON parsing — no LLM, no headless browser, and
 * this module must NEVER import @revivo/llm (or @revivo/db — it's a pure
 * library; the thin scripts/crawl-marketplace.ts does the DB writes).
 * Fallback when the state blob disappears: plain `/salon/<slug>/` anchor hrefs.
 * Pagination follows the page's own `<link rel="next">` (absent on the last
 * page); the state pagination rides along as metadata.
 *
 * The crawl enumerates listing URLs ONLY — facts are scraped at generation time
 * (fetchTreatwellFacts), keeping the crawl cheap and the data fresh at the moment
 * the mockup is built. Politeness: sequential fetches, delay between pages, a
 * page cap per city, the same browser UA as the listing scraper. Public-page
 * read, bounded by a tiny seed list at this scale (~a few cities).
 */

/** One prospect surfaced by the directory. `listingUrl` is canonical
 * (`https://…/salon/<slug>/`, no query) — it is the leads dedup key. */
export interface DirectoryLead {
  listingUrl: string;
  name?: string;
  /** The crawl's input city — the address lines on the card are not reliably
   * parseable for a city (variable length), the browse scope is. */
  city?: string;
  /** Treatwell weighted average (e.g. 4.81) — lead-quality signal, not a mockup fact. */
  rating?: number;
  reviewCount?: number;
  /** The directory page this lead was found on (provenance / query_text). */
  directoryUrl: string;
}

export interface DirectoryPage {
  sourceUrl: string;
  venues: DirectoryLead[];
  /** From the state blob (`page` is 0-based); null when the blob is absent. */
  pagination: { page: number; totalPages: number; totalElements: number } | null;
  /** Absolute URL of the next page (`<link rel="next">`), or null on the last page. */
  nextUrl: string | null;
  /** True when the state blob was missing and venues came from anchor hrefs. */
  usedFallback: boolean;
  /** True when Treatwell signals it widened/rewrote a sparse search
   * (`browse.expandedSearch` / `implicitModifications`) — the results may then
   * include OUT-OF-SCOPE salons (wrong city), so the crawl must not trust them. */
  searchExpanded: boolean;
}

/** `…/salon/<slug>/…` (any query/hash) → canonical `https://host/salon/<slug>/`;
 * null for anything that isn't a salon listing link. */
export function canonicalSalonUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    const m = u.pathname.match(/^\/salon\/([^/]+)\/?/);
    if (!m) return null;
    return `${u.origin}/salon/${m[1]}/`;
  } catch {
    return null;
  }
}

/** First page of a city × treatment browse, e.g. ("utrecht", "kapper") →
 * https://www.treatwell.nl/salons/bij-kapper/in-utrecht-nl/ */
export function directoryUrl(city: string, treatment = "kapper"): string {
  const slug = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  return `https://www.treatwell.nl/salons/bij-${slug(treatment)}/in-${slug(city)}-nl/`;
}

/**
 * Pure HTML → DirectoryPage parse (no network) — unit-tested offline against
 * captured fixtures, same split as parseTreatwellHtml. Primary source is the
 * state blob's `browse.results`; anchor hrefs are the degradation path.
 */
export function parseTreatwellDirectoryHtml(html: string, sourceUrl: string, city?: string): DirectoryPage {
  const state = extractStateObject(html);
  const browse = state?.browse ?? null;

  const pg = browse?.pagination;
  const pagination =
    pg && typeof pg.page === "number" && typeof pg.totalPages === "number"
      ? { page: pg.page, totalPages: pg.totalPages, totalElements: pg.totalElements ?? -1 }
      : null;

  const nextUrl = extractRelNext(html, sourceUrl);

  const mods = browse?.implicitModifications;
  const searchExpanded =
    browse?.expandedSearch === true ||
    Object.keys(mods?.addedCriteria ?? {}).length > 0 ||
    Object.keys(mods?.droppedCriteria ?? {}).length > 0;

  let venues: DirectoryLead[];
  let usedFallback = false;
  if (Array.isArray(browse?.results)) {
    venues = [];
    for (const r of browse.results) {
      if (r?.type !== "venue" || !r.data) continue;
      const d = r.data;
      const listingUrl = canonicalSalonUrl(String(d.uri?.desktopUri ?? ""), sourceUrl);
      if (!listingUrl) continue;
      venues.push({
        listingUrl,
        name: typeof d.name === "string" && d.name.trim() ? d.name.trim() : undefined,
        city,
        rating: typeof d.rating?.weightedAverage === "number" ? d.rating.weightedAverage : undefined,
        reviewCount: typeof d.rating?.count === "number" ? d.rating.count : undefined,
        directoryUrl: sourceUrl,
      });
    }
  } else {
    usedFallback = true;
    console.warn(
      `[treatwell-directory] window.__state__ browse results not found for ${sourceUrl} — ` +
        `falling back to /salon/ anchor hrefs (no names/ratings). The directory layout may have changed.`,
    );
    const seen = new Set<string>();
    venues = [];
    for (const m of html.matchAll(/href="([^"]*\/salon\/[^"]*)"/g)) {
      const listingUrl = canonicalSalonUrl(m[1]!, sourceUrl);
      if (!listingUrl || seen.has(listingUrl)) continue;
      seen.add(listingUrl);
      venues.push({ listingUrl, city, directoryUrl: sourceUrl });
    }
  }

  return { sourceUrl, venues, pagination, nextUrl, usedFallback, searchExpanded };
}

function extractRelNext(html: string, base: string): string | null {
  // tolerate attribute order (<link rel="next" href=…> / <link href=… rel="next">)
  // and rel TOKEN LISTS (rel="next prefetch" is spec-valid)
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = tag.match(/rel=["']([^"']*)["']/i)?.[1];
    if (!rel || !rel.toLowerCase().split(/\s+/).includes("next")) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      return new URL(href, base).toString();
    } catch {
      continue; // one malformed href must not abandon the remaining <link> tags
    }
  }
  return null;
}

export interface CrawlTreatwellDirectoryOptions {
  /** City slugs as they appear in Treatwell URLs, e.g. "utrecht", "den-haag". */
  cities: string[];
  /** Treatment path segments (`bij-<treatment>`), default ["kapper"]. */
  treatments?: string[];
  /** Politeness cap per city × treatment (default 10 → ≤200 salons). */
  maxPagesPerCity?: number;
  /** Delay between page fetches. Default 5000 ms — treatwell.nl/robots.txt
   * publishes `Crawl-delay: 5`; honoring it is what keeps the public-page-read
   * posture defensible. Don't go below it against the live site. */
  delayMs?: number;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

/** NaN/garbage-proof option read: the politeness knobs must FAIL CLOSED — a
 * typo'd `--max-pages 1O` becoming NaN would otherwise silently disable both
 * the cap (`page > NaN` is false) and the delay (`NaN > 0` is false). */
function safeNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Crawl city × treatment browse pages and yield deduped DirectoryLeads.
 * Sequential + delayed by design — at this scale a faster crawl buys nothing
 * and risks the public-page-read posture.
 */
export async function* crawlTreatwellDirectory(
  opts: CrawlTreatwellDirectoryOptions,
): AsyncGenerator<DirectoryLead> {
  const treatments = opts.treatments ?? ["kapper"];
  const maxPages = safeNumber(opts.maxPagesPerCity, 10);
  const delayMs = safeNumber(opts.delayMs, 5000);
  const doFetch = opts.fetchImpl ?? fetch;
  const seen = new Set<string>();

  for (const city of opts.cities) {
    for (const treatment of treatments) {
      let url: string | null = directoryUrl(city, treatment);
      for (let page = 1; url !== null; page++) {
        if (page > maxPages) {
          console.warn(
            `[treatwell-directory] page cap (${maxPages}) hit for ${city} × ${treatment} — ` +
              `more pages exist at ${url}; raise maxPagesPerCity to cover them.`,
          );
          break;
        }
        const res = await doFetch(url, {
          headers: { "User-Agent": BROWSER_UA, "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8" },
        });
        if (!res.ok) {
          throw new Error(`Treatwell directory fetch ${res.status} for ${url}: ${res.statusText}`);
        }
        const parsed = parseTreatwellDirectoryHtml(await res.text(), url, city);
        if (parsed.searchExpanded) {
          // Treatwell widened a sparse search — results may be out of scope
          // (wrong city). Yielding them would stamp wrong-city leads into the
          // funnel and poison the openers; skip the page and end this seed.
          console.warn(
            `[treatwell-directory] ${url} is an EXPANDED search (Treatwell widened the scope) — ` +
              `skipping its results; ${city} × ${treatment} may simply have few salons.`,
          );
          break;
        }
        for (const lead of parsed.venues) {
          if (seen.has(lead.listingUrl)) continue;
          seen.add(lead.listingUrl);
          yield lead;
        }
        url = parsed.nextUrl;
        if (
          url === null &&
          parsed.pagination !== null &&
          parsed.pagination.page < parsed.pagination.totalPages - 1
        ) {
          // pagination metadata says more pages exist but no rel=next was found —
          // the chain ended early. Degrade loudly, never truncate coverage silently.
          console.warn(
            `[treatwell-directory] pagination chain ended early for ${city} × ${treatment} ` +
              `(page ${parsed.pagination.page + 1}/${parsed.pagination.totalPages}, no rel=next on ` +
              `${parsed.sourceUrl}) — rel=next extraction may be broken; coverage is incomplete.`,
          );
        }
        if (url !== null && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
}
