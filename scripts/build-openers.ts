/**
 * Hand-run opener batch (roadmap B4): every `mockup_generated` lead → a
 * ready-to-send Dutch opener. WhatsApp deep link only when the salon has a
 * Dutch MOBILE; IG-DM/e-mail copy otherwise. Templated + deterministic, NO LLM
 * — measure samey-ness over ~20 real sends before paying for model variation.
 *
 *   pnpm build-openers                     # print openers (no status change)
 *   pnpm build-openers --out openers.txt   # also write them to a file
 *   pnpm build-openers --mark-sent         # ALSO flip emitted leads → outreach_sent
 *                                          # (run this variant when actually sending)
 *   pnpm build-openers --sender Nelson     # sign off as Nelson instead of Berend
 *
 * Keep this THIN: the copy lives in @revivo/shared (buildOpener); this script
 * is lead lookup + formatting + the optional status flip.
 */
import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { SiteConfigSchema, buildOpener, DEFAULT_MOCK_BASE_URL } from "@revivo/shared";
import { createServiceClient, getMockupsByLeadId, listLeadsByStatus, setLeadStatus } from "@revivo/db";

// repo-root .env, same convention as the sibling scripts
dotenv.config({ path: resolve(fileURLToPath(import.meta.url), "../../.env") });

const { values } = parseArgs({
  options: {
    limit: { type: "string" },
    out: { type: "string" },
    "mark-sent": { type: "boolean", default: false },
    sender: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

function usage(exitCode: number): never {
  console.log(
    `Usage: pnpm build-openers [options]

  --limit <n>    Max leads to emit (default 50).
  --out <path>   Also write the openers to a file.
  --mark-sent    Flip the emitted leads to 'outreach_sent' after printing.
                 Only run with this flag at the moment you actually send.
  --sender <n>   Name in the sign-off (default: Berend).`,
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

const limit = requirePositiveInt(values.limit, "--limit", 50);
// The live mock deployment; set REVIVO_MOCK_BASE_URL once mock.revivo.nl lands.
// Deliberately NOT a localhost fallback — a pasted localhost link is a wasted opener.
const base = (process.env.REVIVO_MOCK_BASE_URL ?? DEFAULT_MOCK_BASE_URL).replace(/\/$/, "");

const client = createServiceClient();
const leads = await listLeadsByStatus(client, "mockup_generated", limit);

const blocks: string[] = [];
const emittedLeadIds: string[] = [];
let skipped = 0;

for (const lead of leads) {
  const name = lead.name ?? lead.listing_url ?? lead.id;
  const mockup = (await getMockupsByLeadId(client, lead.id))[0];
  if (!mockup) {
    skipped++;
    console.warn(`  ! ${name}: status mockup_generated maar geen mockup-rij — overgeslagen`);
    continue;
  }
  if (mockup.model === "dry-run-stub") {
    skipped++;
    console.warn(`  ! ${name}: mockup is een stub-config — regenereer eerst (overgeslagen)`);
    continue;
  }
  const parsed = SiteConfigSchema.safeParse(mockup.config_json);
  if (!parsed.success) {
    skipped++;
    console.warn(`  ! ${name}: config_json valideert niet meer — overgeslagen`);
    continue;
  }

  const mockUrl = `${base}/${mockup.slug}`;
  const opener = buildOpener({ config: parsed.data, mockUrl, facts: lead.listing_facts_json, senderName: values.sender });

  blocks.push(
    [
      `── ${name}${lead.city ? ` (${lead.city})` : ""} — ${mockUrl}`,
      `   hook: ${opener.hook}`,
      opener.whatsappUrl
        ? `   WhatsApp: ${opener.whatsappUrl}`
        : `   WhatsApp: geen NL-mobiel bekend → gebruik IG-DM of e-mail`,
      ``,
      opener.plainText,
      ``,
      `   [IG-DM]  ${opener.igDmText}`,
      `   [E-mail] ${opener.emailSubject}`,
      ``,
    ].join("\n"),
  );
  emittedLeadIds.push(lead.id);
}

const output = blocks.join("\n");
if (blocks.length) console.log(`\n${output}`);
if (values.out) {
  const outPath = resolve(process.cwd(), values.out);
  writeFileSync(outPath, output + "\n", "utf-8");
  console.log(`✓ ${blocks.length} opener(s) → ${outPath}`);
}

if (values["mark-sent"] && emittedLeadIds.length) {
  for (const id of emittedLeadIds) await setLeadStatus(client, id, "outreach_sent");
  console.log(`✓ ${emittedLeadIds.length} lead(s) → outreach_sent`);
}

console.log(
  `\n${blocks.length} opener(s) klaar${skipped ? `, ${skipped} overgeslagen` : ""}` +
    (values["mark-sent"] ? "" : " — status ongewijzigd (gebruik --mark-sent bij het échte versturen)"),
);
