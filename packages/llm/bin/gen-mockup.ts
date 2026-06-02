#!/usr/bin/env -S node --experimental-strip-types
import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { SalonBriefSchema, type SalonBrief } from "../src/brief";
import { generateMockup } from "../src/mockup-generator";
import { stubMockup } from "../src/dry-run";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: join(REPO_ROOT, ".env") });

const GENERATED_DIR = join(REPO_ROOT, "apps/customer-template/examples/generated");

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    brief: { type: "string" },
    name: { type: "string" },
    city: { type: "string" },
    type: { type: "string" },
    vibe: { type: "string" },
    address: { type: "string" },
    postcode: { type: "string" },
    instagram: { type: "string" },
    website: { type: "string" },
    services: { type: "string" },
    language: { type: "string" },
    layout: { type: "string" },
    notes: { type: "string" },
    out: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(`
revivo mockup generator

Usage:
  pnpm gen-mockup --name "Lume Atelier" --city Amsterdam --vibe "warm, rustig, premium"
  pnpm gen-mockup --brief path/to/brief.json
  pnpm gen-mockup --dry-run --name "Test Salon" --city Utrecht   # no API call

Flags:
  --dry-run            Build a deterministic stub (no LLM, no cost)
  --brief <path>       Read a SalonBrief JSON file instead of inline flags
  --name, --city       Required (unless --brief)
  --type               hair | beauty | both        (default hair)
  --vibe               Free-text character description (most useful field)
  --address, --postcode, --instagram, --website
  --services           Pasted price list / services (free text)
  --language           nl | en                      (default nl)
  --layout             atelier | studio | neon      (steer the variant)
  --notes              Anything else for the model
  --out <path>         Output JSON path (default: examples/generated/<slug>.json)
`);
  process.exit(0);
}

function buildBrief(): SalonBrief {
  if (values.brief) {
    const raw = readFileSync(resolve(process.cwd(), values.brief), "utf-8");
    return SalonBriefSchema.parse(JSON.parse(raw));
  }
  if (!values.name || !values.city) {
    console.error("Error: --name and --city are required (or pass --brief <path>). See --help.");
    process.exit(1);
  }
  return SalonBriefSchema.parse({
    name: values.name,
    city: values.city,
    type: values.type ?? "hair",
    vibe: values.vibe,
    address: values.address,
    postcode: values.postcode,
    instagram: values.instagram,
    website: values.website,
    knownServices: values.services,
    language: values.language ?? "nl",
    preferLayout: values.layout,
    notes: values.notes,
  });
}

async function main() {
  const brief = buildBrief();
  const dryRun = values["dry-run"];

  console.log(`\n→ ${dryRun ? "DRY RUN (stub, no API call)" : "Generating via LLM"} for "${brief.name}"\n`);

  const config = dryRun
    ? stubMockup(brief)
    : await (async () => {
        const { config, usage, attempts } = await generateMockup(brief);
        console.log(
          `   model produced a valid SiteConfig in ${attempts} attempt(s)` +
            (usage ? ` · ${usage.inputTokens} in / ${usage.outputTokens} out tokens` : ""),
        );
        return config;
      })();

  // Resolve --out against REPO_ROOT (not cwd) — pnpm -F shifts cwd into the
  // package dir, so cwd-relative paths surprise users. Absolute paths still
  // pass through unchanged.
  const outPath = values.out
    ? resolve(REPO_ROOT, values.out)
    : join(GENERATED_DIR, `${config.slug}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  const relConfig = outPath.includes("/examples/")
    ? "examples/" + outPath.split("/examples/")[1]
    : outPath;

  console.log(`\n✓ Wrote ${outPath}`);
  console.log(`   layout: ${config.layout} · ${config.services.length} service categories\n`);
  console.log("Preview it:");
  console.log(`   cd apps/customer-template && REVIVO_CONFIG="${relConfig}" pnpm dev\n`);
}

main().catch((err) => {
  console.error("\n✗ " + (err as Error).message + "\n");
  process.exit(1);
});
