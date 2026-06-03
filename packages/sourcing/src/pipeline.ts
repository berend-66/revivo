import type { SalonBrief } from "@revivo/shared";
import { loadSourcingSettings } from "./config";
import { getPlaceDetails, searchSalonByText, type PlaceDetails, type PlacesRequestOptions } from "./places";
import { buildInstagramLight, type InstagramLight } from "./instagram";
import { placeToBrief, type PlaceToBriefOverrides } from "./places-to-brief";
import { FIXTURE_INSTAGRAM, FIXTURE_PLACE } from "./fixtures";

/**
 * The places-mode entry point: a Place ID (or a search query) in, a ready
 * `SalonBrief` out. Bundles settings → Places fetch → Instagram-light →
 * `placeToBrief`. Both the CLI and the Stage 4 sourcing cron call this.
 */

export interface InstagramHints {
  handle?: string;
  bio?: string;
  captions?: string[];
}

export interface AssembleBriefInput {
  placeId?: string;
  query?: string;
  instagram?: InstagramHints;
  overrides?: PlaceToBriefOverrides;
}

export interface AssembledBrief {
  brief: SalonBrief;
  place: PlaceDetails;
  instagram: InstagramLight;
}

async function resolvePlaceId(input: AssembleBriefInput, opts: PlacesRequestOptions): Promise<string> {
  if (input.placeId) return input.placeId;
  if (input.query) {
    const results = await searchSalonByText(input.query, opts);
    const first = results[0];
    if (!first) throw new Error(`No places found for query "${input.query}".`);
    return first.placeId;
  }
  throw new Error("places mode needs a --place-id or a --query.");
}

/** Live path — calls Google Places. Requires GOOGLE_PLACES_API_KEY. */
export async function assembleBriefFromPlaces(
  input: AssembleBriefInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AssembledBrief> {
  const settings = loadSourcingSettings(env);
  const opts: PlacesRequestOptions = {
    apiKey: settings.googlePlacesApiKey,
    languageCode: settings.languageCode,
    regionCode: settings.regionCode,
  };
  const placeId = await resolvePlaceId(input, opts);
  const place = await getPlaceDetails(placeId, opts);
  const instagram = await buildInstagramLight(
    {
      handle: input.instagram?.handle,
      websiteUri: place.websiteUri,
      bio: input.instagram?.bio,
      captions: input.instagram?.captions,
    },
    env,
  );
  const brief = placeToBrief(place, instagram, input.overrides);
  return { brief, place, instagram };
}

/** Offline path — fixture data, no network, no key. Used by `--dry-run`. */
export async function assembleBriefFromFixture(
  input: AssembleBriefInput = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<AssembledBrief> {
  const instagram = await buildInstagramLight(
    {
      handle: input.instagram?.handle ?? FIXTURE_INSTAGRAM.handle,
      bio: input.instagram?.bio ?? FIXTURE_INSTAGRAM.bio,
      captions: input.instagram?.captions ?? FIXTURE_INSTAGRAM.captions,
    },
    env,
  );
  const brief = placeToBrief(FIXTURE_PLACE, instagram, input.overrides);
  return { brief, place: FIXTURE_PLACE, instagram };
}
