/**
 * Email outreach sender: every `mockup_generated` lead that has a known email
 * address → sends the opener e-mail from info@revivostudios.io via Zoho SMTP.
 *
 * Requires three env vars in .env:
 *   ZOHO_SMTP_USER   — info@revivostudios.io
 *   ZOHO_SMTP_PASS   — app-specific password (Zoho Mail → Settings → Security → App Passwords)
 *   ZOHO_SMTP_HOST   — smtp.zoho.eu  (or smtp.zoho.com for non-EU accounts)
 *
 * Usage:
 *   pnpm send-outreach --dry-run                     # preview, nothing sent
 *   pnpm send-outreach --city amsterdam              # filter by city
 *   pnpm send-outreach --sender Nelson               # sign-off name
 *   pnpm send-outreach --mark-sent                   # flip leads → outreach_sent after sending
 *   pnpm send-outreach --out log.txt                 # also write a log file
 */
import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { SiteConfigSchema, buildOpener, DEFAULT_MOCK_BASE_URL } from "@revivo/shared";
import { createServiceClient, getMockupsByLeadId, listLeadsByStatus, setLeadStatus } from "@revivo/db";

dotenv.config({ path: resolve(fileURLToPath(import.meta.url), "../../.env") });

const { values } = parseArgs({
  options: {
    limit:       { type: "string" },
    city:        { type: "string" },
    sender:      { type: "string" },
    out:         { type: "string" },
    "dry-run":    { type: "boolean", default: false },
    "mark-sent":  { type: "boolean", default: false },
    "test-email": { type: "string" },
    help:         { type: "boolean", default: false },
  },
});

function usage(exitCode: number): never {
  console.log(
    `Usage: pnpm send-outreach [options]

  --city <c>     Filter leads by city (case-insensitive, partial match).
  --limit <n>    Max leads to process (default 50).
  --sender <n>   Name in the sign-off (default: Berend).
  --dry-run      Preview what would be sent — no emails are actually sent.
  --mark-sent    Flip emitted leads to 'outreach_sent' after sending.
                 Only run with this flag at the moment you actually send.
  --out <path>   Also write a log of sent emails to a file.`,
  );
  process.exit(exitCode);
}

if (values.help) usage(0);

function requirePositiveInt(raw: string | undefined, flag: string, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`${flag} must be a positive integer, got "${raw}"\n`);
    usage(1);
  }
  return n;
}

// ── SMTP setup ──────────────────────────────────────────────────────────────

const smtpUser = process.env.ZOHO_SMTP_USER;
const smtpPass = process.env.ZOHO_SMTP_PASS;
const smtpHost = process.env.ZOHO_SMTP_HOST ?? "smtp.zoho.eu";

if (!values["dry-run"] && (!smtpUser || !smtpPass)) {
  console.error(
    "ZOHO_SMTP_USER and ZOHO_SMTP_PASS must be set in .env\n" +
    "Tip: gebruik een app-specific password (Zoho Mail → Settings → Security → App Passwords)\n" +
    "Of voeg --dry-run toe om te previewen zonder te versturen.",
  );
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: 465,
  secure: true, // SSL
  auth: { user: smtpUser, pass: smtpPass },
});

// ── Lead loop ────────────────────────────────────────────────────────────────

const limit = requirePositiveInt(values.limit, "--limit", 50);
const base   = (process.env.REVIVO_MOCK_BASE_URL ?? DEFAULT_MOCK_BASE_URL).replace(/\/$/, "");

const client  = createServiceClient();
const allLeads = await listLeadsByStatus(client, "mockup_generated", limit);
const cityFilter = values.city?.toLowerCase();
const leads = cityFilter
  ? allLeads.filter((l) => l.city?.toLowerCase().includes(cityFilter))
  : allLeads;

const logLines: string[] = [];
const sentLeadIds: string[] = [];
let skippedNoEmail = 0;
let skippedBadConfig = 0;

for (const lead of leads) {
  const name = lead.name ?? lead.listing_url ?? lead.id;

  const mockup = (await getMockupsByLeadId(client, lead.id))[0];
  if (!mockup || mockup.model === "dry-run-stub") {
    skippedBadConfig++;
    console.warn(`  ! ${name}: geen geldige mockup — overgeslagen`);
    continue;
  }

  const parsed = SiteConfigSchema.safeParse(mockup.config_json);
  if (!parsed.success) {
    skippedBadConfig++;
    console.warn(`  ! ${name}: config_json valideert niet — overgeslagen`);
    continue;
  }

  const mockUrl = `${base}/${mockup.slug}`;
  const opener  = buildOpener({
    config: parsed.data,
    mockUrl,
    facts: lead.listing_facts_json,
    senderName: values.sender,
  });

  const toEmail = values["test-email"] ?? opener.recipientEmail;
  if (!toEmail) {
    skippedNoEmail++;
    console.warn(`  ! ${name}: geen e-mailadres bekend — overgeslagen (gebruik WhatsApp/IG)`);
    continue;
  }
  if (values["test-email"]) {
    console.log(`  [TEST] e-mail gaat naar ${values["test-email"]} i.p.v. salon`);
  }

  const line = `→ ${name} <${toEmail}> — ${opener.emailSubject}`;
  console.log(values["dry-run"] ? `[DRY-RUN] ${line}` : line);
  logLines.push(line);

  if (!values["dry-run"]) {
    await transporter.sendMail({
      from: `"Revivo Studios" <${smtpUser}>`,
      to:   toEmail,
      subject: opener.emailSubject,
      text: opener.emailBody,   // plain text fallback
      html: opener.emailHtmlBody,
    });
  }

  sentLeadIds.push(lead.id);
}

// ── Wrap-up ──────────────────────────────────────────────────────────────────

if (values.out && logLines.length) {
  const outPath = resolve(process.cwd(), values.out);
  writeFileSync(outPath, logLines.join("\n") + "\n", "utf-8");
  console.log(`✓ log → ${outPath}`);
}

if (!values["dry-run"] && values["mark-sent"] && sentLeadIds.length) {
  for (const id of sentLeadIds) await setLeadStatus(client, id, "outreach_sent");
  console.log(`✓ ${sentLeadIds.length} lead(s) → outreach_sent`);
}

const dryTag = values["dry-run"] ? " (dry-run — niets verstuurd)" : "";
console.log(
  `\n${sentLeadIds.length} e-mail(s) verstuurd${dryTag}` +
  (skippedNoEmail    ? `, ${skippedNoEmail} zonder e-mailadres overgeslagen` : "") +
  (skippedBadConfig  ? `, ${skippedBadConfig} met ongeldige config overgeslagen` : "") +
  (values["mark-sent"] || values["dry-run"] ? "" : " — gebruik --mark-sent bij het échte versturen"),
);
