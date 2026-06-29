import type { LeadStatus } from "@revivo/db";
import { STATUS_META, type Tone } from "@/lib/format";

/** Coloured pill for a lead status. Pure (no client JS). */
export function StatusBadge({ status }: { status: LeadStatus | string }) {
  const meta = STATUS_META[status as LeadStatus] ?? { label: String(status), tone: "neutral" as Tone };
  return <span className={`badge badge-${meta.tone}`}>{meta.label}</span>;
}
