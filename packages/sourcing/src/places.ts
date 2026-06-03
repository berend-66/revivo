/**
 * Google Places API (New) client — the data spine of places mode.
 *
 * Uses the *new* Places API (`places.googleapis.com/v1`), not the legacy
 * `maps.googleapis.com/maps/api/place` endpoints (which Google is winding down).
 * Auth is header-based (`X-Goog-Api-Key`) with an explicit field mask per call —
 * field masks are mandatory on the new API and also cap billing to the SKUs we
 * actually read.
 *
 * No SDK: a couple of `fetch` calls is less surface than pulling in
 * googleapis. Node 20+ has global fetch.
 */

const PLACES_BASE = "https://places.googleapis.com/v1";

/** Fields we read for a full salon detail lookup. */
const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "regularOpeningHours",
  "rating",
  "userRatingCount",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "editorialSummary",
  "reviews",
  "photos",
].join(",");

export interface PlacesRequestOptions {
  apiKey: string;
  languageCode?: string;
  regionCode?: string;
}

export interface PlaceReview {
  author?: string;
  rating?: number;
  text?: string;
}

/** Normalised, salon-relevant slice of a Places detail response. */
export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress?: string;
  street?: string;
  postcode?: string;
  city?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  /** Google's localized day strings, e.g. "maandag: Gesloten". */
  weekdayDescriptions: string[];
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  primaryTypeDisplay?: string;
  types: string[];
  /** Google's own one-line editorial blurb, when it has one. Real voice signal. */
  editorialSummary?: string;
  reviews: PlaceReview[];
  /** Opaque photo resource names ("places/.../photos/..."); resolve via placePhotoMediaUrl. */
  photoNames: string[];
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  formattedAddress?: string;
  primaryType?: string;
}

interface RawAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

function pickComponent(components: RawAddressComponent[], type: string): RawAddressComponent | undefined {
  return components.find((c) => c.types?.includes(type));
}

function normalizeDetails(raw: Record<string, any>): PlaceDetails {
  const components: RawAddressComponent[] = Array.isArray(raw.addressComponents) ? raw.addressComponents : [];
  const route = pickComponent(components, "route")?.longText;
  const streetNumber = pickComponent(components, "street_number")?.longText;
  const street = [route, streetNumber].filter(Boolean).join(" ") || undefined;
  const postcode = pickComponent(components, "postal_code")?.longText;
  const city =
    pickComponent(components, "locality")?.longText ??
    pickComponent(components, "postal_town")?.longText ??
    pickComponent(components, "administrative_area_level_2")?.longText;

  const reviews: PlaceReview[] = Array.isArray(raw.reviews)
    ? raw.reviews.slice(0, 6).map((r: any) => ({
        author: r?.authorAttribution?.displayName,
        rating: typeof r?.rating === "number" ? r.rating : undefined,
        text: r?.text?.text ?? r?.originalText?.text,
      }))
    : [];

  return {
    placeId: raw.id,
    name: raw.displayName?.text ?? raw.name ?? "Onbekende salon",
    formattedAddress: raw.formattedAddress,
    street,
    postcode,
    city,
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
    phone: raw.internationalPhoneNumber ?? raw.nationalPhoneNumber,
    websiteUri: raw.websiteUri,
    googleMapsUri: raw.googleMapsUri,
    weekdayDescriptions: Array.isArray(raw.regularOpeningHours?.weekdayDescriptions)
      ? raw.regularOpeningHours.weekdayDescriptions
      : [],
    rating: typeof raw.rating === "number" ? raw.rating : undefined,
    userRatingCount: typeof raw.userRatingCount === "number" ? raw.userRatingCount : undefined,
    primaryType: raw.primaryType,
    primaryTypeDisplay: raw.primaryTypeDisplayName?.text,
    types: Array.isArray(raw.types) ? raw.types : [],
    editorialSummary: raw.editorialSummary?.text,
    reviews,
    photoNames: Array.isArray(raw.photos)
      ? raw.photos.map((p: any) => p?.name).filter((n: unknown): n is string => typeof n === "string")
      : [],
  };
}

async function placesFetch(
  url: string,
  fieldMask: string,
  opts: PlacesRequestOptions,
  init?: RequestInit,
): Promise<Record<string, any>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": opts.apiKey,
      "X-Goog-FieldMask": fieldMask,
      ...init?.headers,
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    const reason = json?.error?.message ?? json?.error?.status ?? res.statusText;
    throw new Error(`Places API ${res.status}: ${reason}`);
  }
  return json;
}

/** Full salon detail by Place ID. */
export async function getPlaceDetails(placeId: string, opts: PlacesRequestOptions): Promise<PlaceDetails> {
  const params = new URLSearchParams();
  if (opts.languageCode) params.set("languageCode", opts.languageCode);
  if (opts.regionCode) params.set("regionCode", opts.regionCode);
  const url = `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?${params.toString()}`;
  const raw = await placesFetch(url, DETAILS_FIELD_MASK, opts);
  return normalizeDetails(raw);
}

/**
 * Text search → candidate places. Use to resolve a salon by name+city into a
 * Place ID when you don't have one (e.g. `--query "Lume Atelier Amsterdam"`).
 */
export async function searchSalonByText(
  query: string,
  opts: PlacesRequestOptions,
): Promise<PlaceSearchResult[]> {
  const fieldMask = ["places.id", "places.displayName", "places.formattedAddress", "places.primaryType"].join(",");
  const raw = await placesFetch(`${PLACES_BASE}/places:searchText`, fieldMask, opts, {
    method: "POST",
    body: JSON.stringify({
      textQuery: query,
      languageCode: opts.languageCode,
      regionCode: opts.regionCode,
      maxResultCount: 5,
    }),
  });
  const places: any[] = Array.isArray(raw.places) ? raw.places : [];
  return places.map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? "",
    formattedAddress: p.formattedAddress,
    primaryType: p.primaryType,
  }));
}

/**
 * Build a Places Photo media URL. NOTE: the media endpoint requires the API key
 * as a query param, so the resulting URL embeds the key — do NOT persist these
 * in a public mockup config. The mockup generator discards image URLs anyway
 * (it uses deterministic placeholders); real photos are resolved in a later,
 * server-side stage. Provided for that future use.
 */
export function placePhotoMediaUrl(
  photoName: string,
  opts: { apiKey: string; maxWidthPx?: number; maxHeightPx?: number },
): string {
  const params = new URLSearchParams({ key: opts.apiKey });
  if (opts.maxWidthPx) params.set("maxWidthPx", String(opts.maxWidthPx));
  if (opts.maxHeightPx) params.set("maxHeightPx", String(opts.maxHeightPx));
  return `${PLACES_BASE}/${photoName}/media?${params.toString()}`;
}
