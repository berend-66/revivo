import Link from "next/link";
import { listRecentMockups } from "@revivo/db";
import { db } from "@/lib/db";
import { mockUrlForSlug } from "@/lib/mock-url";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MockupsPage() {
  const mockups = await listRecentMockups(db(), 100);

  const variants = tally(mockups.map((m) => m.layout_variant));
  const stubs = mockups.filter((m) => m.model === "dry-run-stub").length;

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">QA</div>
          <h1>
            Mockups <em>gallery</em>
          </h1>
          <div className="sub">
            {mockups.length} mockups · {stubs} stub(s) · varianten {variants.map(([v, n]) => `${v} ${n}`).join(" / ")}
          </div>
        </div>
      </div>

      <div className="card">
        {mockups.length === 0 ? (
          <div className="empty">Nog geen mockups</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Variant</th>
                <th>Model</th>
                <th>Bron</th>
                <th>Lead</th>
                <th>Aangemaakt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mockups.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.slug}</td>
                  <td>{m.layout_variant}</td>
                  <td className="small muted">
                    {m.model === "dry-run-stub" ? <span className="badge badge-warn">stub</span> : m.model ?? "—"}
                  </td>
                  <td className="small muted">{m.source}</td>
                  <td>
                    {m.lead_id ? (
                      <Link href={`/leads/${m.lead_id}`} className="link">
                        lead ↗
                      </Link>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                  <td className="small muted">{formatDate(m.created_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    <a className="btn btn-sm" href={mockUrlForSlug(m.slug)} target="_blank" rel="noreferrer">
                      Open ↗
                    </a>
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

function tally(values: string[]): [string, number][] {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
