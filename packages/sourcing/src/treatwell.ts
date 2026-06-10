import {
  ListingFactsSchema,
  SalonBriefSchema,
  type ListingFacts,
  type SalonBrief,
  type ServiceCategory,
  type ServiceItem,
  type HoursRow,
  type Testimonial,
  type TeamMember,
  type Reputation,
} from "@revivo/shared";
import type { PlaceToBriefOverrides } from "./places-to-brief";

/**
 * Treatwell scraper — the salon's REAL menu/prices/team/hours/reviews/photos.
 *
 * WHY this exists: Google Places is too thin a source (name/address/hours/phone/
 * rating, no services/team/prices), so the generator used to invent the rest —
 * producing a mockup that was confidently wrong about the owner's own business
 * (wrong prices, invented services, no team, hidden real reputation). A salon's
 * Treatwell page is its public source of truth, and — crucially — it is a
 * SERVER-RENDERED page that embeds a `window.__state__` JSON blob plus a
 * schema.org JSON-LD block. So extraction is **deterministic parsing, not an LLM
 * call**: we read typed JSON directly. No headless browser, no parser dependency,
 * and zero model drift on facts (the "facts deterministic, voice LLM" principle).
 *
 * This module is pure fetch + parse. It must NEVER depend on @revivo/llm —
 * sourcing produces facts; the LLM package consumes them.
 *
 * Robustness: `window.__state__` is the primary source (carries everything);
 * JSON-LD is a redundant fallback for the scalar fields (name/geo/rating/hours/
 * photos) so a layout change that drops the state blob degrades instead of
 * breaking. TOS note: this is a public-page read (no auth, no API). The selectors
 * are minimal (one marker + JSON.parse) so cosmetic HTML changes don't break it.
 */

/** Shared with the directory crawler (marketplace/treatwell-directory.ts) — one UA posture. */
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface RawListing {
  /** The canonical URL actually fetched. */
  sourceUrl: string;
  /** Parsed `window.__state__` blob, or null if absent. */
  state: any | null;
  /** Parsed `application/ld+json` blocks (may be empty). */
  jsonLd: any[];
  /** The raw HTML, kept for a future text-reduction fallback. */
  html: string;
}

/** Accept a full salon URL or a bare slug → canonical `…/salon/<slug>/`. */
export function normalizeTreatwellUrl(input: string): string {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return `${u.origin}${u.pathname.replace(/\/?$/, "/")}`;
    } catch {
      return s;
    }
  }
  const slug = s.replace(/^\/+|\/+$/g, "");
  return `https://www.treatwell.nl/salon/${slug}/`;
}

