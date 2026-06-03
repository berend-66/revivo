import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SiteConfigSchema, type SiteConfig } from "@revivo/shared";
import { createServiceClientOrNull, getMockupBySlug } from "@revivo/db";

/**
 * Dual-source mockup loader. In production, mockups come from Supabase. Before a
 * Supabase project exists (dev), it falls back to the customer-template's local
 * example/generated JSON files keyed by slug — so the SSR app is runnable and
 * screenshot-verifiable today, and flips to the DB the moment SUPABASE_URL is set.
 *
 * Either way the result is validated against SiteConfigSchema before it renders:
 * an LLM-produced row that drifted from the contract must fail loudly, not paint
 * a broken page.
 */

const SLUG_RE = /^[a-z0-9-]+$/;

// cwd is the app dir under `astro dev`/`astro build`. The local fallback is a dev
// aid (production reads Supabase); override with REVIVO_EXAMPLES_DIR if needed.
function examplesDir(): string {
  return process.env.REVIVO_EXAMPLES_DIR ?? resolve(process.cwd(), "../customer-template/examples");
}

export async function loadMockup(slug: string): Promise<SiteConfig | null> {
  if (!SLUG_RE.test(slug)) return null;

  const client = createServiceClientOrNull();
  if (client) {
    const row = await getMockupBySlug(client, slug);
    return row ? SiteConfigSchema.parse(row.config_json) : null;
  }

  // Local fallback: examples/generated/<slug>.json (freshest) then examples/<slug>.json.
  const base = examplesDir();
  for (const rel of [`generated/${slug}.json`, `${slug}.json`]) {
    const path = resolve(base, rel);
    if (existsSync(path)) {
      return SiteConfigSchema.parse(JSON.parse(readFileSync(path, "utf-8")));
    }
  }
  return null;
}
