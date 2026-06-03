/**
 * Sourcing configuration — where env vars become settings.
 *
 * Only the Google Places key is required for places mode. The Instagram
 * provider is optional (see instagram.ts) and the generator never needs a key.
 */

export interface SourcingSettings {
  googlePlacesApiKey: string;
  /** ISO-639 language for Places results + copy hints. */
  languageCode: string;
  /** CLDR region bias — keeps results to the Netherlands. */
  regionCode: string;
}

export function loadSourcingSettings(env: NodeJS.ProcessEnv = process.env): SourcingSettings {
  const googlePlacesApiKey = env.GOOGLE_PLACES_API_KEY ?? "";
  if (!googlePlacesApiKey) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY is not set. Create a key in Google Cloud Console, enable " +
        "'Places API (New)', and add it to .env. For an offline run use --dry-run (fixture data).",
    );
  }
  return {
    googlePlacesApiKey,
    languageCode: env.GOOGLE_PLACES_LANGUAGE ?? "nl",
    regionCode: env.GOOGLE_PLACES_REGION ?? "NL",
  };
}
