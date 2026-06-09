#!/usr/bin/env -S node --experimental-strip-types
import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { SalonBriefSchema, SiteConfigSchema, type SalonBrief, type SiteConfig, type ListingFacts } from "@revivo/shared";
import {
  assembleBriefFromPlaces,
  assembleBriefFromFixture,
  fetchTreatwellFacts,
  listingFactsToBrief,
  crossCheckListing,
  type RawListing,
  type PlaceToBriefOverrides,
} from "@revivo/sourcing";
import { createServiceClient, upsertMockupBySlug, type MockupSource } from "@revivo/db";
import { generateMockup, applyListingFacts } from "../src/mockup-generator";
import { checkAboutFidelity } from "../src/check-about";
import { stubMockup } from "../src/dry-run";
import { loadLLMSettings } from "../src/config";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: join(REPO_ROOT, ".env") });

const GENERATED_DIR = join(REPO_ROOT, "apps/customer-template/examples/generated");

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    // input modes
    brief: { type: "string" },
    "place-id": { type: "string" },
    query: { type: "string" },
    "fixture-place": { type: "boolean", default: false },
    treatwell: { type: "string" },
    // manual / override fields (also used as overrides in places mode)
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
    // instagram-light (places mode)
    ig: { type: "string" },
    "ig-bio": { type: "string" },
    "ig-captions": { type: "string" },
    // sinks
    push: { type: "boolean", default: false },
    out: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(`
revivo mockup generator

Input modes (pick one):
  Manual   pnpm gen-mockup --name "Lume Atelier" --city Amsterdam --vibe "warm, rustig, premium"
  Brief    pnpm gen-mockup --brief path/to/brief.json
  Places   pnpm gen-mockup --place-id "ChIJ..."            (live Google Places; needs GOOGLE_PLACES_API_KEY)
           pnpm gen-mockup --query "Kapsalon Mira Utrecht" (text-search → first hit → brief)
  Fixture  pnpm gen-mockup --fixture-place                 (built-in fixture Place; no key — great e2e test)
  Treatwell pnpm gen-mockup --treatwell <salon-url|slug>   (REAL menu/prices/team/hours/reviews/photos — no key)
            Combine with --place-id for the postcode + extra Google photos:
            pnpm gen-mockup --treatwell <url> --place-id "ChIJ..."

Offline / no cost:
  --dry-run            Build a deterministic stub (no LLM). With a places mode, uses the fixture Place (no Google call).

Instagram-light (places mode):
  --ig <handle>        Instagram @handle (or full profile URL)
  --ig-bio <text>      Pasted profile bio (becomes brand-voice signal)
  --ig-captions <text> Pasted captions, separated by '||' or newlines

Overrides (places mode) / fields (manual mode):
  --name, --city, --type (hair|beauty|both), --vibe, --address, --postcode,
  --instagram, --website, --services, --language (nl|en), --layout (atelier|studio|neon), --notes

Sinks:
  --push               Upsert the result into Supabase 'mockups' (needs SUPABASE_URL + SERVICE_ROLE_KEY + applied migration)
  --out <path>         Output JSON path (default: examples/generated/<slug>.json)
`);
  process.exit(0);
}

