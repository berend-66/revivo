import Link from "next/link";
import {
  leadStatusCounts,
  listLeads,
  listJobsByStatus,
  dealStageCounts,
  wonRevenueCents,
} from "@revivo/db";
import { db } from "@/lib/db";
import { tolerant, isPending } from "@/lib/safe";
import { MigrationNotice } from "@/components/MigrationNotice";
import { FUNNEL_ORDER, STATUS_META, formatEuros, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const EMPTY_DEAL_COUNTS = { reply: 0, call_booked: 0, call_held: 0, proposal_sent: 0, won: 0, lost: 0 };

export default async function FunnelPage() {
  const client = db();
  const [counts, leads, pendingJobs, runningJobs, failedJobs, succeededJobs, dealCountsRaw, revenueRaw] =
    await Promise.all([
      leadStatusCounts(client),
      listLeads(client, { limit: 1000 }),
      listJobsByStatus(client, "pending", 1000),
      listJobsByStatus(client, "running", 1000),
      listJobsByStatus(client, "failed", 1000),
      listJobsByStatus(client, "succeeded", 1000),
      tolerant(dealStageCounts(client)),
      tolerant(wonRevenueCents(client)),
    ]);

  // deals table may not be migrated yet — degrade instead of 500-ing the home page
  const dealsPending = isPending(dealCountsRaw) || isPending(revenueRaw);
  const dealCounts = isPending(dealCountsRaw) ? EMPTY_DEAL_COUNTS : dealCountsRaw;
  const revenue = isPending(revenueRaw) ? 0 : revenueRaw;

  const total = FUNNEL_ORDER.reduce((s, k) => s + counts[k], 0);
  const generatedPlus = counts.mockup_generated + counts.needs_review + counts.outreach_sent + counts.replied;
  const contacted = counts.outreach_sent + counts.replied;

  // by-city / by-source tallies
  const byCity = tally(leads.map((l) => l.city ?? "— onbekend"));
  const bySource = tally(leads.map((l) => l.source));

  const maxCount = Math.max(1, ...FUNNEL_ORDER.map((k) => counts[k]));

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Operator</div>
          <h1>
            Outreach <em>funnel</em>
          </h1>
          <div className="sub">{total} leads in de pipeline · live uit Supabase</div>
        </div>
      </div>

      <section className="stat-grid" style={{ marginBottom: 24 }}>
        <Link href="/outreach" className="stat accent">
          <span className="num">{counts.mockup_generated}</span>
          <span className="label">Klaar om te sturen</span>
        </Link>
        <div className="stat">
          <span className="num">{counts.outreach_sent}</span>
          <span className="label">Verzonden</span>
        </div>
        <Link href="/deals" className="stat">
          <span className="num">{counts.replied}</span>
          <span className="label">Beantwoord</span>
        </Link>
        <Link href="/review" className="stat">
          <span className="num">{counts.needs_review}</span>
          <span className="label">Needs review</span>
        </Link>
        <Link href="/deals" className="stat accent">
          <span className="num">{dealsPending ? "—" : formatEuros(revenue)}</span>
          <span className="label">Omzet (gewonnen)</span>
        </Link>
      </section>

      {dealsPending && (
        <div style={{ marginBottom: 18 }}>
          <MigrationNotice />
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Funnel</h3>
            <span className="small muted">huidige status</span>
          </div>
          <div className="card-body stack" style={{ gap: 10 }}>
            {FUNNEL_ORDER.map((k) => (
              <div key={k} className="row" style={{ gap: 12 }}>
                <span style={{ width: 110, flex: "none" }} className="small">
                  {STATUS_META[k].label}
                </span>
                <div className="bar" style={{ flex: 1 }}>
                  <span style={{ width: `${(counts[k] / maxCount) * 100}%` }} />
                </div>
                <span style={{ width: 34, textAlign: "right" }} className="mono">
                  {counts[k]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Conversie</h3>
              <span className="small muted">benadering (huidige status)</span>
            </div>
            <div className="card-body">
              <dl className="kv">
                <dt>Mockup-gen geslaagd</dt>
                <dd>
                  {generatedPlus} van {total} leads
                </dd>
                <dt>Verzondratio</dt>
                <dd>{pct(contacted, generatedPlus)} van klaargezette mockups</dd>
                <dt>Reply-ratio</dt>
                <dd>
                  {pct(counts.replied, contacted)} van {contacted} verzonden
                </dd>
              </dl>
              <p className="small muted" style={{ marginTop: 10 }}>
                Exacte cumulatieve ratio&apos;s volgen uit <span className="mono">lead_events</span> zodra er
                meer historie is — dit is de momentopname.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Queue</h3>
              <Link href="/jobs" className="small" style={{ color: "var(--bordeaux)" }}>
                monitor →
              </Link>
            </div>
            <div className="card-body">
              <div className="row" style={{ gap: 18 }}>
                <JobStat n={pendingJobs.length} label="pending" />
                <JobStat n={runningJobs.length} label="running" />
                <JobStat n={succeededJobs.length} label="succeeded" />
                <JobStat n={failedJobs.length} label="failed" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Deals</h3>
              <Link href="/deals" className="small" style={{ color: "var(--bordeaux)" }}>
                board →
              </Link>
            </div>
            <div className="card-body">
              {dealsPending ? (
                <MigrationNotice compact />
              ) : (
                <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
                  <JobStat n={dealCounts.reply} label="reply" />
                  <JobStat n={dealCounts.call_booked + dealCounts.call_held} label="call" />
                  <JobStat n={dealCounts.proposal_sent} label="voorstel" />
                  <JobStat n={dealCounts.won} label="gewonnen" />
                  <JobStat n={dealCounts.lost} label="verloren" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <BreakdownCard title="Per stad" rows={byCity} />
        <BreakdownCard title="Per bron" rows={bySource} />
      </div>
    </main>
  );
}

function JobStat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: "1.4rem", color: "var(--ink)" }}>
        {n}
      </div>
      <div className="small muted">{label}</div>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
      </div>
      <div className="card-body">
        {rows.length === 0 ? (
          <div className="empty">Geen data</div>
        ) : (
          <table className="table">
            <tbody>
              {rows.map(([k, n]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td style={{ textAlign: "right" }} className="mono">
                    {n}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function tally(values: string[]): [string, number][] {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
