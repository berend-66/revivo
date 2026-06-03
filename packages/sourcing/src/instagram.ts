/**
 * Instagram-light — intentionally minimal.
 *
 * We do NOT scrape Instagram: unauthenticated scraping is fragile and against
 * their TOS, and authenticated scraping risks account bans. "Light" means:
 *   1. Normalise/derive the public @handle (always safe — it's just a string).
 *   2. Fold in any bio / captions a human pasted in (the operator copies these
 *      from the profile in 10 seconds).
 *   3. Leave a provider seam so a licensed 3rd-party API (e.g. a RapidAPI
 *      Instagram endpoint) can be plugged in later WITHOUT touching callers.
 *
 * The bio is genuine brand-voice signal and flows into the brief's `vibe`.
 */

export interface InstagramLight {
  handle?: string;
  fullName?: string;
  bio?: string;
  captions?: string[];
}

/**
 * Instagram URL segments that are routes, NOT profile handles. A salon's Google
 * "website" is often a post/reel/explore link; its first path segment ("p",
 * "reel", …) must never become the salon's @handle (it would render a broken
 * "@p" in the mockup footer — on the exact artifact we send to prospects).
 */
const IG_RESERVED = new Set([
  "p", "reel", "reels", "explore", "tv", "stories", "story",
  "accounts", "about", "directory", "direct", "tags", "s",
]);

/** Strip a handle from "@name", a profile URL, or bare text → "name". */
export function normalizeInstagramHandle(input?: string): string | undefined {
  if (!input) return undefined;
  let s = input.trim();
  const urlMatch = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (urlMatch?.[1]) s = urlMatch[1];
  s = s.replace(/^@/, "").replace(/\/+$/, "").trim().toLowerCase();
  // Reject empties, malformed handles, and Instagram route segments (e.g. /p/, /explore/).
  if (!s || !/^[a-z0-9._]{1,30}$/.test(s) || IG_RESERVED.has(s)) return undefined;
  return s;
}

/** If a salon's "website" is actually their Instagram, recover the handle. */
export function deriveInstagramHandle(websiteUri?: string): string | undefined {
  if (!websiteUri || !/instagram\.com/i.test(websiteUri)) return undefined;
  return normalizeInstagramHandle(websiteUri);
}

export interface InstagramInput {
  handle?: string;
  websiteUri?: string;
  fullName?: string;
  /** Pasted from the profile by the operator. */
  bio?: string;
  /** Pasted recent post captions. */
  captions?: string[];
}

/**
 * Assemble an InstagramLight from whatever's on hand, optionally enriched by a
 * configured provider. Pasted fields always win over provider fields (the human
 * looked at the actual profile).
 */
export async function buildInstagramLight(
  input: InstagramInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<InstagramLight> {
  const handle = normalizeInstagramHandle(input.handle) ?? deriveInstagramHandle(input.websiteUri);

  let provided: Partial<InstagramLight> = {};
  const provider = loadInstagramProvider(env);
  if (provider && handle) {
    try {
      provided = await provider.fetchProfile(handle);
    } catch {
      // Provider is best-effort; pasted/handle-only data is the floor.
      provided = {};
    }
  }

  const captions = input.captions?.length ? input.captions : provided.captions;
  return {
    handle,
    fullName: input.fullName ?? provided.fullName,
    bio: input.bio ?? provided.bio,
    captions: captions?.filter(Boolean),
  };
}

/**
 * The seam. A provider turns a handle into profile data via a licensed API.
 * None is wired today — `loadInstagramProvider` returns null and the pipeline
 * runs on handle + pasted data. To enable one later, implement this interface
 * and return it from `loadInstagramProvider` behind an env flag.
 */
export interface InstagramProvider {
  readonly name: string;
  fetchProfile(handle: string): Promise<Partial<InstagramLight>>;
}

export function loadInstagramProvider(env: NodeJS.ProcessEnv = process.env): InstagramProvider | null {
  const kind = env.INSTAGRAM_PROVIDER;
  if (!kind) return null;
  throw new Error(
    `INSTAGRAM_PROVIDER="${kind}" is set but no provider adapter is implemented. ` +
      "Implement the InstagramProvider interface in packages/sourcing/src/instagram.ts " +
      "and return it here, or unset INSTAGRAM_PROVIDER to run on handle + pasted data.",
  );
}
