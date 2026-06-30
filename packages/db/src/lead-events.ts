import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The `lead_events` table — an append-only audit log of what happened to a lead
 * and when. Mirrors supabase/migrations/20260629100100_lead_events.sql — change
 * both together.
 *
 * The leads row holds current state (status + a few milestone timestamps); this
 * holds the history those overwritten columns lose: every status change, the
 * actual opener text/channel/hook that was sent, a received reply, an operator
 * note. One row per event, never updated — it's the substrate for funnel velocity
 * and the future "which hook converts" measurement.
 */

export type LeadEventType = "status_change" | "outreach_sent" | "reply_received" | "note";

/** How an opener went out / a reply came in. Superset of the leads.outreach_channel
 * enum (which is send-only: whatsapp | instagram | email). */
export type LeadEventChannel = "whatsapp" | "instagram" | "email" | "phone" | "other";

export interface LeadEventRow {
  id: string;
  lead_id: string;
  event_type: LeadEventType;
  from_status: string | null;
  to_status: string | null;
  channel: LeadEventChannel | null;
  /** Which buildOpener hook a sent opener used (operator visibility / samey-ness check). */
  hook: string | null;
  /** The actual opener sent or reply received. */
  message_text: string | null;
  /** Full structured snapshot when useful (e.g. the whole Opener object). */
  body_json: Record<string, unknown> | null;
  /** When the event actually happened (operator may backdate). */
  occurred_at: string;
  created_at: string;
}

const TABLE = "lead_events";

export interface NewLeadEvent {
  leadId: string;
  type: LeadEventType;
  fromStatus?: string | null;
  toStatus?: string | null;
  channel?: LeadEventChannel | null;
  hook?: string | null;
  messageText?: string | null;
  body?: Record<string, unknown> | null;
  /** Defaults to now() (the DB default) when omitted. */
  occurredAt?: string;
}

/** Append one event for a lead. Append-only — there is no update/delete helper by design. */
export async function appendLeadEvent(client: SupabaseClient, input: NewLeadEvent): Promise<LeadEventRow> {
  const { data, error } = await client
    .from(TABLE)
    .insert({
      lead_id: input.leadId,
      event_type: input.type,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? null,
      channel: input.channel ?? null,
      hook: input.hook ?? null,
      message_text: input.messageText ?? null,
      body_json: input.body ?? null,
      ...(input.occurredAt !== undefined && { occurred_at: input.occurredAt }),
    })
    .select()
    .single();
  if (error) throw new Error(`appendLeadEvent(${input.leadId}) failed: ${error.message}`);
  return data as LeadEventRow;
}

/** A lead's events, most recent first — the timeline on the lead detail page. */
export async function listLeadEventsByLead(
  client: SupabaseClient,
  leadId: string,
  limit = 100,
): Promise<LeadEventRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select("*")
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listLeadEventsByLead(${leadId}) failed: ${error.message}`);
  return (data as LeadEventRow[]) ?? [];
}
