import { SalonBriefSchema, type SalonBrief } from "@revivo/shared";
import type { PlaceDetails } from "./places";
import type { InstagramLight } from "./instagram";

/**
 * placeToBrief — the bridge from "what Google/Instagram know" to "what the
 * generator needs". This is the whole point of places mode: a Place ID in, a
 * `SalonBrief` out, ready for `generateMockup`.
 *
 * Principle: pass through REAL facts (name, address, phone, hours, rating,
 * reviews, IG bio) and never invent character. The brief's free-text `vibe`
 * comes only from genuine signal (IG bio → Google's editorial blurb); if there
 * is none, we leave it empty and let the model infer from the concrete facts
 * rather than fabricating a personality. Real opening hours / phone / address
 * are handed to the model via `notes` so the mockup mirrors reality — that
 * credibility is what makes the WhatsApp opener land.
 */

const HAIR_TYPES = new Set(["hair_salon", "hair_care", "barber_shop"]);
const BEAUTY_TYPES = new Set([
  "beauty_salon",
  "nail_salon",
  "spa",
  "skin_care_clinic",
  "facial_spa",
  "wellness_center",
]);

function deriveSalonType(place: PlaceDetails): SalonBrief["type"] {
  const tags = [place.primaryType, ...place.types].filter(Boolean) as string[];
  const hasHair = tags.some((t) => HAIR_TYPES.has(t));
  const hasBeauty = tags.some((t) => BEAUTY_TYPES.has(t));
  if (hasHair && hasBeauty) return "both";
  if (hasBeauty && !hasHair) return "beauty";
  return "hair";
}

/**
 * A Dutch MOBILE number is 06 / +316 (then 8 digits). Anything else on +31 is a
 * geographic landline (e.g. +31 30 = Utrecht), which cannot host a WhatsApp
 * account — so we explicitly warn the generator not to derive contact.whatsapp
 * from it.
 */
function isDutchMobile(phone?: string): boolean {
  if (!phone) return false;
  const d = phone.replace(/[^\d+]/g, "");
  return /^(?:\+316|00316|06)\d{8}$/.test(d);
}

/** A website that is really just the Instagram profile isn't a real website. */
function hasRealWebsite(place: PlaceDetails): boolean {
  return Boolean(place.websiteUri && !/instagram\.com/i.test(place.websiteUri));
}

/** Recover the city from a Dutch formatted address ("... , 1073 AG Amsterdam, Nederland"). */
function cityFromFormattedAddress(addr?: string): string | undefined {
  if (!addr) return undefined;
  for (const part of addr.split(",")) {
    const m = part.trim().match(/^\d{4}\s?[A-Za-z]{2}\s+(.+)$/);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

export interface PlaceToBriefOverrides {
  type?: SalonBrief["type"];
  city?: string;
  vibe?: string;
  language?: SalonBrief["language"];
  preferLayout?: SalonBrief["preferLayout"];
  knownServices?: string;
  /** Extra operator notes, appended to the auto-assembled grounding block. */
  notes?: string;
}

function buildNotes(place: PlaceDetails, ig: InstagramLight | undefined, extra?: string): string | undefined {
  const blocks: string[] = [];

  const facts: string[] = [];
  if (place.primaryTypeDisplay) facts.push(`Type (Google): ${place.primaryTypeDisplay}`);
  if (typeof place.rating === "number") {
    facts.push(`Google-beoordeling: ${place.rating}★ (${place.userRatingCount ?? 0} reviews)`);
  }
  if (place.phone) facts.push(`Telefoon: ${place.phone}`);
  if (place.googleMapsUri) facts.push(`Google Maps: ${place.googleMapsUri}`);
  if (facts.length) blocks.push(facts.join("\n"));

  if (place.weekdayDescriptions.length) {
    blocks.push(`Werkelijke openingstijden (gebruik exact deze in hours):\n${place.weekdayDescriptions.join("\n")}`);
  }

  const reviewLines = place.reviews
    .filter((r) => r.text)
    .slice(0, 4)
    .map((r) => `- "${r.text!.replace(/\s+/g, " ").slice(0, 240)}"${r.rating ? ` (${r.rating}★)` : ""}`);
  if (reviewLines.length) {
    blocks.push(`Wat klanten zeggen (voor toon/stem, niet letterlijk overnemen):\n${reviewLines.join("\n")}`);
  }

  if (ig?.captions?.length) {
    blocks.push(`Instagram-captions (stem):\n${ig.captions.slice(0, 5).map((c) => `- ${c}`).join("\n")}`);
  }
  if (ig?.fullName) blocks.push(`Instagram-naam: ${ig.fullName}`);

  // Explicit guardrails so the generator can't fabricate contact channels we
  // don't actually have. These mirror the no-fabrication rules in the system
  // prompt, but stated against THIS salon's real data.
  const guards: string[] = [];
  if (place.phone && !isDutchMobile(place.phone)) {
    guards.push(
      "Het telefoonnummer is een vast nummer (geen mobiel): zet contact.whatsapp NIET — WhatsApp werkt niet op een vast nummer.",
    );
  }
  if (!hasRealWebsite(place)) {
    guards.push(
      "Deze salon heeft geen eigen website/domein bekend: verzin GEEN e-mailadres. Gebruik telefoon (en Instagram als bekend) als contact.",
    );
  }
  if (guards.length) blocks.push(`Contact-aanwijzingen:\n${guards.map((g) => `- ${g}`).join("\n")}`);

  if (extra) blocks.push(extra);

  return blocks.length ? blocks.join("\n\n") : undefined;
}

export function placeToBrief(
  place: PlaceDetails,
  ig?: InstagramLight,
  overrides: PlaceToBriefOverrides = {},
): SalonBrief {
  const city = overrides.city ?? place.city ?? cityFromFormattedAddress(place.formattedAddress);
  if (!city) {
    throw new Error(
      `Could not determine the city for "${place.name}" from Google data. ` +
        "Pass --city to override.",
    );
  }

  return SalonBriefSchema.parse({
    name: place.name,
    city,
    type: overrides.type ?? deriveSalonType(place),
    vibe: overrides.vibe ?? ig?.bio ?? place.editorialSummary,
    address: place.street ?? place.formattedAddress,
    postcode: place.postcode,
    instagram: ig?.handle,
    website: hasRealWebsite(place) ? place.websiteUri : undefined,
    knownServices: overrides.knownServices,
    language: overrides.language ?? "nl",
    preferLayout: overrides.preferLayout,
    // Real grounding so the generator copies facts instead of inventing them.
    rating: place.rating,
    reviewCount: place.userRatingCount,
    lat: place.lat,
    lng: place.lng,
    notes: buildNotes(place, ig, overrides.notes),
  } satisfies Partial<SalonBrief>);
}
