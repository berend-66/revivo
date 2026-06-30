import Link from "next/link";
import { listLeads, type LeadStatus } from "@revivo/db";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { FUNNEL_ORDER, STATUS_META, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_SET = new Set<string>(FUNNEL_ORDER);

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status && STATUS_SET.has(sp.status) ? (sp.status as LeadStatus) : undefined;
  const leads = await listLeads(db(), { status, limit: 500 });

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Leads</div>
          <h1>
            Alle <em>leads</em>
          </h1>
          <div className="sub">{leads.length} getoond{status ? ` · filter: ${STATUS_META[status].label}` : ""}</div>
        </div>
      </div>

      <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <FilterLink label="Alle" href="/leads" active={!status} />
        {FUNNEL_ORDER.map((s) => (
          <FilterLink key={s} label={STATUS_META[s].label} href={`/leads?status=${s}`} active={status === s} />
        ))}
      </div>

      <div className="card">
        {leads.length === 0 ? (
          <div className="empty">Geen leads</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Salon</th>
                <th>Stad</th>
                <th>Status</th>
                <th>Bron</th>
                <th>Verzonden</th>
                <th>Follow-up</th>
                <th>Ontdekt</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/leads/${l.id}`} className="link">
                      {l.name ?? l.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="muted">{l.city ?? "—"}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="small muted">{l.source}</td>
                  <td className="small muted">{formatDate(l.outreach_sent_at)}</td>
                  <td className="small muted">{formatDate(l.follow_up_at)}</td>
                  <td className="small muted">{formatDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} className={`btn btn-sm ${active ? "btn-primary" : ""}`}>
      {label}
    </Link>
  );
}