/** Fetch a Treatwell listing page and parse out its embedded data blobs. */
export async function fetchTreatwellListing(input: string, init?: RequestInit): Promise<RawListing> {
  const sourceUrl = normalizeTreatwellUrl(input);
  const res = await fetch(sourceUrl, {
    ...init,
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Treatwell fetch ${res.status} for ${sourceUrl}: ${res.statusText}`);
  }
  const html = await res.text();
  return parseTreatwellHtml(html, sourceUrl);
}

/**
 * Pure HTML → RawListing parse (no network). `fetchTreatwellListing` is just a
 * `fetch` in front of this. Keeping the parse separate makes the moat's
 * load-bearing extractor unit-testable against captured HTML fixtures with no
 * network and no keys — see `test/treatwell.test.ts`.
 */
export function parseTreatwellHtml(html: string, sourceUrl: string): RawListing {
  const state = extractStateObject(html);
  const jsonLd = extractJsonLd(html);
  if (!state) {
    console.warn(
      `[treatwell] window.__state__ not found for ${sourceUrl} — using JSON-LD only ` +
        `(services/team/reviews may be missing). The listing layout may have changed.`,
    );
  }
  return { sourceUrl, state, jsonLd, html };
}

/** Convenience: fetch + parse in one call. */
export async function fetchTreatwellFacts(
  input: string,
  init?: RequestInit,
): Promise<{ raw: RawListing; facts: ListingFacts }> {
  const raw = await fetchTreatwellListing(input, init);
  return { raw, facts: treatwellListingToFacts(raw) };
}

/**
 * The deterministic extractor: RawListing → validated ListingFacts. Primary
 * source is the `window.__state__` venue object; JSON-LD fills any scalar gaps.
 */
export function treatwellListingToFacts(raw: RawListing): ListingFacts {
  const v = raw.state?.venue?.venue ?? raw.state?.venue ?? null;
  const biz = pickBusinessNode(raw.jsonLd);

  const facts: Record<string, unknown> = { sourceUrl: raw.sourceUrl, bookingUrl: raw.sourceUrl };

  const name = strOrNull(v?.name) ?? strOrNull(biz?.name);
  if (name) facts.name = name;

  const desc = typeof v?.description === "string" ? stripHtml(v.description) : undefined;
  if (desc) facts.description = desc;

  const phone = strOrNull(v?.contact?.phone);
  if (phone) facts.phone = phone;

  // Address: state addressLines = [street, …, city]; JSON-LD as fallback.
  const lines: string[] = Array.isArray(v?.location?.address?.addressLines)
    ? v.location.address.addressLines.filter((l: unknown) => typeof l === "string")
    : [];
  const street = lines.length ? lines[0] : strOrNull(biz?.address?.streetAddress);
  if (street) facts.address = street.trim();
  const last = lines.length > 1 ? lines[lines.length - 1] : undefined;
  const city = (last && last !== street ? last : undefined) ?? strOrNull(biz?.address?.addressLocality);
  if (city) facts.city = city.trim();

  // Geo: state location.point.{lat,lon}; JSON-LD geo as fallback.
  let lat = num(v?.location?.point?.lat ?? v?.location?.map?.lat);
  let lng = num(v?.location?.point?.lon ?? v?.location?.point?.lng ?? v?.location?.map?.lon);
  if (lat === undefined || lng === undefined) {
    lat = lat ?? num(biz?.geo?.latitude);
    lng = lng ?? num(biz?.geo?.longitude);
  }
  if (lat !== undefined) facts.lat = lat;
  if (lng !== undefined) facts.lng = lng;

  const services = servicesFromState(v);
  if (services) facts.services = services;

  const hours = hoursFromState(v) ?? hoursFromJsonLd(biz);
  if (hours) facts.hours = hours;

  const team = teamFromState(v);
  if (team) facts.team = team;

  const reputation = reputationFromState(v) ?? reputationFromJsonLd(biz);
  if (reputation) facts.reputation = reputation;

  const reviews = reviewsFromState(v);
  if (reviews) facts.reviews = reviews;

  const photos = photosFromState(v) ?? photosFromJsonLd(biz);
  if (photos) facts.photos = photos;

  return ListingFactsSchema.parse(facts);
}

/**
 * Build a SalonBrief from scraped facts — the listing-mode sibling of
 * `placeToBrief`. The brief seeds the LLM (voice/layout); the facts themselves
 * are applied deterministically downstream, so this only needs the identity
 * fields plus coords/reputation for grounding.
 */
export function listingFactsToBrief(facts: ListingFacts, overrides: PlaceToBriefOverrides = {}): SalonBrief {
  const city = overrides.city ?? facts.city;
  if (!city) {
    throw new Error(
      `Could not determine the city for "${facts.name ?? facts.sourceUrl}" from the Treatwell listing. ` +
        "Pass --city to override.",
    );
  }
  return SalonBriefSchema.parse({
    name: facts.name ?? "Salon",
    city,
    type: overrides.type ?? deriveTypeFromServices(facts.services),
    vibe: overrides.vibe,
    address: facts.address,
    postcode: facts.postcode,
    knownServices: overrides.knownServices,
    language: overrides.language ?? "nl",
    preferLayout: overrides.preferLayout,
    rating: facts.reputation?.rating,
    reviewCount: facts.reputation?.reviewCount,
    lat: facts.lat,
    lng: facts.lng,
    notes: overrides.notes,
  } satisfies Partial<SalonBrief>);
}

// ── extraction helpers ──────────────────────────────────────────────────────

const DOW_NL: Record<string, string> = {
  monday: "Maandag",
  tuesday: "Dinsdag",
  wednesday: "Woensdag",
  thursday: "Donderdag",
  friday: "Vrijdag",
  saturday: "Zaterdag",
  sunday: "Zondag",
};
const DOW_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function servicesFromState(v: any): ServiceCategory[] | null {
  const groups = v?.menu?.menuGroups;
  if (!Array.isArray(groups)) return null;
  const cats: ServiceCategory[] = [];
  for (const g of groups) {
    const items: ServiceItem[] = [];
    for (const mi of g?.menuItems ?? []) {
      const d = mi?.data;
      if (!d?.name) continue;
      // FULL price, never the sale price: minSalePriceAmount carries Treatwell's
      // temporary promos (off-peak slots, % campaigns). A mockup quoting a
      // discounted price as the standard menu price misstates the salon's own
      // pricing the moment the promo ends — the cardinal sin.
      const minFull = parseEuro(d?.priceRange?.minFullPriceAmount);
      const maxFull = parseEuro(d?.priceRange?.maxFullPriceAmount);
      const price = minFull ?? parseEuro(d?.priceRange?.minSalePriceAmount);
      if (minFull === undefined && price !== undefined) {
        // Degrade loudly: if Treatwell ever drops/renames the full-price field,
        // every item silently becomes a promo price — make the drift visible.
        console.warn(
          `treatwell: menu-item "${String(d.name).trim()}" heeft geen minFullPriceAmount — sale-prijs gebruikt (velddrift? check op promo-prijzen)`,
        );
      }
      const rawName = String(d.name).replace(/\s+/g, " ").trim();
      const item: ServiceItem = { name: cleanName(rawName), price: price ?? null };
      // From-price, not a flat price: the listing names it "... vanaf" or the
      // full-price range is genuinely ranged. Variants render "vanaf €X".
      // The SAME regex drives the name-strip in cleanName — strip and flag can
      // never disagree (a stripped qualifier without the flag would render a
      // from-price as flat, the exact bug this exists to prevent).
      const namedVanaf = VANAF_SUFFIX.test(rawName);
      const ranged = minFull !== undefined && maxFull !== undefined && maxFull > minFull;
      if (price !== undefined && (namedVanaf || ranged)) item.from = true;
      const dur = num(d?.durationRange?.minDurationMinutes);
      if (dur !== undefined && dur > 0) item.durationMin = Math.round(dur);
      items.push(item);
    }
    if (items.length) cats.push({ category: cleanName(g?.name ?? "Behandelingen"), items });
  }
  return cats.length ? cats : null;
}

function hoursFromState(v: any): HoursRow[] | null {
  const oh = v?.openingHours;
  if (!Array.isArray(oh) || !oh.length) return null;
  const byDay = new Map<string, any>();
  for (const o of oh) {
    const d = strOrNull(o?.dayOfWeek)?.toLowerCase();
    if (d) byDay.set(d, o);
  }
  const rows: HoursRow[] = [];
  for (const d of DOW_ORDER) {
    const o = byDay.get(d);
    const day = DOW_NL[d] ?? d;
    if (!o || o.open === false || !o.from) rows.push({ day, closed: true });
    else rows.push({ day, open: hm(o.from) ?? o.from, close: hm(o.to) ?? o.to });
  }
  return rows;
}

function hoursFromJsonLd(biz: any): HoursRow[] | null {
  const specs = biz?.openingHoursSpecification;
  if (!Array.isArray(specs) || !specs.length) return null;
  const map = new Map<string, { from?: string; to?: string }>();
  for (const s of specs) {
    const days = Array.isArray(s?.dayOfWeek) ? s.dayOfWeek : [s?.dayOfWeek];
    for (const dRaw of days) {
      const key = strOrNull(dRaw)?.toLowerCase().replace(/.*\//, "");
      if (key) map.set(key, { from: s?.opens, to: s?.closes });
    }
  }
  const rows: HoursRow[] = [];
  for (const d of DOW_ORDER) {
    const o = map.get(d);
    const day = DOW_NL[d] ?? d;
    if (!o || !o.from) rows.push({ day, closed: true });
    else rows.push({ day, open: hm(o.from) ?? o.from, close: hm(o.to) ?? o.to });
  }
  return rows;
}

function teamFromState(v: any): TeamMember[] | null {
  const emps = v?.employees;
  if (!Array.isArray(emps) || !emps.length) return null;
  const team: TeamMember[] = [];
  for (const e of emps) {
    const name = strOrNull(e?.name);
    if (!name) continue;
    const m: TeamMember = { name: name.trim() };
    const role = strOrNull(e?.title);
    if (role) m.role = role.trim();
    const top = [...(Array.isArray(e?.portfolioSentiments) ? e.portfolioSentiments : [])]
      .filter((s) => strOrNull(s?.label))
      .sort((a, b) => (num(b?.count) ?? 0) - (num(a?.count) ?? 0))[0];
    if (top?.label) m.specialty = String(top.label).trim();
    const er = e?.employeeReviews;
    if (er?.show === true) {
      const rating = num(er?.overallRating);
      if (rating !== undefined) m.rating = round1(rating);
      const cnt = num(er?.count);
      if (cnt !== undefined) m.reviewCount = Math.round(cnt);
    }
    const uris = e?.image?.uris;
    const photo = uris?.["256x256"] ?? uris?.["196x196"] ?? uris?.["128x128"] ?? uris?.["68x68"];
    if (typeof photo === "string") m.photoUrl = photo;
    team.push(m);
  }
  return team.length ? team : null;
}

function reputationFromState(v: any): Reputation | null {
  const r = v?.rating;
  const avg = num(r?.average) ?? num(r?.weightedAverage);
  if (avg === undefined) return null;
  const rep: Reputation = { rating: round1(avg), source: "Treatwell" };
  const cnt = num(r?.count);
  if (cnt !== undefined) rep.reviewCount = Math.round(cnt);
  return rep;
}

function reputationFromJsonLd(biz: any): Reputation | null {
  const avg = num(biz?.aggregateRating?.ratingValue);
  if (avg === undefined) return null;
  const rep: Reputation = { rating: round1(avg), source: "Treatwell" };
  const cnt = num(biz?.aggregateRating?.reviewCount);
  if (cnt !== undefined) rep.reviewCount = Math.round(cnt);
  return rep;
}

function reviewsFromState(v: any): Testimonial[] | null {
  const rv = v?.reviews;
  if (!Array.isArray(rv) || !rv.length) return null;
  const out: Testimonial[] = [];
  for (const r of rv) {
    const text = strOrNull(r?.content?.content);
    if (!text) continue;
    if (r?.content?.generated === true) continue; // skip machine-generated summaries
    const rating = num(r?.rating);
    // Curate to ≥4★ — selecting from REAL reviews is what any salon's own site
    // does (you don't put a 2★ on your marketing page); it is not fabrication.
    if (rating !== undefined && rating < 4) continue;
    const author = r?.reviewer?.anonymous
      ? "Anonieme klant"
      : strOrNull(r?.reviewer?.name)?.trim() ?? "Klant";
    const t: Testimonial = { author, quote: text.replace(/\s+/g, " ").trim(), source: "Treatwell" };
    if (rating !== undefined) t.rating = Math.max(1, Math.min(5, Math.round(rating)));
    out.push(t);
  }
  out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  // One review per NAMED author — two reviews by the same "Rik" read like a bug
  // on the opener. Generic/anonymous bylines are never collapsed. Sorted by
  // rating first, so the kept review per author is the highest-rated one.
  const GENERIC = new Set(["anonieme klant", "klant"]);
  const seenAuthors = new Set<string>();
  const deduped = out.filter((t) => {
    const key = t.author.toLowerCase();
    if (GENERIC.has(key)) return true;
    if (seenAuthors.has(key)) return false;
    seenAuthors.add(key);
    return true;
  });
  return deduped.length ? deduped.slice(0, 6) : null;
}

function photosFromState(v: any): string[] | null {
  const imgs = v?.images;
  if (!Array.isArray(imgs) || !imgs.length) return null;
  return dedupe(
    imgs
      .map((im: any) => {
        const u = im?.uris;
        return u?.["1280x800"] ?? u?.["1080x720"] ?? u?.["720x480"] ?? u?.["360x240"];
      })
      .filter((u: unknown): u is string => typeof u === "string"),
  );
}

function photosFromJsonLd(biz: any): string[] | null {
  const img = biz?.image;
  const arr = Array.isArray(img) ? img : typeof img === "string" ? [img] : [];
  const urls = arr.filter((u: unknown): u is string => typeof u === "string");
  return urls.length ? dedupe(urls) : null;
}

/** Find the salon/business node across all JSON-LD blocks (handles @graph). */
function pickBusinessNode(blocks: any[]): any | null {
  const nodes: any[] = [];
  for (const b of blocks) {
    if (Array.isArray(b?.["@graph"])) nodes.push(...b["@graph"]);
    else if (b) nodes.push(b);
  }
  return (
    nodes.find((n) => n?.aggregateRating || /salon|business|beauty/i.test(String(n?.["@type"] ?? ""))) ?? null
  );
}

function deriveTypeFromServices(services?: ServiceCategory[]): SalonBrief["type"] {
  if (!services?.length) return "hair";
  const text = services
    .flatMap((c) => [c.category, ...c.items.map((i) => i.name)])
    .join(" ")
    .toLowerCase();
  const hair = /(knip|kleur|highlight|balayage|kapsel|f[öo]hn|haar|coupe|ombre|permanent|baard|tondeuse)/.test(text);
  const beauty = /(wimper|wenkbrauw|epileren|threa|nagel|manicure|pedicure|huid|gezicht|hars|wax|make-?up|massage)/.test(text);
  if (hair && beauty) return "both";
  if (beauty && !hair) return "beauty";
  return "hair";
}

// ── primitives ──────────────────────────────────────────────────────────────

/**
 * Extract the JS object literal assigned right after `marker` via a
 * string/escape-aware balanced-brace scan. Robust to braces inside string
 * values — a naive regex would mis-match on the first `}` inside a review.
 */
function extractAssignedObject(src: string, marker: string): string | null {
  const m = src.indexOf(marker);
  if (m < 0) return null;
  let i = src.indexOf("{", m);
  if (i < 0) return null;
  const start = i;
  let depth = 0;
  let inStr = false;
  let q = "";
  let esc = false;
  for (; i < src.length; i++) {
    const ch = src.charAt(i);
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === q) inStr = false;
    } else if (ch === '"' || ch === "'") {
      inStr = true;
      q = ch;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/** Exported for reuse by the directory crawler — one balanced-brace scanner for
 * every `window.__state__` consumer. */
export function extractStateObject(html: string): any | null {
  const raw = extractAssignedObject(html, "window.__state__");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!m[1]) continue;
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* ignore a malformed block */
    }
  }
  return out;
}

function stripHtml(html: string): string {
  return String(html)
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** A "… vanaf" / "… - vanaf" name suffix — shared by the name-strip (cleanName)
 * and the from-price flag (servicesFromState) so they can never disagree. */
const VANAF_SUFFIX = /\s*-?\s*vanaf$/i;

/** Tidy a Treatwell treatment/category name: collapse spaces, drop a trailing "vanaf". */
function cleanName(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().replace(VANAF_SUFFIX, "").trim();
}

function parseEuro(x: unknown): number | undefined {
  if (typeof x === "number") return Number.isFinite(x) ? Math.round(x * 100) / 100 : undefined;
  if (typeof x === "string") {
    const n = parseFloat(x);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
  }
  return undefined;
}

function num(x: unknown): number | undefined {
  if (typeof x === "number") return Number.isFinite(x) ? x : undefined;
  if (typeof x === "string" && x.trim() !== "") {
    const n = Number(x);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function hm(t?: string): string | undefined {
  if (!t) return undefined;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : undefined;
}

function strOrNull(x: unknown): string | undefined {
  return typeof x === "string" && x.trim() !== "" ? x : undefined;
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}
