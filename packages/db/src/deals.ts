import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The `deals` table — the sales pipeline PAST first reply. The leads funnel ends
 * at 'replied'; from there a prospect moves through call → proposal → won/lost, and
 * a won deal carries revenue (the €999 price) and delivery/SLA timing. Mirrors
 * supabase/migrations/20260629100200_deals.sql — change both together.
 *
 * Delivery/SLA fields (build_started_at, delivered_at) live here rather than a
 * separate `customers` table — at this scale one pipeline table is the boring
 * choice; split `customers` out later if deliveries need their own entity.
 */

export type DealStage = "reply" | "call_booked" | "call_held" | "proposal_sent" | "won" | "lost";

/** Stages still in play (not won/lost) — the active board columns. */
export const OPEN_DEAL_STAGES: DealStage[] = ["reply", "call_booked", "call_held", "proposal_sent"];
export const DEAL_STAGES: DealStage[] = [...OPEN_DEAL_STAGES, "won", "lost"];

export interface DealRow {
  id: string;
  /** Nullable (on delete set null): a won deal / its revenue outlives a lead delete. */
  lead_id: string | null;
  stage: DealStage;
  /** Money in integer cents (€999 → 99900). */
  amount_cents: number | null;
  currency: string;
  /** Only meaningful with stage = 'lost'. */
  lost_reason: string | null;
  call_booked_at: string | null;
  call_held_at: string | null;
  proposal_sent_at: string | null;
  won_at: string | null;
  lost_at: string | null;
  /** Delivery / 5-werkdagen SLA on a won deal: SLA = delivered_at − build_started_at. */
  build_started_at: string | null;
  delivered_at: string | null;
  cal_com_url: string | null;
  stripe_payment_link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "deals";

/** Which timestamp column a stage stamps when first entered. 'reply' uses created_at. */
const STAGE_TIMESTAMP: Partial<Record<DealStage, keyof DealRow>> = {
  call_booked: "call_booked_at",
  call_held: "call_held_at",
  proposal_sent: "proposal_sent_at",
  won: "won_at",
  lost: "lost_at",
};

/** The most recent deal for a lead, or null. Normally 0 or 1 — getOrCreateDealForLead
 * keeps it to one per lead. */
export async function getDealByLeadId(client: SupabaseClient, leadId: string): Promise<DealRow | null> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getDealByLeadId(${leadId}) failed: ${error.message}`);
  return (data as DealRow | null) ?? null;
}

export interface GetOrCreateDealResult {
  created: boolean;
  deal: DealRow;
}

/** Return the lead's existing deal, or create one at stage 'reply'. Idempotent —
 * called when a lead is marked 'replied' so the pipeline always has a row to move. */
export async function getOrCreateDealForLead(
  client: SupabaseClient,
  leadId: string,
  init: { amountCents?: number } = {},
): Promise<GetOrCreateDealResult> {
  const existing = await getDealByLeadId(client, leadId);
  if (existing) return { created: false, deal: existing };
  const { data, error } = await client
    .from(TABLE)
    .insert({
      lead_id: leadId,
      stage: "reply",
      ...(init.amountCents !== undefined && { amount_cents: init.amountCents }),
    })
    .select()
    .single();
  if (error) throw new Error(`getOrCreateDealForLead(${leadId}) failed: ${error.message}`);
  return { created: true, deal: data as DealRow };
}

/** Move a deal to a stage, stamping that stage's timestamp the FIRST time it's
 * reached (so velocity reflects the original transition, not a re-entry). */
export async function setDealStage(
  client: SupabaseClient,
  dealId: string,
  stage: DealStage,
  opts: { lostReason?: string } = {},
): Promise<DealRow> {
  const patch: Record<string, unknown> = { stage };
  if (opts.lostReason !== undefined) patch.lost_reason = opts.lostReason;
  const col = STAGE_TIMESTAMP[stage];
  if (col) {
    const { data: current, error: readError } = await client
      .from(TABLE)
      .select(col)
      .eq("id", dealId)
      .maybeSingle();
    if (readError) throw new Error(`setDealStage(${dealId}) read failed: ${readError.message}`);
    if (!current || (current as Record<string, unknown>)[col] == null) {
      patch[col] = new Date().toISOString();
    }
  }
  const { data, error } = await client.from(TABLE).update(patch).eq("id", dealId).select().single();
  if (error) throw new Error(`setDealStage(${dealId} → ${stage}) failed: ${error.message}`);
  return data as DealRow;
}

/** Patch arbitrary deal fields (amount, currency, refs, notes, delivery dates). */
export type DealPatch = Partial<
  Pick<
    DealRow,
    | "amount_cents"
    | "currency"
    | "lost_reason"
    | "build_started_at"
    | "delivered_at"
    | "cal_com_url"
    | "stripe_payment_link"
    | "notes"
  >
>;

export async function updateDeal(client: SupabaseClient, dealId: string, patch: DealPatch): Promise<DealRow> {
  const { data, error } = await client.from(TABLE).update(patch).eq("id", dealId).select().single();
  if (error) throw new Error(`updateDeal(${dealId}) failed: ${error.message}`);
  return data as DealRow;
}

/** Deals, newest first, optionally filtered by stage — the board / list. */
export async function listDeals(
  client: SupabaseClient,
  opts: { stage?: DealStage; limit?: number } = {},
): Promise<DealRow[]> {
  let query = client.from(TABLE).select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 200);
  if (opts.stage) query = query.eq("stage", opts.stage);
  const { data, error } = await query;
  if (error) throw new Error(`listDeals failed: ${error.message}`);
  return (data as DealRow[]) ?? [];
}

export type DealStageCounts = Record<DealStage, number>;

/** Tally deals by stage — for the board headers and the funnel summary. */
export async function dealStageCounts(client: SupabaseClient): Promise<DealStageCounts> {
  const { data, error } = await client.from(TABLE).select("stage");
  if (error) throw new Error(`dealStageCounts failed: ${error.message}`);
  const counts: DealStageCounts = {
    reply: 0,
    call_booked: 0,
    call_held: 0,
    proposal_sent: 0,
    won: 0,
    lost: 0,
  };
  for (const row of (data as { stage: DealStage }[]) ?? []) {
    if (row.stage in counts) counts[row.stage]++;
  }
  return counts;
}

/** Total realized revenue: sum of amount_cents over won deals. */
export async function wonRevenueCents(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.from(TABLE).select("amount_cents").eq("stage", "won");
  if (error) throw new Error(`wonRevenueCents failed: ${error.message}`);
  return ((data as { amount_cents: number | null }[]) ?? []).reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);
}
