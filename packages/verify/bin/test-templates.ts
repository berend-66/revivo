#!/usr/bin/env tsx
/**
 * test-templates — the 3-variant acceptance test (Phase 7) for one real salon.
 *
 * Given a base slug whose layout-forced configs exist locally
 * (examples/generated/<base>-atelier|studio|neon.json), it serves apps/mockups ONCE
 * and runs the vision verify on each variant at desktop + mobile against the salon's
 * real Treatwell page — confirming team / reputation / reviews / photos / prices render
 * correctly across all three DNAs. Writes per-variant reports and a summary table.
 *
 *   pnpm -F @revivo/verify test-templates --base utrecht-hairstyle \
 *     --treatwell https://www.treatwell.nl/salon/utrecht-hairstyle/ --name "Utrecht Hairstyle"
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

const LAYOUTS = ["atelier", "studio", "neon"] as const;

interface Args {
  base?: string;
  treatwell?: string;
  name?: string;
  viewport: Viewport | "both";
  port: number;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { viewport: "both", port: 4399, out: resolve(REPO_ROOT, "packages/verify/out") };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--base": a.base = next(); break;
      case "--treatwell": a.treatwell = next(); break;
      case "--name": a.name = next(); break;
      case "--viewport": a.viewport = next() as Args["viewport"]; break;
      case "--port": a.port = Number(next()); break;
      case "--out": a.out = resolve(next()!); break;
      case "--help": case "-h":
        console.log("test-templates --base <slug> --treatwell <url> [--name <salon>] [--viewport both]");
        process.exit(0);
      default: throw new Error(`Unknown arg: ${arg}`);
    }
  }
  return a;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.base) throw new Error("--base <slug> is required (expects <base>-atelier|studio|neon configs).");
  if (!args.treatwell) throw new Error("--treatwell <url> is required.");

  const viewports: Viewport[] = args.viewport === "both" ? ["desktop", "mobile"] : [args.viewport];
  mkdirSync(args.out, { recursive: true });

  let server: MockupServer | null = null;
  const results: VerifyResult[] = [];
  try {
    console.log(`Serving apps/mockups on :${args.port} (Supabase stripped → local JSON)…`);
    server = await serveMockups({ port: args.port, repoRoot: REPO_ROOT });

    for (const layout of LAYOUTS) {
      const slug = `${args.base}-${layout}`;
      for (const viewport of viewports) {
        console.log(`\n[${layout}/${viewport}] verifying ${slug} …`);
        const report = await verifyMockupAgainstListing({
          mockupUrl: server.url(slug),
          treatwellUrl: args.treatwell,
          salonName: args.name,
          viewport,
        });
        results.push(report);
        writeFileSync(resolve(args.out, `${slug}-${viewport}.json`), JSON.stringify(report, null, 2));
        console.log(
          `   ${report.match ? "✓ faithful" : `✗ ${report.mistakeCount} mistake(s)`} — ` +
            `crit ${report.bySeverity.critical} major ${report.bySeverity.major} minor ${report.bySeverity.minor}`,
        );
      }
    }
  } finally {
    await closeBrowser();
    if (server) server.close();
  }

  console.log(`\n── SUMMARY ──────────────────────────────`);
  for (const r of results) {
    const variant = r.mockupUrl.split("/").pop() ?? "";
    console.log(
      `${variant.padEnd(28)} ${r.viewport.padEnd(8)} ` +
        `${r.match ? "OK " : `${r.mistakeCount}✗ `} (c${r.bySeverity.critical} m${r.bySeverity.major})`,
    );
  }
  const worst = Math.max(0, ...results.map((r) => r.mistakeCount));
  console.log(`\nworst mistakeCount across variants: ${worst}`);
})().catch((err) => {
  console.error(`\ntest-templates failed: ${err.message}`);
  process.exit(1);
});
