import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalonBrief, SiteConfig } from "@revivo/shared";

/**
 * The `mockups` table — one row per generated salon mockup, surfaced at
 * mock.revivo.nl/{slug}. Mirrors supabase/migrations/20260603093000_mockups.sql. If you
 * change the columns, change BOTH (and regenerate types with `supabase gen types`
 * once that workflow is set up).
 */

export type MockupSource = "manual" | "places";

export interface MockupRow {
  id: string;
  slug: string;
  /** FK to leads, added in Stage 4. Null for standalone (manual/places) mockups. */
  lead_id: string | null;
  /** Google Place id when generated via places mode. */
  place_id: string | null;
  source: MockupSource;
  layout_variant: SiteConfig["layout"];
  config_json: SiteConfig;
  brief_json: SalonBrief | null;
  deploy_url: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "mockups";

export interface MockupUpsert {
  slug: string;
  config: SiteConfig;
  source?: MockupSource;
  leadId?: string | null;
  placeId?: string | null;
  brief?: SalonBrief | null;
  model?: string | null;
  deployUrl?: string | null;
}

/** Insert or replace the mockup for a slug. `slug` is the natural key — regenerating
 * a salon overwrites its row in place (so its mock.revivo.nl URL stays stable). */
export async function upsertMockupBySlug(client: SupabaseClient, input: MockupUpsert): Promise<MockupRow> {
  const row = {
    slug: input.slug,
    source: input.source ?? "manual",
    lead_id: input.leadId ?? null,
    place_id: input.placeId ?? null,
    layout_variant: input.config.layout,
    config_json: input.config,
    brief_json: input.brief ?? null,
    model: input.model ?? null,
    deploy_url: input.deployUrl ?? null,
  };
  const { data, error } = await client
    .from(TABLE)
    .upsert(row, { onConflict: "slug" })
    .select()
    .single();
  if (error) throw new Error(`upsertMockupBySlug(${input.slug}) failed: ${error.message}`);
  return data as MockupRow;
}

/** Fetch one mockup by slug, or null if it doesn't exist. */
export async function getMockupBySlug(client: SupabaseClient, slug: string): Promise<MockupRow | null> {
  const { data, error } = await client.from(TABLE).select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`getMockupBySlug(${slug}) failed: ${error.message}`);
  return (data as MockupRow | null) ?? null;
}

/** Recent mockups, newest first — for an admin index later. */
export async function listRecentMockups(client: SupabaseClient, limit = 50): Promise<MockupRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentMockups failed: ${error.message}`);
  return (data as MockupRow[]) ?? [];
}
