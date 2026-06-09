/**
 * Hand-run lead sourcing (roadmap B2): crawl Treatwell marketplace directories
 * and insert deduped `pending` leads. The cron version (C1) wraps this same
 * library path — keep this script THIN: arg parsing + the insert loop only;
 * all crawl logic lives in @revivo/sourcing.
 *
 *   pnpm crawl-marketplace --city utrecht --dry-run        # no DB, print what would land
 *   pnpm crawl-marketplace --city utrecht --city amersfoort
 *   pnpm crawl-marketplace --city utrecht --treatment kapper --max-pages 5
 */
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { crawlTreatwellDirectory, type DirectoryLead } from "@revivo/sourcing";
import { createServiceClient, insertLeadIfNew } from "@revivo/db";

// repo-root .env, same convention as gen-mockup / verify
dotenv.config({ path: resolve(fileURLToPath(import.meta.url), "../../.env") });

const { values } = parseArgs({
  options: {
    city: { type: "string", multiple: true },
    treatment: { type: "string", multiple: true },
    "max-pages": { type: "string" },
    delay: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

function usage(exitCode: number): never {
  console.log(
    `Usage: pnpm crawl-marketplace --city <slug> [--city <slug> …] [options]

  --city <slug>        Treatwell city slug (e.g. utrecht, den-haag). Repeatable.
  --treatment <seg>    Treatment segment (default: kapper). Repeatable.
  --max-pages <n>      Page cap per city × treatment (default 10 ≈ 200 salons).
  --delay <ms>         Delay between page fetches (default 5000 — robots.txt Crawl-delay: 5).
  --dry-run            Crawl + print, no Supabase writes.`,
  );
  process.exit(exitCode);
}

if (values.help || !values.city?.length) usage(values.help ? 0 : 1);

/** The politeness knobs must fail CLOSED: a typo'd number (NaN) would otherwise
 * silently disable the page cap and the crawl delay. Reject it loudly instead. */
function requireNumber(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`${flag} must be a non-negative number, got "${raw}"\n`);
    usage(1);
  }
  return n;
}

const maxPages = requireNumber(values["max-pages"], "--max-pages");
const delayMs = requireNumber(values.delay, "--delay");
const dryRun = values["dry-run"]!;
const client = dryRun ? null : createServiceClient();

let inserted = 0;
let skipped = 0;
let crawled = 0;

function describe(lead: DirectoryLead): string {
  const rating = lead.rating !== undefined ? ` · ${lead.rating}★ (${lead.reviewCount ?? "?"})` : "";
  return `${lead.name ?? lead.listingUrl}${rating} — ${lead.listingUrl}`;
}

for await (const lead of crawlTreatwellDirectory({
  cities: values.city,
  treatments: values.treatment?.length ? values.treatment : undefined,
  maxPagesPerCity: maxPages,
  delayMs,
})) {
  crawled++;
  if (dryRun) {
    console.log(`  [dry-run] ${describe(lead)}`);
    continue;
  }
  const result = await insertLeadIfNew(client!, {
    source: "marketplace",
    listingUrl: lead.listingUrl,
    name: lead.name,
    city: lead.city,
    queryText: lead.directoryUrl,
  });
  if (result.inserted) {
    inserted++;
    console.log(`  + ${describe(lead)}`);
  } else {
    skipped++;
    console.log(`  = already known: ${lead.listingUrl}`);
  }
}

console.log(
  dryRun
    ? `\n[dry-run] ${crawled} leads crawled — nothing written.`
    : `\n${crawled} leads crawled → ${inserted} inserted, ${skipped} already known.`,
);
