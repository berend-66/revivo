import Link from "next/link";
import { listDeals, listLeads, wonRevenueCents, DEAL_STAGES, type DealRow, type DealStage } from "@revivo/db";
import { db } from "@/lib/db";
import { tolerant, isPending } from "@/lib/safe";
import { MigrationNotice } from "@/components/MigrationNotice";
import { formatEuros, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<DealStage, string> = {
  reply: "Reactie",
  call_booked: "Call gepland",
  call_held: "Call gehad",
  proposal_sent: "Voorstel",
  won: "Gewonnen",
  lost: "Verloren",
};

export default async function DealsPage() {
  const client = db();
  const [dealsRaw, leads, revenueRaw] = await Promise.all([
    tolerant(listDeals(client, { limit: 500 })),
    listLeads(client, { limit: 1000 }),
    tolerant(wonRevenueCents(client)),
  ]);

  if (isPending(dealsRaw) || isPending(revenueRaw)) {
    return (
      <main className="container">
        <div className="page-head">
          <div>
            <div className="eyebrow">Sales</div>
            <h1>
              Deals <em>pipeline</em>
            </h1>
          </div>
        </div>
        <MigrationNotice />
      </main>
    );
  }
  const deals = dealsRaw;
  const revenue = revenueRaw;

  const nameById = new Map(leads.map((l) => [l.id, l.name ?? l.city ?? l.id.slice(0, 8)]));
  const byStage = new Map<DealStage, DealRow[]>(DEAL_STAGES.map((s) => [s, []]));
  for (const d of deals) byStage.get(d.stage)?.push(d);

  // SLA over delivered won deals
  const slas = deals
    .filter((d) => d.build_started_at && d.delivered_at)
    .map((d) => (new Date(d.delivered_at as string).getTime() - new Date(d.build_started_at as string).getTime()) / 86_400_000);
  const avgSla = slas.length ? (slas.reduce((a, b) => a + b, 0) / slas.length).toFixed(1) : null;

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Sales</div>
          <h1>
            Deals <em>pipeline</em>
          </h1>
          <div className="sub">{deals.length} deal(s) in de pipeline</div>
        </div>
      </div>

      <section className="stat-grid" style={{ marginBottom: 22 }}>
        <div className="stat accent">
          <span className="num">{formatEuros(revenue)}</span>
          <span className="label">Omzet gewonnen</span>
        </div>
        <div className="stat">
          <span className="num">{byStage.get("won")?.length ?? 0}</span>
          <span className="label">Gewonnen deals</span>
        </div>
        <div className="stat">
          <span className="num">{(byStage.get("reply")?.length ?? 0) + (byStage.get("call_booked")?.length ?? 0) + (byStage.get("call_held")?.length ?? 0) + (byStage.get("proposal_sent")?.length ?? 0)}</span>
          <span className="label">Open deals</span>
        </div>
        <div className="stat">
          <span className="num">{avgSla ?? "—"}</span>
          <span className="label">Gem. SLA (dagen)</span>
        </div>
      </section>

      <div className="row" style={{ gap: 12, alignItems: "stretch", overflowX: "auto", paddingBottom: 8 }}>
        {DEAL_STAGES.map((stage) => {
          const col = byStage.get(stage) ?? [];
          return (
            <div key={stage} className="card" style={{ minWidth: 220, flex: "1 0 220px" }}>
              <div className="card-head">
                <h3 style={{ fontSize: "1rem" }}>{STAGE_LABEL[stage]}</h3>
                <span className="small muted">{col.length}</span>
              </div>
              <div className="card-body stack" style={{ gap: 8 }}>
                {col.length === 0 ? (
                  <span className="small dim">—</span>
                ) : (
                  col.map((d) => (
                    <div key={d.id} style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "8px 10px" }}>
                      {d.lead_id ? (
                        <Link href={`/leads/${d.lead_id}`} className="link" style={{ color: "var(--bordeaux)", fontWeight: 600, fontSize: "0.85rem" }}>
                          {nameById.get(d.lead_id) ?? d.lead_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="small muted">lead verwijderd</span>
                      )}
                      <div className="small muted" style={{ marginTop: 3 }}>
                        {formatEuros(d.amount_cents)}
                        {stage === "lost" && d.lost_reason ? ` · ${d.lost_reason}` : ""}
                        {stage === "won" && d.won_at ? ` · ${formatDate(d.won_at)}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