/** Captions pasted as "a||b" or multi-line → string[]. */
function parseCaptions(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(/\|\||\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

function placesOverrides(): PlaceToBriefOverrides {
  return {
    city: values.city,
    type: values.type as PlaceToBriefOverrides["type"],
    vibe: values.vibe,
    language: values.language as PlaceToBriefOverrides["language"],
    preferLayout: values.layout as PlaceToBriefOverrides["preferLayout"],
    knownServices: values.services,
    notes: values.notes,
  };
}

function buildManualBrief(): SalonBrief {
  if (values.brief) {
    const raw = readFileSync(resolve(process.cwd(), values.brief), "utf-8");
    return SalonBriefSchema.parse(JSON.parse(raw));
  }
  if (!values.name || !values.city) {
    console.error("Error: --name and --city are required (or use --brief / --place-id / --query / --fixture-place). See --help.");
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

interface ResolvedBrief {
  brief: SalonBrief;
  source: MockupSource;
  placeId?: string;
  /** Real listing facts (Treatwell), applied deterministically to the config. */
  facts?: ListingFacts;
  /** The raw scraped blobs — kept for the deterministic scrape-fidelity cross-check. */
  raw?: RawListing;
}

async function resolveBrief(): Promise<ResolvedBrief> {
  const treatwellUrl = values.treatwell;
  const placesMode = values["place-id"] || values.query || values["fixture-place"];
  const overrides = placesOverrides();

  // Treatwell mode — the salon's real source of truth. Optionally combined with
  // a places mode to borrow Google's postcode + coordinates (Treatwell has no
  // postcode); the listing facts win on everything they cover.
  if (treatwellUrl) {
    const { raw, facts } = await fetchTreatwellFacts(treatwellUrl);
    if (placesMode) {
      const instagram = {
        handle: values.ig ?? values.instagram,
        bio: values["ig-bio"],
        captions: parseCaptions(values["ig-captions"]),
      };
      const useFixture = values["dry-run"] || values["fixture-place"];
      const assembled = useFixture
        ? await assembleBriefFromFixture({ instagram, overrides })
        : await assembleBriefFromPlaces({ placeId: values["place-id"], query: values.query, instagram, overrides });
      const brief: SalonBrief = { ...assembled.brief };
      if (facts.name) brief.name = facts.name;
      if (facts.address) brief.address = facts.address;
      if (facts.lat !== undefined) brief.lat = facts.lat;
      if (facts.lng !== undefined) brief.lng = facts.lng;
      if (facts.reputation) {
        brief.rating = facts.reputation.rating;
        brief.reviewCount = facts.reputation.reviewCount;
      }
      return { brief, facts, raw, source: "listing", placeId: assembled.place.placeId };
    }
    return { brief: listingFactsToBrief(facts, overrides), facts, raw, source: "listing" };
  }

  if (!placesMode) {
    return { brief: buildManualBrief(), source: "manual" };
  }

  const instagram = {
    handle: values.ig ?? values.instagram,
    bio: values["ig-bio"],
    captions: parseCaptions(values["ig-captions"]),
  };

  // A dry run never hits Google; the fixture Place stands in. --fixture-place
  // forces the fixture even on a real (LLM) run, which is the no-key e2e path.
  const useFixture = values["dry-run"] || values["fixture-place"];
  const assembled = useFixture
    ? await assembleBriefFromFixture({ instagram, overrides })
    : await assembleBriefFromPlaces({ placeId: values["place-id"], query: values.query, instagram, overrides });

  return { brief: assembled.brief, source: "places", placeId: assembled.place.placeId };
}

async function main() {
  const { brief, source, placeId, facts, raw } = await resolveBrief();
  const dryRun = values["dry-run"];

  const modeLabel = dryRun ? "DRY RUN (stub, no API call)" : "Generating via LLM";
  const srcLabel =
    source === "listing"
      ? ` · Treatwell${placeId ? ` + Place ${placeId}` : ""}`
      : source === "places"
        ? values["fixture-place"] || dryRun
          ? " · fixture Place"
          : ` · Place ${placeId}`
        : "";
  console.log(`\n→ ${modeLabel} for "${brief.name}" [${source}${srcLabel}]\n`);

  // Scrape-fidelity guard (deterministic, no LLM). A Treatwell page carries the
  // salon's scalars twice — window.__state__ and JSON-LD — so we re-extract each
  // independently and flag any silent disagreement (a state parse broken by a
  // layout change). Printed before generation so a broken scrape surfaces before
  // any LLM cost. Warn, don't block — operator judgment, like checkAboutFidelity.
  if (raw && facts) {
    const fidelity = crossCheckListing(raw, facts);
    if (fidelity.verdict === "mismatch") {
      console.warn(`⚠ Scrape-fidelity: ${fidelity.summary}`);
      for (const m of fidelity.mismatches) {
        console.warn(`   • ${m.field}: state "${m.stateValue}" ≠ JSON-LD "${m.jsonLdValue}"`);
      }
      console.warn(`   → De Treatwell-scrape kan stuk zijn (layout gewijzigd?). Controleer vóór verzending.\n`);
    } else if (fidelity.verdict === "uncheckable") {
      console.log(`   scrape-fidelity: – ${fidelity.summary}\n`);
    } else {
      console.log(`   scrape-fidelity: ✓ ${fidelity.summary}\n`);
    }
  }

  let config: SiteConfig;
  let model = "dry-run-stub";
  if (dryRun) {
    config = stubMockup(brief);
    // Apply the real facts even to the stub, so --dry-run --treatwell is a
    // zero-cost offline preview of the deterministic passthrough.
    if (facts) config = SiteConfigSchema.parse(applyListingFacts(config, facts));
  } else {
    const result = await generateMockup(brief, undefined, facts);
    config = result.config;
    model = loadLLMSettings().model;
    console.log(
      `   model produced a valid SiteConfig in ${result.attempts} attempt(s)` +
        (result.usage ? ` · ${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens` : ""),
    );
  }

  // About-fidelity guard. Facts are deterministic, but the LLM-authored about-prose can
  // still invent a concrete claim (a music genre, an award, a year). Catch it with a cheap
  // text check before the mockup is sent. Warn, don't block — operator judgment.
  if (!dryRun && facts?.description) {
    try {
      const fidelity = await checkAboutFidelity({ config, facts });
      if (fidelity.verdict === "fabrication") {
        console.warn(`\n⚠ About-tekst: ${fidelity.claims.length} mogelijk verzonnen claim(s) [${fidelity.model}]:`);
        for (const c of fidelity.claims) {
          console.warn(`   • "${c.quote}"`);
          console.warn(`     ${c.issue}`);
        }
        console.warn(`   → Controleer/herschrijf de about of genereer opnieuw vóór verzending.`);
      } else {
        console.log(`   about-fidelity: clean`);
      }
    } catch (err) {
      console.warn(`   about-fidelity check overgeslagen: ${(err as Error).message}`);
    }
  }

  // Resolve --out against REPO_ROOT (not cwd) — pnpm -F shifts cwd into the
  // package dir, so cwd-relative paths surprise users. Absolute paths pass through.
  const outPath = values.out ? resolve(REPO_ROOT, values.out) : join(GENERATED_DIR, `${config.slug}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  const relConfig = outPath.includes("/examples/") ? "examples/" + outPath.split("/examples/")[1] : outPath;

  console.log(`\n✓ Wrote ${outPath}`);
  console.log(`   layout: ${config.layout} · ${config.services.length} service categories`);

  if (values.push) {
    const client = createServiceClient(); // throws a helpful error if Supabase env is missing
    const row = await upsertMockupBySlug(client, { slug: config.slug, config, source, placeId, brief, model });
    console.log(`✓ Pushed to Supabase 'mockups' (id ${row.id}, source ${row.source})`);
    const base = process.env.REVIVO_MOCK_BASE_URL ?? "http://localhost:4321";
    console.log(`\nShareable mockup URL:\n   ${base.replace(/\/$/, "")}/${config.slug}\n`);
  } else {
    console.log("\nPreview it locally:");
    console.log(`   cd apps/customer-template && REVIVO_CONFIG="${relConfig}" pnpm dev`);
    console.log(`   # or via the mock app:  cd apps/mockups && pnpm dev   → http://localhost:4321/${config.slug}\n`);
  }
}

main().catch((err) => {
  console.error("\n✗ " + (err as Error).message + "\n");
  process.exit(1);
});
