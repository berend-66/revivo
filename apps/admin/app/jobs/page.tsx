import Link from "next/link";
import { listJobsByStatus, listLeads, type JobRow } from "@revivo/db";
import { db } from "@/lib/db";
import { formatDateTime, relativeDays } from "@/lib/format";

export const dynamic = "force-dynamic";

function isDue(job: JobRow): boolean {
  return !job.next_retry_at || new Date(job.next_retry_at).getTime() <= Date.now();
}

export default async function JobsPage() {
  const client = db();
  const [pending, running, failed, succeeded, leads] = await Promise.all([
    listJobsByStatus(client, "pending", 1000),
    listJobsByStatus(client, "running", 1000),
    listJobsByStatus(client, "failed", 1000),
    listJobsByStatus(client, "succeeded", 1000),
    listLeads(client, { limit: 1000 }),
  ]);
  const name = (id: string) => leads.find((l) => l.id === id)?.name ?? id.slice(0, 8);

  const due = pending.filter(isDue).length;

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Batch worker</div>
          <h1>
            Job <em>queue</em>
          </h1>
          <div className="sub">de gepollde Postgres-queue die generate-pending leegt</div>
        </div>
      </div>

      <section className="stat-grid" style={{ marginBottom: 22 }}>
        <div className="stat accent">
          <span className="num">{due}</span>
          <span className="label">Pending (due)</span>
        </div>
        <div className="stat">
          <span className="num">{pending.length - due}</span>
          <span className="label">Pending (backoff)</span>
        </div>
        <div className="stat">
          <span className="num">{running.length}</span>
          <span className="label">Running</span>
        </div>
        <div className="stat">
          <span className="num">{failed.length}</span>
          <span className="label">Failed</span>
        </div>
        <div className="stat">
          <span className="num">{succeeded.length}</span>
          <span className="label">Succeeded</span>
        </div>
      </section>

      {running.length > 0 && (
        <JobTable
          title="Running"
          note="een vastgelopen worker laat hier een rij staan — handmatig re-queuen (geen reaper op deze schaal)"
          jobs={running}
          name={name}
          columns="running"
        />
      )}

      <JobTable title="Pending" jobs={pending} name={name} columns="pending" />

      {failed.length > 0 && <JobTable title="Failed" jobs={failed} name={name} columns="failed" />}

      <JobTable title="Recent succeeded" jobs={succeeded.slice(0, 20)} name={name} columns="succeeded" />
    </main>
  );
}

function JobTable({
  title,
  note,
  jobs,
  name,
  columns,
}: {
  title: string;
  note?: string;
  jobs: JobRow[];
  name: (id: string) => string;
  columns: "pending" | "running" | "failed" | "succeeded";
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h3>{title}</h3>
        {note ? <span className="small muted">{note}</span> : <span className="small muted">{jobs.length}</span>}
      </div>
      {jobs.length === 0 ? (
        <div className="empty">Leeg</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Salon</th>
              <th>Pogingen</th>
              {columns === "pending" && <th>Volgende poging</th>}
              {columns === "failed" && <th>Laatste fout</th>}
              {(columns === "failed" || columns === "succeeded" || columns === "running") && <th>Afgerond</th>}
              <th>Aangemaakt</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>
                  <Link href={`/leads/${j.lead_id}`} className="link">
                    {name(j.lead_id)}
                  </Link>
                </td>
                <td className="mono">{j.attempt_count}</td>
                {columns === "pending" && (
                  <td className="small muted">
                    {!j.next_retry_at || new Date(j.next_retry_at).getTime() <= Date.now() ? (
                      <span style={{ color: "var(--good)" }}>due nu</span>
                    ) : (
                      formatDateTime(j.next_retry_at)
                    )}
                  </td>
                )}
                {columns === "failed" && <td className="small muted">{j.last_error ?? "—"}</td>}
                {(columns === "failed" || columns === "succeeded" || columns === "running") && (
                  <td className="small muted">{formatDateTime(j.completed_at)}</td>
                )}
                <td className="small muted">{relativeDays(j.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
