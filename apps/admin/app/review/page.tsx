import Link from "next/link";
import { listLeadsByStatus, listJobsByStatus, getLeadById } from "@revivo/db";
import { db } from "@/lib/db";
import { resetToPendingAction } from "@/app/actions";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const client = db();
  const [parked, failed] = await Promise.all([
    listLeadsByStatus(client, "needs_review", 200),
    listJobsByStatus(client, "failed", 100),
  ]);
  const failedWithLead = await Promise.all(
    failed.map(async (job) => ({ job, lead: await getLeadById(client, job.lead_id) })),
  );

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Operator-aandacht</div>
          <h1>
            Needs <em>review</em>
          </h1>
          <div className="sub">
            {parked.length} geparkeerde lead(s) · {failed.length} mislukte job(s)
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h3>Geparkeerde leads</h3>
          <span className="small muted">gate-bevinding of uitgeputte job — fix de oorzaak, zet terug op pending</span>
        </div>
        {parked.length === 0 ? (
          <div className="empty">Niets te reviewen 🎉</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Salon</th>
                <th>Stad</th>
                <th>Reden</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parked.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/leads/${l.id}`} className="link">
                      {l.name ?? l.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="muted">{l.city ?? "—"}</td>
                  <td className="small" style={{ color: "var(--warn)" }}>
                    {l.review_reason ?? "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <form action={resetToPendingAction.bind(null, l.id)}>
                      <button type="submit" className="btn btn-sm">
                        Reset → pending
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Mislukte jobs</h3>
          <span className="small muted">attempts uitgeput — geen auto-retry</span>
        </div>
        {failedWithLead.length === 0 ? (
          <div className="empty">Geen mislukte jobs</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Salon</th>
                <th>Pogingen</th>
                <th>Laatste fout</th>
                <th>Afgerond</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {failedWithLead.map(({ job, lead }) => (
                <tr key={job.id}>
                  <td>
                    {lead ? (
                      <Link href={`/leads/${lead.id}`} className="link">
                        {lead.name ?? lead.id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="muted mono">{job.lead_id.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="mono">{job.attempt_count}</td>
                  <td className="small muted">{job.last_error ?? "—"}</td>
                  <td className="small muted">{formatDateTime(job.completed_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    {lead && (
                      <form action={resetToPendingAction.bind(null, lead.id)}>
                        <button type="submit" className="btn btn-sm">
                          Reset lead → pending
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
