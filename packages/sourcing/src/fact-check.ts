import type { ListingFacts, HoursRow } from "@revivo/shared";
import { treatwellListingToFacts, type RawListing } from "./treatwell";

/**
 * Cross-source fidelity check — the deterministic, non-vision backstop.
 *
 * A Treatwell page embeds the SAME salon's facts twice, independently:
 * `window.__state__` (the rich primary source — menu/team/reviews plus the
 * scalars) and a schema.org JSON-LD block (scalars only: name/geo/rating/hours/
 * photos). `treatwellListingToFacts` prefers state and falls back to JSON-LD, so
 * if a layout change silently corrupts the state parse, the shipped facts can be
 * wrong with nothing to catch it. This re-extracts each source ALONE and compares
 * them: when the two disagree on a scalar both expose, the state parse is suspect.
 *
 * This is the structured replacement for the shelved screenshot-vision comparator
 * (which measured false-positive-prone). It is pure + deterministic, makes no LLM
 * or vision call, and must NEVER import @revivo/llm — sourcing owns it.
 *
 * SCOPE: JSON-LD carries no menu/team/reviews, so this guards SCALARS only
 * (name/geo/rating/reviewCount/hours/photos). Price/menu correctness is covered by
 * the golden snapshot in `test/treatwell.test.ts`, not here. Google Places (when
 * supplied) rides along as an informational column only — cross-platform rating
 * and review pools legitimately differ, so it never drives the verdict.
 */

/** Optional Google Places scalars, shown for context — never a verdict driver. */
export interface PlaceOverlap {
  name?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviewCount?: number;
}

export type FidelityFieldName = "name" | "geo" | "rating" | "reviewCount" | "hours" | "photos";

export interface FidelityCheck {
  field: FidelityFieldName;
  stateValue: string | null;
  jsonLdValue: string | null;
  googleValue?: string | null;
  /** Both embedded sources exposed the field, so an agreement test was meaningful. */
  comparable: boolean;
  agree: boolean;
  note?: string;
}

export interface FidelityReport {
  sourceUrl: string;
  /** Both `window.__state__` and a JSON-LD business node were present. */
  crossCheckable: boolean;
  verdict: "pass" | "mismatch" | "uncheckable";
  checks: FidelityCheck[];
  /** The comparable-and-disagreeing checks — the verdict drivers. */
  mismatches: FidelityCheck[];
  summary: string;
}

// Tolerances — both sources reflect the same page snapshot, so these are tight.
const GEO_EPS = 0.002; // ~150–220 m at NL latitudes
const RATING_EPS = 0.1; // ratings are rounded to one decimal on both sides
const REVIEW_ABS = 3; // allow a tiny render-cache drift between the two blobs
const REVIEW_REL = 0.01;

/**
 * Compare the salon's facts as parsed independently from `window.__state__` and
 * from the JSON-LD block on the same page. Returns a structured, deterministic
 * report — the caller prints it (warn-not-block), like `checkAboutFidelity`.
 */
export function crossCheckListing(raw: RawListing, facts: ListingFacts, place?: PlaceOverlap): FidelityReport {
  const sourceUrl = facts.sourceUrl ?? raw.sourceUrl;
  const stateFacts = raw.state ? safeFacts({ ...raw, jsonLd: [] }) : null;
  const jsonLdFacts = raw.jsonLd.length ? safeFacts({ ...raw, state: null }) : null;

  const checks: FidelityCheck[] = [
    checkName(stateFacts, jsonLdFacts, place),
    checkGeo(stateFacts, jsonLdFacts, place),
    checkRating(stateFacts, jsonLdFacts, place),
    checkReviewCount(stateFacts, jsonLdFacts, place),
    checkHours(stateFacts, jsonLdFacts),
    checkPhotos(stateFacts, jsonLdFacts),
  ];

  const crossCheckable = stateFacts !== null && jsonLdFacts !== null;
  const mismatches = checks.filter((c) => c.comparable && !c.agree);

  let verdict: FidelityReport["verdict"];
  let summary: string;
  if (!crossCheckable) {
    verdict = "uncheckable";
    const missing = stateFacts === null ? "window.__state__" : "JSON-LD business node";
    summary = `cross-check skipped — only one embedded source present (${missing} absent)`;
  } else if (mismatches.length) {
    verdict = "mismatch";
    summary = `state ↔ JSON-LD disagree on: ${mismatches.map((m) => m.field).join(", ")}`;
  } else {
    const n = checks.filter((c) => c.comparable).length;
    verdict = "pass";
    summary = `state ↔ JSON-LD agree on ${n} scalar field(s)`;
  }

  return { sourceUrl, crossCheckable, verdict, checks, mismatches, summary };
}

/** treatwellListingToFacts but never throws — a parse failure means "no view". */
function safeFacts(raw: RawListing): ListingFacts | null {
  try {
    return treatwellListingToFacts(raw);
  } catch {
    return null;
  }
}

