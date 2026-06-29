"use server";

import { revalidatePath } from "next/cache";
import {
  markOutreachSent,
  markReplied,
  dropLead,
  resetToPending,
  setFollowUp,
  getOrCreateDealForLead,
  setDealStage,
  updateDeal,
  type OutreachChannel,
  type DealStage,
  type DealPatch,
} from "@revivo/db";
import { db } from "@/lib/db";

// Revalidate every route under the root layout — the funnel, worklist, lists and
// detail pages all read overlapping pipeline state, and at this scale a blanket
// invalidation is cheaper to reason about than per-path bookkeeping.
function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function markSentAction(
  leadId: string,
  channel?: OutreachChannel,
  hook?: string,
  messageText?: string,
): Promise<void> {
  await markOutreachSent(db(), leadId, { channel, hook, messageText });
  revalidateAll();
}

export async function markRepliedAction(leadId: string, note?: string): Promise<void> {
  await markReplied(db(), leadId, { note });
  revalidateAll();
}

export async function dropLeadAction(leadId: string, reason: string): Promise<void> {
  await dropLead(db(), leadId, reason);
  revalidateAll();
}

export async function resetToPendingAction(leadId: string): Promise<void> {
  await resetToPending(db(), leadId);
  revalidateAll();
}

export async function setFollowUpAction(leadId: string, whenIso: string | null): Promise<void> {
  await setFollowUp(db(), leadId, whenIso);
  revalidateAll();
}

export async function createDealAction(leadId: string): Promise<void> {
  await getOrCreateDealForLead(db(), leadId);
  revalidateAll();
}

export async function setDealStageAction(dealId: string, stage: DealStage, lostReason?: string): Promise<void> {
  await setDealStage(db(), dealId, stage, { lostReason });
  revalidateAll();
}

export async function updateDealAction(dealId: string, patch: DealPatch): Promise<void> {
  await updateDeal(db(), dealId, patch);
  revalidateAll();
}
