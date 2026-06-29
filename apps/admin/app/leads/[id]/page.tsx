import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadById, getMockupsByLeadId, getDealByLeadId, listLeadEventsByLead } from "@revivo/db";
import { SiteConfigSchema, buildOpener, type ListingFacts } from "@revivo/shared";
import { db } from "@/lib/db";
import { tolerant, isPending } from "@/lib/safe";
import { MigrationNotice } from "@/components/MigrationNotice";
import { mockUrlForSlug } from "@/lib/mock-url";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusControls } from "@/components/StatusControls";
import { DealPanel } from "@/components/DealPanel";
import { OpenerCard } from "@/components/OpenerCard";
import { formatEuros, formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = db();
  const lead = await getLeadById(client, id);
  if (!lead) notFound();

  const [mockups, dealRaw, eventsRaw] = await Promise.all([
    getMockupsByLeadId(client, id),
    tolerant(getDealByLeadId(client, id)),
    tolerant(listLeadEventsByLead(client, id, 50)),
  ]);
  // deals / lead_events may not be migrated yet — degrade rather than 500
  const dealsPending = isPending(dealRaw) || isPending(eventsRaw);
  const deal = isPending(dealRaw) ? null : dealRaw;
  const events = isPending(eventsRaw) ? [] : eventsRaw;

  const mockup = mockups.find((m) => m.model !== "dry-run-stub") ?? mockups[0] ?? null;
  const parsed = mockup && mockup.model !== "dry-run-stub" ? SiteConfigSchema.safeParse(mockup.config_json) : null;
  const mockUrl = mockup ? mockUrlForSlug(mockup.slug) : null;
  const opener =
    parsed?.success && mockUrl ? buildOpener({ config: parsed.data, mockUrl, facts: lead.listing_facts_json }) : null;
  const facts = lead.listing_facts_json;

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Link href="/leads" style={{ color: "var(--bordeaux)" }}>
              ← Leads
            </Link>
          </div>
          <h1>{lead.name ?? "Naamloze lead"}</h1>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <StatusBadge status={lead.status} />
            <span className="muted">{lead.city ?? "—"}</span>
            <span className="small muted">{lead.source}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* LEFT — read */}
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Lead</h3>
            </div>
            <div className="card-body">
              <dl className="kv">
                {lead.listing_url && (
                  <>
                    <dt>Listing</dt>
                    <dd>
                      <a className="link" href={lead.listing_url} target="_blank" rel="noreferrer" style={{ color: "var(--bordeaux)" }}>
                        Treatwell ↗
                      </a>
                    </dd>
                  </>
                )}
                {lead.postcode && (
                  <>
                    <dt>Postcode</dt>
                    <dd>{lead.postcode}</dd>
                  </>
                )}
                {lead.query_text && (
                  <>
                    <dt>Query</dt>
                    <dd className="small">{lead.query_text}</dd>
                  </>
                )}
                <dt>Ontdekt</dt>
                <dd>{formatDate(lead.created_at)}</dd>
                <dt>Verzonden</dt>
                <dd>
                  {formatDateTime(lead.outreach_sent_at)}
                  {lead.outreach_channel ? ` · ${lead.outreach_channel}` : ""}
                  {lead.outreach_hook ? ` · hook ${lead.outreach_hook}` : ""}
                </dd>
                <dt>Beantwoord</dt>
                <dd>{formatDateTime(lead.replied_at)}</dd>
                <dt>Follow-up</dt>
                <dd>{formatDate(lead.follow_up_at)}</dd>
                {lead.review_reason && (
                  <>
                    <dt>Review reden</dt>
                    <dd className="small" style={{ color: "var(--warn)" }}>
                      {lead.review_reason}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Mockup</h3>
              {mockup && mockUrl && (
                <a className="btn btn-sm" href={mockUrl} target="_blank" rel="noreferrer">
                  Open ↗
                </a>
              )}
            </div>
            <div className="card-body">
              {!mockup ? (
                <div className="empty">Nog geen mockup gegenereerd.</div>
              ) : (
                <>
                  <dl className="kv">
                    <dt>Slug</dt>
                    <dd className="mono">{mockup.slug}</dd>
                    <dt>Variant</dt>
                    <dd>{mockup.layout_variant}</dd>
                    <dt>Model</dt>
                    <dd className="small">{mockup.model ?? "—"}</dd>
                  </dl>
                  {mockUrl && (
                    <details style={{ marginTop: 12 }}>
                      <summary className="btn btn-sm" style={{ display: "inline-flex" }}>
                        Voorbeeld inladen
                      </summary>
                      <iframe
                        src={mockUrl}
                        title="mockup preview"
                        loading="lazy"
                        style={{ width: "100%", height: 460, border: "1px solid var(--border)", borderRadius: 4, marginTop: 10, background: "#fff" }}
                      />
                    </details>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Opener</h3>
            </div>
            <div className="card-body">
              {opener ? (
                <OpenerCard
                  leadId={lead.id}
                  hook={opener.hook}
                  whatsappUrl={opener.whatsappUrl}
                  igDmText={opener.igDmText}
                  emailSubject={opener.emailSubject}
                  emailBody={opener.emailBody}
                  plainText={opener.plainText}
                />
              ) : (
                <div className="empty">Geen verzendbare opener (geen geldige mockup).</div>
              )}
            </div>
          </div>

          <ListingFactsCard facts={facts} />
        </div>

        {/* RIGHT — act */}
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Status</h3>
            </div>
            <div className="card-body">
              <StatusControls lead={lead} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Deal</h3>
              {deal && <span className="small muted">{formatEuros(deal.amount_cents)}</span>}
            </div>
            <div className="card-body">
              {dealsPending ? <MigrationNotice compact /> : <DealPanel leadId={lead.id} deal={deal} />}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Tijdlijn</h3>
              <span className="small muted">{events.length} events</span>
            </div>
            <div className="card-body">
              {events.length === 0 ? (
                <div className="empty">Nog geen events</div>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  {events.map((e) => (
                    <div key={e.id} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                      <span className="small mono muted nowrap" style={{ width: 92, flex: "none" }}>
                        {formatDateTime(e.occurred_at)}
                      </span>
                      <span className="small">
                        <strong>{e.event_type}</strong>
                        {e.from_status || e.to_status ? ` · ${e.from_status ?? "?"} → ${e.to_status ?? "?"}` : ""}
                        {e.channel ? ` · ${e.channel}` : ""}
                        {e.hook ? ` · hook ${e.hook}` : ""}
                        {e.message_text ? (
                          <span className="muted"> — {e.message_text.slice(0, 80)}</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ListingFactsCard({ facts }: { facts: ListingFacts | null }) {
  if (!facts) {
    return (
      <div className="card">
        <div className="card-head">
          <h3>Listing-facts</h3>
        </div>
        <div className="card-body">
          <div className="empty">Geen scraped facts opgeslagen.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-head">
        <h3>Listing-facts</h3>
        {facts.reputation && (
          <span className="tag">
            {String(facts.reputation.rating).replace(".", ",")}★
            {facts.reputation.reviewCount ? ` · ${facts.reputation.reviewCount}` : ""}
          </span>
        )}
      </div>
      <div className="card-body stack" style={{ gap: 14 }}>
        {facts.services && facts.services.length > 0 && (
          <div>
            <div className="field">Menu</div>
            {facts.services.slice(0, 4).map((cat) => (
              <div key={cat.category} style={{ marginTop: 6 }}>
                <div className="small" style={{ fontWeight: 600 }}>
                  {cat.category}
                </div>
                {cat.items.slice(0, 5).map((it, idx) => (
                  <div key={idx} className="row spread small muted" style={{ borderBottom: "1px solid var(--border)", padding: "3px 0" }}>
                    <span>{it.name}</span>
                    <span className="mono">{it.price == null ? "—" : `${it.from ? "vanaf " : ""}€${it.price}`}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {facts.team && facts.team.length > 0 && (
          <div>
            <div className="field">Team</div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {facts.team.map((m, i) => (
                <span key={i} className="tag">
                  {m.name}
                  {m.role ? ` · ${m.role}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {facts.reviews && facts.reviews.length > 0 && (
          <div>
            <div className="field">Reviews</div>
            <div className="stack" style={{ gap: 6, marginTop: 4 }}>
              {facts.reviews.slice(0, 3).map((r, i) => (
                <div key={i} className="small">
                  <span className="muted">“{r.quote.slice(0, 120)}”</span>{" "}
                  <span className="dim">— {r.author}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {facts.photos && facts.photos.length > 0 && (
          <div>
            <div className="field">Foto&apos;s ({facts.photos.length})</div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {facts.photos.slice(0, 6).map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={p}
                  alt=""
                  style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 3, border: "1px solid var(--border)" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
