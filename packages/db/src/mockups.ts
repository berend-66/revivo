import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalonBrief, SiteConfig } from "@revivo/shared";

/**
 * The `mockups` table — one row per generated salon mockup, surfaced at
 * mock.revivo.nl/{slug}. Mirrors supabase/migrations/20260603093000_mockups.sql. If you
 * change the columns, change BOTH (and regenerate types with `supabase gen types`
 * once that workflow is set up).
 */

// "listing" = sourced from a public salon listing (Treatwell): real menu/prices/
// team/hours/reviews/photos. See migration 20260603120000_mockups_source_listing.sql.
// "marketplace" = batch-generated from a marketplace lead (leads table, Stage 4) —
// same listing data path, different provenance. See 20260609100100_mockups_marketplace_lead_fk.sql.
export type MockupSource = "manual" | "places" | "listing" | "marketplace";

export interface MockupRow {
  id: string;
  slug: string;
  /** FK to leads (on delete set null). Null for standalone (manual/places/listing) mockups. */
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
 * a salon overwrites its row in place (so its mock.revivo.nl URL stays stable).
 *
 * Generation fields (config/layout/brief/model) always reflect the latest run.
 * Provenance fields (source, lead_id, place_id, deploy_url) are only written when
 * explicitly passed — PostgREST's merge-upsert leaves omitted columns untouched, so
 * an operator CLI re-run can't silently sever a batch-created lead→mockup link or
 * null a deploy URL. On a fresh insert, omitted columns take the SQL defaults
 * (source 'manual', rest null). */
export async function upsertMockupBySlug(client: SupabaseClient, input: MockupUpsert): Promise<MockupRow> {
  const row = {
    slug: input.slug,
    layout_variant: input.config.layout,
    config_json: input.config,
    brief_json: input.brief ?? null,
    model: input.model ?? null,
    ...(input.source !== undefined && { source: input.source }),
    ...(input.leadId !== undefined && { lead_id: input.leadId }),
    ...(input.placeId !== undefined && { place_id: input.placeId }),
    ...(input.deployUrl !== undefined && { deploy_url: input.deployUrl }),
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
