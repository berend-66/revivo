"use client";

import { useState, useTransition } from "react";
import type { DealRow, DealStage } from "@revivo/db";
import { DEAL_STAGES } from "@revivo/db";
import { createDealAction, setDealStageAction, updateDealAction } from "@/app/actions";

const STAGE_LABEL: Record<DealStage, string> = {
  reply: "Reactie",
  call_booked: "Call gepland",
  call_held: "Call gehad",
  proposal_sent: "Voorstel",
  won: "Gewonnen",
  lost: "Verloren",
};

function slaDays(deal: DealRow): number | null {
  if (!deal.build_started_at || !deal.delivered_at) return null;
  return Math.round((new Date(deal.delivered_at).getTime() - new Date(deal.build_started_at).getTime()) / 86_400_000);
}

// DealPanel calls NO hooks itself, so the early return is safe; each child owns
// its own useTransition / useState (rules-of-hooks compliant).
export function DealPanel({ leadId, deal }: { leadId: string; deal: DealRow | null }) {
  if (!deal) return <CreateDeal leadId={leadId} />;
  return <DealEditor deal={deal} />;
}

function CreateDeal({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="small muted">Nog geen deal voor deze lead.</p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => start(() => createDealAction(leadId))}
      >
        {pending ? "Bezig…" : "Start deal"}
      </button>
    </div>
  );
}

function DealEditor({ deal }: { deal: DealRow }) {
  const [pending, start] = useTransition();
  const [lostReason, setLostReason] = useState(deal.lost_reason ?? "");
  const [amount, setAmount] = useState(deal.amount_cents != null ? String(deal.amount_cents / 100) : "999");
  const [calUrl, setCalUrl] = useState(deal.cal_com_url ?? "");
  const [stripeUrl, setStripeUrl] = useState(deal.stripe_payment_link ?? "");
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [buildStarted, setBuildStarted] = useState(deal.build_started_at ? deal.build_started_at.slice(0, 10) : "");
  const [delivered, setDelivered] = useState(deal.delivered_at ? deal.delivered_at.slice(0, 10) : "");

  function moveTo(stage: DealStage) {
    start(() => setDealStageAction(deal.id, stage, stage === "lost" ? lostReason || undefined : undefined));
  }

  function saveDetails() {
    const raw = amount.trim();
    const amountCents = raw === "" || !Number.isFinite(Number(raw)) ? null : Math.round(Number(raw) * 100);
    start(() =>
      updateDealAction(deal.id, {
        amount_cents: amountCents,
        cal_com_url: calUrl || null,
        stripe_payment_link: stripeUrl || null,
        notes: notes || null,
        build_started_at: buildStarted ? new Date(buildStarted).toISOString() : null,
        delivered_at: delivered ? new Date(delivered).toISOString() : null,
      }),
    );
  }

  const sla = slaDays(deal);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 6 }}>
        {DEAL_STAGES.map((s) => (
          <button
            key={s}
            type="button"
            className={`btn btn-sm ${s === deal.stage ? "btn-primary" : ""}`}
            disabled={pending}
            onClick={() => moveTo(s)}
          >
            {STAGE_LABEL[s]}
          </button>
        ))}
      </div>

      {deal.stage === "lost" || lostReason ? (
        <div className="stack" style={{ gap: 4 }}>
          <label className="field">Reden verloren</label>
          <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="reden" />
        </div>
      ) : null}

      <div className="divider" />

      <div className="grid grid-2" style={{ gap: 12 }}>
        <div>
          <label className="field">Bedrag (€)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="field">SLA</label>
          <div className="small" style={{ paddingTop: 7 }}>
            {sla == null ? "—" : `${sla} dagen (doel ≤ 5)`}
          </div>
        </div>
        <div>
          <label className="field">Cal.com URL</label>
          <input value={calUrl} onChange={(e) => setCalUrl(e.target.value)} placeholder="https://cal.com/revivo/…" />
        </div>
        <div>
          <label className="field">Stripe payment link</label>
          <input value={stripeUrl} onChange={(e) => setStripeUrl(e.target.value)} placeholder="https://buy.stripe.com/…" />
        </div>
        <div>
          <label className="field">Build gestart</label>
          <input type="date" value={buildStarted} onChange={(e) => setBuildStarted(e.target.value)} />
        </div>
        <div>
          <label className="field">Opgeleverd</label>
          <input type="date" value={delivered} onChange={(e) => setDelivered(e.target.value)} />
        </div>
      </div>

      <div className="stack" style={{ gap: 4 }}>
        <label className="field">Notities</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button type="button" className="btn btn-primary" disabled={pending} onClick={saveDetails}>
        {pending ? "Bezig…" : "Deal opslaan"}
      </button>
    </div>
  );
}