function onlyNote(stateHas: boolean, jsonLdHas: boolean): string | undefined {
  if (stateHas && !jsonLdHas) return "alleen in window.__state__";
  if (!stateHas && jsonLdHas) return "alleen in JSON-LD";
  if (!stateHas && !jsonLdHas) return "in geen van beide bronnen";
  return undefined;
}

function checkName(state: ListingFacts | null, jsonLd: ListingFacts | null, place?: PlaceOverlap): FidelityCheck {
  const s = state?.name;
  const j = jsonLd?.name;
  const comparable = s !== undefined && j !== undefined;
  const norm = (x?: string) => x?.toLowerCase().replace(/\s+/g, " ").trim();
  return {
    field: "name",
    stateValue: s ?? null,
    jsonLdValue: j ?? null,
    googleValue: place?.name ?? undefined,
    comparable,
    agree: comparable ? norm(s) === norm(j) : true,
    note: onlyNote(s !== undefined, j !== undefined),
  };
}

function checkGeo(state: ListingFacts | null, jsonLd: ListingFacts | null, place?: PlaceOverlap): FidelityCheck {
  const sLat = state?.lat;
  const sLng = state?.lng;
  const jLat = jsonLd?.lat;
  const jLng = jsonLd?.lng;
  const sHas = sLat !== undefined && sLng !== undefined;
  const jHas = jLat !== undefined && jLng !== undefined;
  const comparable = sHas && jHas;
  const agree =
    !comparable ||
    (Math.abs((sLat as number) - (jLat as number)) <= GEO_EPS &&
      Math.abs((sLng as number) - (jLng as number)) <= GEO_EPS);
  const fmt = (a?: number, b?: number) => (a !== undefined && b !== undefined ? `${a.toFixed(5)}, ${b.toFixed(5)}` : null);
  return {
    field: "geo",
    stateValue: fmt(sLat, sLng),
    jsonLdValue: fmt(jLat, jLng),
    googleValue: fmt(place?.lat, place?.lng) ?? undefined,
    comparable,
    agree,
    note: onlyNote(sHas, jHas),
  };
}

function checkRating(state: ListingFacts | null, jsonLd: ListingFacts | null, place?: PlaceOverlap): FidelityCheck {
  const s = state?.reputation?.rating;
  const j = jsonLd?.reputation?.rating;
  const comparable = s !== undefined && j !== undefined;
  return {
    field: "rating",
    stateValue: s !== undefined ? s.toFixed(1) : null,
    jsonLdValue: j !== undefined ? j.toFixed(1) : null,
    googleValue: place?.rating !== undefined ? place.rating.toFixed(1) : undefined,
    comparable,
    agree: comparable ? Math.abs((s as number) - (j as number)) <= RATING_EPS : true,
    note: onlyNote(s !== undefined, j !== undefined),
  };
}

function checkReviewCount(state: ListingFacts | null, jsonLd: ListingFacts | null, place?: PlaceOverlap): FidelityCheck {
  const s = state?.reputation?.reviewCount;
  const j = jsonLd?.reputation?.reviewCount;
  const comparable = s !== undefined && j !== undefined;
  const tol = comparable ? Math.max(REVIEW_ABS, Math.ceil(REVIEW_REL * Math.max(s as number, j as number))) : 0;
  return {
    field: "reviewCount",
    stateValue: s !== undefined ? String(s) : null,
    jsonLdValue: j !== undefined ? String(j) : null,
    googleValue: place?.reviewCount !== undefined ? String(place.reviewCount) : undefined,
    comparable,
    agree: comparable ? Math.abs((s as number) - (j as number)) <= tol : true,
    note: onlyNote(s !== undefined, j !== undefined),
  };
}

/** Normalised weekly schedule string — both sources go through the same hour helpers. */
function schedule(rows?: HoursRow[]): string | null {
  if (!rows?.length) return null;
  return rows.map((r) => `${r.day.slice(0, 2)}:${r.closed ? "dicht" : `${r.open}-${r.close}`}`).join(" ");
}

function checkHours(state: ListingFacts | null, jsonLd: ListingFacts | null): FidelityCheck {
  const s = schedule(state?.hours);
  const j = schedule(jsonLd?.hours);
  const comparable = s !== null && j !== null;
  return {
    field: "hours",
    stateValue: s,
    jsonLdValue: j,
    comparable,
    agree: comparable ? s === j : true,
    note: onlyNote(s !== null, j !== null),
  };
}

function checkPhotos(state: ListingFacts | null, jsonLd: ListingFacts | null): FidelityCheck {
  const sN = state?.photos?.length ?? 0;
  const jN = jsonLd?.photos?.length ?? 0;
  // If JSON-LD lists images, state should too; if JSON-LD has none there is
  // nothing to assert (state is the richer source for photos).
  const comparable = jN > 0;
  return {
    field: "photos",
    stateValue: String(sN),
    jsonLdValue: String(jN),
    comparable,
    agree: comparable ? sN > 0 : true,
    note: comparable ? undefined : "geen foto's in JSON-LD om tegen te toetsen",
  };
}
