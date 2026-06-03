import type { SiteConfig } from "@revivo/shared";
import { loadMockup } from "./load-mockup";

/** Mockups change rarely; serve from edge cache and revalidate in the background. */
export const MOCKUP_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

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
