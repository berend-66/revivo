#!/usr/bin/env tsx
/**
 * verify-mockup — the scraper-accuracy measurement CLI.
 *
 * Screenshots a rendered mockup + the salon's real Treatwell page and prints a
 * counted discrepancy report (the Phase 6.5 instrument). By default it serves the
 * mockup through the real `apps/mockups` SSR app with Supabase env stripped, so it
 * renders from the local examples/generated/<slug>.json the generator wrote — the
 * same per-variant CSS the production mockup ships.
 *
 *   pnpm verify-mockup --slug utrecht-hairstyle \
 *     --treatwell https://www.treatwell.nl/salon/utrecht-hairstyle/ --name "Utrecht Hairstyle"
 *
 *   # skip serving (operator already runs `cd apps/mockups && pnpm dev`):
 *   pnpm verify-mockup --mockup-url http://localhost:4321/utrecht-hairstyle --treatwell <url>
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import {
  verifyMockupAgainstListing,
  closeBrowser,
  serveMockups,
  type MockupServer,
  type Viewport,
  type VerifyResult,
} from "../src/index";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: resolve(REPO_ROOT, ".env") });

interface Args {
  slug?: string;
  treatwell?: string;
  mockupUrl?: string;
  name?: string;
  viewport: Viewport | "both";
  port: number;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    viewport: "desktop",
    port: 4399,
    out: resolve(REPO_ROOT, "packages/verify/out"),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--slug": a.slug = next(); break;
      case "--treatwell": a.treatwell = next(); break;
      case "--mockup-url": a.mockupUrl = next(); break;
      case "--name": a.name = next(); break;
      case "--viewport": a.viewport = next() as Args["viewport"]; break;
      case "--port": a.port = Number(next()); break;
      case "--out": a.out = resolve(next()!); break;
      case "--help": case "-h": printHelp(); process.exit(0);
      default: throw new Error(`Unknown arg: ${arg}`);
    }
  }
  return a;
}

function printHelp(): void {
  console.log(`verify-mockup — screenshot a mockup + its Treatwell page, count factual discrepancies.

Required:
  --treatwell <url>     the salon's real Treatwell listing (ground truth)
  --slug <slug>         mockup slug to serve via apps/mockups   (omit if --mockup-url given)

Optional:
  --mockup-url <url>    skip serving; screenshot this URL directly
  --name <salon>        salon name, anchors the judge
  --viewport <v>        desktop | mobile | both        (default desktop)
  --port <n>            port for the served mockups app (default 4399)
  --out <dir>           report output dir (default packages/verify/out)`);
}

function printReport(r: VerifyResult): void {
  const verdict = r.match ? "✓ FAITHFUL" : `✗ ${r.mistakeCount} MISTAKE(S)`;
  console.log(`\n── ${r.viewport.toUpperCase()} ─ ${verdict} ─ ${r.model}`);
  console.log(
    `   confirmed crit ${r.bySeverity.critical}  major ${r.bySeverity.major}  minor ${r.bySeverity.minor}` +
      `   (${r.candidateCount} candidate(s), ${r.refuted.length} refuted)`,
  );
  for (const issue of r.issues) {
    const tag = issue.severity.toUpperCase().padEnd(8);
    console.log(`   [${tag}] ${issue.field}`);
    console.log(`            listing: ${issue.expected}`);
    console.log(`            mockup : ${issue.got}`);
    if (issue.note) console.log(`            note   : ${issue.note}`);
  }
  for (const ref of r.refuted) {
    console.log(`   [REFUTED ] ${ref.field} — ${ref.reason}`);
    console.log(`            claim   : mockup "${ref.got}" vs listing "${ref.expected}"`);
    console.log(`            observed: mockup "${ref.observedOnMockup}" vs listing "${ref.observedOnListing}"`);
  }
  console.log(`   summary: ${r.summary}`);
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.treatwell) throw new Error("--treatwell <url> is required. See --help.");
  if (!args.mockupUrl && !args.slug) throw new Error("Provide --slug (to serve) or --mockup-url. See --help.");

  const viewports: Viewport[] = args.viewport === "both" ? ["desktop", "mobile"] : [args.viewport];

  console.warn(
    "⚠ Manual spot-check only — this screenshot-vision judge is FALSE-POSITIVE-PRONE " +
      "(measured 3/3 FPs on a verified-correct mockup). Eyeball every issue; for fabrication\n" +
      "  use checkAboutFidelity in @revivo/llm. See packages/verify/CLAUDE.md.\n",
  );

  let server: MockupServer | null = null;
  let mockupBase = args.mockupUrl;
  try {
    if (!mockupBase) {
      console.log(`Serving apps/mockups on :${args.port} (Supabase stripped → local JSON)…`);
      server = await serveMockups({ port: args.port, repoRoot: REPO_ROOT });
      mockupBase = server.url(args.slug!);
    }

    mkdirSync(args.out, { recursive: true });
    const slugLabel = args.slug ?? "mockup";

    for (const viewport of viewports) {
      console.log(`\nVerifying ${mockupBase} (${viewport}) vs ${args.treatwell} …`);
      const report = await verifyMockupAgainstListing({
        mockupUrl: mockupBase,
        treatwellUrl: args.treatwell,
        salonName: args.name,
        viewport,
      });
      printReport(report);
      const outPath = resolve(args.out, `${slugLabel}-${viewport}.json`);
      writeFileSync(outPath, JSON.stringify(report, null, 2));
      console.log(`   → ${outPath}`);
    }
  } finally {
    await closeBrowser();
    if (server) server.close();
  }
})().catch((err) => {
  console.error(`\nverify-mockup failed: ${err.message}`);
  process.exit(1);
});
