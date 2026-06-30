import type { SiteConfig } from "@revivo/shared";
import { loadMockup } from "./load-mockup";

/** Mockups change rarely; serve from edge cache and revalidate in the background. */
export const MOCKUP_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

/**
 * A mockup publicly republishes someone else's brand, photos, team names and
 * reviews at a capability-gated URL — it must NEVER be indexed (GDPR/IP posture,
 * docs/OUTREACH.md §2). This is set as an HTTP response header rather than a
 * <meta> tag because the render goes through the SAME customer-template variant
 * Layouts the REAL customer sites use, where indexing IS wanted — so the noindex
 * must live at the mock app's HTTP layer, not in the shared component. The header
 * is the load-bearing de-index guarantee (honored on any fetch); public/robots.txt
 * is the politeness layer on top. The slug stays the capability (RLS service-role
 * only; mockups aren't enumerable).
 */
export const MOCKUP_ROBOTS = "noindex, nofollow";

/** Headers every successfully-rendered mockup response carries. */
export function setMockupHeaders(response: Response): void {
  response.headers.set("Cache-Control", MOCKUP_CACHE_CONTROL);
  response.headers.set("X-Robots-Tag", MOCKUP_ROBOTS);
}

/**
 * Resolve the config a per-variant render page should draw, guarding that its
 * layout matches the page. `preloaded` is the dispatcher's lookup passed via
 * Astro.locals (so a normal request reads the mockup once); a direct hit on
 * /v/<variant>/<slug> falls back to its own lookup. A layout mismatch → null
 * (404), so /v/neon/<an-atelier-slug> can't render the wrong skin.
 */
export async function resolveForVariant(
  preloaded: SiteConfig | undefined,
  slug: string | undefined,
  layout: SiteConfig["layout"],
): Promise<SiteConfig | null> {
  const config = preloaded ?? (slug ? await loadMockup(slug) : null);
  return config && config.layout === layout ? config : null;
}
