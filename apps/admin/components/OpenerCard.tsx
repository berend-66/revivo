"use client";

import { useState, useTransition } from "react";
import { CopyButton } from "./CopyButton";
import { markSentAction } from "@/app/actions";

type Channel = "whatsapp" | "instagram" | "email";

export interface OpenerCardProps {
  leadId: string;
  hook: string;
  whatsappUrl?: string;
  igDmText: string;
  emailSubject: string;
  emailBody: string;
  plainText: string;
}

export function OpenerCard({
  leadId,
  hook,
  whatsappUrl,
  igDmText,
  emailSubject,
  emailBody,
  plainText,
}: OpenerCardProps) {
  const [channel, setChannel] = useState<Channel>(whatsappUrl ? "whatsapp" : "instagram");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  const textFor = (c: Channel) =>
    c === "whatsapp" ? plainText : c === "instagram" ? igDmText : `${emailSubject}\n\n${emailBody}`;

  function markSent() {
    start(async () => {
      await markSentAction(leadId, channel, hook, textFor(channel));
      setDone(true);
    });
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row spread">
        <span className="tag">hook: {hook}</span>
        {whatsappUrl ? (
          <a className="btn btn-wa btn-sm" href={whatsappUrl} target="_blank" rel="noreferrer">
            Open WhatsApp →
          </a>
        ) : (
          <span className="small muted">geen NL-mobiel — IG of e-mail</span>
        )}
      </div>

      <div className="opener-block">
        <div className="head">
          <span className="name">WhatsApp / hoofdtekst</span>
          <CopyButton text={plainText} />
        </div>
        <pre>{plainText}</pre>
      </div>

      <div className="opener-block">
        <div className="head">
          <span className="name">Instagram DM</span>
          <CopyButton text={igDmText} />
        </div>
        <pre>{igDmText}</pre>
      </div>

      <div className="opener-block">
        <div className="head">
          <span className="name">E-mail — {emailSubject}</span>
          <CopyButton text={`${emailSubject}\n\n${emailBody}`} label="Kopieer e-mail" />
        </div>
        <pre>{emailBody}</pre>
      </div>

      <div className="row spread" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <label className="small muted" htmlFor={`ch-${leadId}`}>
            Verstuurd via
          </label>
          <select
            id={`ch-${leadId}`}
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            style={{ width: "auto" }}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="email">E-mail</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={markSent} disabled={pending || done}>
          {done ? "Gemarkeerd ✓" : pending ? "Bezig…" : "Markeer als verzonden"}
        </button>
      </div>
    </div>
  );
}
