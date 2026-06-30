import type { LeadStatus } from "@revivo/db";

const eur = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Integer cents → "€ 999" (or "—" when unset). */
export function formatEuros(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return eur.format(cents / 100);
}

const dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateFmt.format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateTimeFmt.format(new Date(iso));
}

/** Whole days since an ISO timestamp (negative if in the future), or null. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** "vandaag" / "3 dagen geleden" / "over 2 dagen". */
export function relativeDays(iso: string | null | undefined): string {
  const d = daysSince(iso);
  if (d == null) return "—";
  if (d === 0) return "vandaag";
  if (d > 0) return `${d} ${d === 1 ? "dag" : "dagen"} geleden`;
  const a = -d;
  return `over ${a} ${a === 1 ? "dag" : "dagen"}`;
}

/** A percentage from a ratio, guarding divide-by-zero. */
export function pct(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export type Tone = "neutral" | "info" | "warn" | "accent" | "good" | "muted" | "violet";

/** Display label + colour tone per lead status. tone maps to a CSS class in StatusBadge. */
export const STATUS_META: Record<LeadStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  qualified: { label: "Qualified", tone: "neutral" },
  mockup_generated: { label: "Mockup ready", tone: "info" },
  needs_review: { label: "Needs review", tone: "warn" },
  outreach_sent: { label: "Sent", tone: "violet" },
  replied: { label: "Replied", tone: "good" },
  dropped: { label: "Dropped", tone: "muted" },
};

/** Bar/accent colour per status — colour-codes the funnel rows. */
export const STATUS_COLOR: Record<LeadStatus, string> = {
  pending: "#94a3b8",
  qualified: "#94a3b8",
  mockup_generated: "#2563eb",
  needs_review: "#d97706",
  outreach_sent: "#6d28d9",
  replied: "#047857",
  dropped: "#be123c",
};

/** Funnel order for rendering status rows consistently. */
export const FUNNEL_ORDER: LeadStatus[] = [
  "pending",
  "qualified",
  "mockup_generated",
  "needs_review",
  "outreach_sent",
  "replied",
  "dropped",
];
