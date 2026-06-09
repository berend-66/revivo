import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingFacts } from "@revivo/shared";

/**
 * The `leads` table — prospect salons discovered by sourcing (Stage 4). Mirrors
 * supabase/migrations/20260609100000_leads_jobs.sql (+ 20260609100200, which adds
 * the 'needs_review' status and review_reason) — change both together.
 *
 * Dedup is per source (partial unique indexes): `listing_url` for marketplace,
 * `place_id` for google_places. PostgREST cannot target a partial unique index
 * via on_conflict, so `insertLeadIfNew` is select-then-insert with the unique
 * index as the race backstop (a 23505 means another writer got there first).
 */

export type LeadSource = "marketplace" | "google_places";

export type LeadStatus =
  | "pending" // discovered, nothing done yet
  | "qualified" // passed qualification (KvK SBI filter — roadmap D1)
  | "mockup_generated" // a mockups row exists for this lead
  | "needs_review" // parked for the operator (gate finding / job exhausted); see review_reason
  | "outreach_sent" // opener sent (WhatsApp/IG/email)
  | "replied" // the salon answered — operator takes over
  | "dropped"; // out of funnel; see drop_reason

export interface LeadRow {
  id: string;
  source: LeadSource;
  /** Dedup key when source = "marketplace": the salon's public listing URL. */
  listing_url: string | null;
  /** Dedup key when source = "google_places". */
  place_id: string | null;
  /** The crawl/search query that surfaced this lead. */
  query_text: string | null;
  name: string | null;
  city: string | null;
  postcode: string | null;
  /** KvK enrichment (roadmap D1) — null until then. */
  kvk_number: string | null;
  sbi_code: string | null;
  /** ListingFacts snapshot, filled at generation time. */
  listing_facts_json: ListingFacts | null;
  /** Google Place details snapshot, when sourced via Places. */
  place_details_json: Record<string, unknown> | null;
  status: LeadStatus;
  drop_reason: string | null;
  /** Why the lead is parked when status = "needs_review" (gate findings or the
   * terminal job error). Cleared when a later clean run moves the lead on. */
  review_reason: string | null;
  /** RESERVED, currently unused — lead-level scheduling (D1 KvK retry, outreach
   * follow-ups). Job execution backoff lives on jobs.next_retry_at, not here. */
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "leads";

export interface NewLead {
  source: LeadSource;
  /** Required when source = "marketplace" (the dedup key). */
  listingUrl?: string;
  /** Required when source = "google_places" (the dedup key). */
  placeId?: string;
  queryText?: string;
  name?: string;
  city?: string;
  postcode?: string;
}

export interface InsertLeadResult {
  /** False when the dedup key already existed — `lead` is then the existing row. */
  inserted: boolean;
  lead: LeadRow;
}

function dedupKey(input: NewLead): { column: "listing_url" | "place_id"; value: string } {
  if (input.source === "marketplace") {
    if (!input.listingUrl) throw new Error("insertLeadIfNew: a marketplace lead needs listingUrl");
    return { column: "listing_url", value: input.listingUrl };
  }
  if (!input.placeId) throw new Error("insertLeadIfNew: a google_places lead needs placeId");
  return { column: "place_id", value: input.placeId };
}

async function findByDedupKey(
  client: SupabaseClient,
  source: LeadSource,
  key: { column: "listing_url" | "place_id"; value: string },
): Promise<LeadRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("source", source)
    .eq(key.column, key.value)
    .maybeSingle();
  if (error) throw new Error(`leads lookup by ${key.column} failed: ${error.message}`);
  return (data as LeadRow | null) ?? null;
}

/** Insert a lead unless its dedup key already exists; idempotent, race-safe via
 * the partial unique index. Returns the existing row when skipped. */
export async function insertLeadIfNew(client: SupabaseClient, input: NewLead): Promise<InsertLeadResult> {
  const key = dedupKey(input);
  const existing = await findByDedupKey(client, input.source, key);
  if (existing) return { inserted: false, lead: existing };

  const { data, error } = await client
    .from(TABLE)
    .insert({
      source: input.source,
      listing_url: input.listingUrl ?? null,
      place_id: input.placeId ?? null,
      query_text: input.queryText ?? null,
      name: input.name ?? null,
      city: input.city ?? null,
      postcode: input.postcode ?? null,
    })
    .select()
    .single();
  if (error) {
    // 23505 = unique violation: another writer inserted between our select and
    // insert. The partial unique index is the real dedup guarantee.
    if (error.code === "23505") {
      const raced = await findByDedupKey(client, input.source, key);
      if (raced) return { inserted: false, lead: raced };
    }
    throw new Error(`insertLeadIfNew(${key.value}) failed: ${error.message}`);
  }
  return { inserted: true, lead: data as LeadRow };
}

/** Fetch one lead by id, or null. */
export async function getLeadById(client: SupabaseClient, id: string): Promise<LeadRow | null> {
  const { data, error } = await client.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getLeadById(${id}) failed: ${error.message}`);
  return (data as LeadRow | null) ?? null;
}

/** Leads in a given status, oldest first (the worklist order). */
export async function listLeadsByStatus(
  client: SupabaseClient,
  status: LeadStatus,
  limit = 100,
): Promise<LeadRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listLeadsByStatus(${status}) failed: ${error.message}`);
  return (data as LeadRow[]) ?? [];
}

/** Move a lead through the funnel. `dropReason` only means something with "dropped";
 * `reviewReason` with "needs_review" (pass `null` to clear a stale one on a clean run). */
export async function setLeadStatus(
  client: SupabaseClient,
  id: string,
  status: LeadStatus,
  opts: { dropReason?: string; reviewReason?: string | null; listingFacts?: ListingFacts } = {},
): Promise<LeadRow> {
  const patch: Record<string, unknown> = { status };
  if (opts.dropReason !== undefined) patch.drop_reason = opts.dropReason;
  if (opts.reviewReason !== undefined) patch.review_reason = opts.reviewReason;
  if (opts.listingFacts !== undefined) patch.listing_facts_json = opts.listingFacts;
  const { data, error } = await client.from(TABLE).update(patch).eq("id", id).select().single();
  if (error) throw new Error(`setLeadStatus(${id} → ${status}) failed: ${error.message}`);
  return data as LeadRow;
}
