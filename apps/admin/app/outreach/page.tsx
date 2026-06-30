import Link from "next/link";
import { listLeadsByStatus, getMockupsByLeadId } from "@revivo/db";
import { SiteConfigSchema, buildOpener } from "@revivo/shared";
import { db } from "@/lib/db";
import { mockUrlForSlug } from "@/lib/mock-url";
import { OpenerCard } from "@/components/OpenerCard";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const client = db();
  const leads = await listLeadsByStatus(client, "mockup_generated", 200);

  const items = await Promise.all(
    leads.map(async (lead) => {
      const mockups = await getMockupsByLeadId(client, lead.id);
      // Prefer a real (non-stub) mockup; skip the same rows build-openers skips.
      const mockup = mockups.find((m) => m.model !== "dry-run-stub") ?? mockups[0] ?? null;
      if (!mockup || mockup.model === "dry-run-stub") {
        return { lead, skip: "geen echte mockup (stub of ontbreekt)" } as const;
      }
      const parsed = SiteConfigSchema.safeParse(mockup.config_json);
      if (!parsed.success) {
        return { lead, skip: "config_json faalt SiteConfig-validatie" } as const;
      }
      const mockUrl = mockUrlForSlug(mockup.slug);
      const opener = buildOpener({
        config: parsed.data,
        mockUrl,
        facts: lead.listing_facts_json,
        noWebsite: lead.has_website === false,
      });
      return { lead, mockup, mockUrl, opener } as const;
    }),
  );

  const ready = items.filter((i): i is Extract<(typeof items)[number], { opener: unknown }> => "opener" in i);
  const skipped = items.filter((i): i is Extract<(typeof items)[number], { skip: string }> => "skip" in i);

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Worklist</div>
          <h1>
            Klaar om te <em>versturen</em>
          </h1>
          <div className="sub">
            {ready.length} mockup{ready.length === 1 ? "" : "s"} klaar · openers via dezelfde builder als de CLI
          </div>
        </div>
      </div>

      {ready.length === 0 ? (
        <div className="card pad empty">
          Geen leads in <span className="mono">mockup_generated</span>. Draai{" "}
          <span className="mono">pnpm generate-pending</span> om de queue te legen.
        </div>
      ) : (
        <div className="stack">
          {ready.map((i) => (
            <div key={i.lead.id} className="card">
              <div className="card-head">
                <div>
                  <Link href={`/leads/${i.lead.id}`} className="link" style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {i.lead.name ?? i.mockup.slug}
                  </Link>
                  <span className="small muted"> · {i.lead.city ?? "—"}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <a className="btn btn-sm" href={i.mockUrl} target="_blank" rel="noreferrer">
                    Bekijk mockup ↗
                  </a>
                  <span className="tag">{i.mockup.layout_variant}</span>
                </div>
              </div>
              <div className="card-body">
                <OpenerCard
                  leadId={i.lead.id}
                  hook={i.opener.hook}
                  whatsappUrl={i.opener.whatsappUrl}
                  igDmText={i.opener.igDmText}
                  emailSubject={i.opener.emailSubject}
                  emailBody={i.opener.emailBody}
                  plainText={i.opener.plainText}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {skipped.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-head">
            <h3>Overgeslagen</h3>
            <span className="small muted">{skipped.length} lead(s) — niet verzendbaar</span>
          </div>
          <div className="card-body">
            <table className="table">
              <tbody>
                {skipped.map((i) => (
                  <tr key={i.lead.id}>
                    <td>
                      <Link href={`/leads/${i.lead.id}`} className="link">
                        {i.lead.name ?? i.lead.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="muted">{i.lead.city ?? "—"}</td>
                    <td className="small muted">{i.skip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
