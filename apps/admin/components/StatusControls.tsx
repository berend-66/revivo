"use client";

import { useState, useTransition } from "react";
import type { LeadRow } from "@revivo/db";
import {
  markRepliedAction,
  dropLeadAction,
  resetToPendingAction,
  setFollowUpAction,
} from "@/app/actions";

/** Operator status controls for a single lead (detail page). Mark-sent lives on the
 * OpenerCard; this covers the rest of the lifecycle + follow-up scheduling. */
export function StatusControls({ lead }: { lead: LeadRow }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [dropReason, setDropReason] = useState("");
  const [followUp, setFollowUp] = useState(lead.follow_up_at ? lead.follow_up_at.slice(0, 10) : "");

  const run = (fn: () => Promise<void>) => () => start(fn);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 6 }}>
        <label className="field">Reactie ontvangen</label>
        <textarea
          placeholder="optionele notitie / reactie van de salon"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={run(() => markRepliedAction(lead.id, note || undefined))}
        >
          Markeer als beantwoord → maakt deal
        </button>
      </div>

      <div className="divider" />

      <div className="stack" style={{ gap: 6 }}>
        <label className="field">Follow-up datum</label>
        <div className="row" style={{ gap: 8 }}>
          <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} style={{ width: "auto" }} />
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={run(() => setFollowUpAction(lead.id, followUp ? new Date(followUp).toISOString() : null))}
          >
            Opslaan
          </button>
        </div>
      </div>

      <div className="divider" />

      <div className="stack" style={{ gap: 6 }}>
        <label className="field">Drop uit funnel</label>
        <div className="row" style={{ gap: 8 }}>
          <input
            placeholder="reden"
            value={dropReason}
            onChange={(e) => setDropReason(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending || !dropReason}
            onClick={run(() => dropLeadAction(lead.id, dropReason))}
          >
            Drop
          </button>
        </div>
      </div>

      {lead.status === "needs_review" || lead.status === "dropped" ? (
        <>
          <div className="divider" />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={run(() => resetToPendingAction(lead.id))}
          >
            Reset naar pending
          </button>
        </>
      ) : null}
    </div>
  );
}
