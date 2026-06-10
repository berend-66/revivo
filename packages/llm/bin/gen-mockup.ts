#!/usr/bin/env -S node --experimental-strip-types
import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { SalonBriefSchema, buildOpener, DEFAULT_MOCK_BASE_URL, type SalonBrief } from "@revivo/shared";
import {
  assembleBriefFromPlaces,
  assembleBriefFromFixture,
  normalizeTreatwellUrl,
  type FidelityReport,
  type PlaceToBriefOverrides,
} from "@revivo/sourcing";
import {
  createServiceClient,
  getLeadById,
  getMockupBySlug,
  upsertMockupBySlug,
  type MockupSource,
} from "@revivo/db";
import { resolveListingBrief, runMockupPipeline, type RunMockupInput } from "../src/run-mockup";

// The CLI is arg-parsing + sinks ONLY (roadmap B3): every mode funnels into the
// shared `runMockupPipeline` — the same path the batch worker runs — so there is
// no CLI-flavoured generation behaviour to drift from the batch behaviour.

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

interface ResolvedBrief extends Pick<RunMockupInput, "brief" | "facts" | "raw"> {
  source: MockupSource;
  placeId?: string;
}

async function resolveBrief(): Promise<ResolvedBrief> {
  const treatwellUrl = values.treatwell;
  const placesMode = values["place-id"] || values.query || values["fixture-place"];
  const overrides = placesOverrides();
  const instagram = {
    handle: values.ig ?? values.instagram,
    bio: values["ig-bio"],
    captions: parseCaptions(values["ig-captions"]),
  };
  // A dry run never hits Google; the fixture Place stands in. --fixture-place
  // forces the fixture even on a real (LLM) run, which is the no-key e2e path.
  const useFixture = values["dry-run"] || values["fixture-place"];

  // Treatwell mode — the salon's real source of truth, optionally combined with
  // a places mode for Google's postcode + coordinates. Shared with the batch
  // worker via resolveListingBrief.
  if (treatwellUrl) {
    const resolved = await resolveListingBrief({
      listingUrl: treatwellUrl,
      overrides,
      places: placesMode
        ? { placeId: values["place-id"], query: values.query, useFixture, instagram }
        : undefined,
    });
    return { ...resolved, source: "listing" };
  }

  if (!placesMode) {
    return { brief: buildManualBrief(), source: "manual" };
  }

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

  const run = await runMockupPipeline({ brief, facts, raw, dryRun });
  const { config, gates } = run;

  if (!dryRun) {
    console.log(
      `   model produced a valid SiteConfig in ${run.attempts} attempt(s)` +
        (run.usage ? ` · ${run.usage.inputTokens} in / ${run.usage.outputTokens} out tokens` : ""),
    );
  }

  // Scrape-fidelity guard (deterministic, no LLM): window.__state__ vs JSON-LD.
  // Warn, don't block — operator judgment, like the about check below.
  const fidelity = gates.scrapeFidelity;
  if (fidelity) {
    if (fidelity.verdict === "mismatch") {
      console.warn(`⚠ Scrape-fidelity: ${fidelity.summary}`);
      for (const m of fidelity.mismatches) {
        console.warn(`   • ${m.field}: state "${m.stateValue}" ≠ JSON-LD "${m.jsonLdValue}"`);
      }
      console.warn(`   → De Treatwell-scrape kan stuk zijn (layout gewijzigd?). Controleer vóór verzending.\n`);
    } else if (fidelity.verdict === "uncheckable") {
      console.log(`   scrape-fidelity: – ${fidelity.summary}`);
    } else {
      console.log(`   scrape-fidelity: ✓ ${fidelity.summary}`);
    }
  }

  // About-fidelity guard: invented concrete claims in the LLM-authored prose.
  const about = gates.aboutFidelity;
  if (about?.verdict === "fabrication") {
    console.warn(`\n⚠ About-tekst: ${about.claims.length} mogelijk verzonnen claim(s) [${about.model}]:`);
    for (const c of about.claims) {
      console.warn(`   • "${c.quote}"`);
      console.warn(`     ${c.issue}`);
    }
    console.warn(`   → Controleer/herschrijf de about of genereer opnieuw vóór verzending.`);
  } else if (about) {
    console.log(`   about-fidelity: clean`);
  } else if (!dryRun && facts && gates.aboutFidelitySkipped) {
    console.warn(`   about-fidelity check overgeslagen: ${gates.aboutFidelitySkipped}`);
  }

  // Photo curation: report-only (a failed classification degrades to listing
  // order — warn the operator, never block).
  const pc = gates.photoCuration;
  if (pc.status === "applied") {
    const mix = Object.entries(pc.counts ?? {})
      .map(([kind, n]) => `${kind} ${n}`)
      .join(", ");
    const dupes = pc.droppedDuplicates ? ` · ${pc.droppedDuplicates} duplicaat/duplicaten weggelaten` : "";
    const ignored = pc.ignoredDuplicateFlags
      ? ` · ${pc.ignoredDuplicateFlags} duplicaat-flags genegeerd (verdacht veel — alles behouden)`
      : "";
    console.log(`   foto-curatie: ✓ [${pc.model}] ${mix}${dupes}${ignored}`);
  } else if (pc.status === "failed") {
    console.warn(`   foto-curatie mislukt — foto's in listingvolgorde: ${pc.reason}`);
  }

  if (gates.verdict === "needs_review") {
    console.warn(`\n⚠ Verdict: NEEDS REVIEW — ${gates.reasons.join(" · ")}`);
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

    // The batch worker protects lead-owned slugs (pickMockupSlug); the CLI must
    // not bypass that — a colliding hand-run push would replace another salon's
    // mockup behind its live mock URL. Allowed only when it's provably the SAME
    // salon (the --treatwell URL matches the lead's listing).
    const existing = await getMockupBySlug(client, config.slug);
    if (existing?.lead_id) {
      const lead = await getLeadById(client, existing.lead_id);
      const sameSalon =
        values.treatwell && lead?.listing_url && normalizeTreatwellUrl(values.treatwell) === lead.listing_url;
      if (!sameSalon) {
        console.error(
          `\n✗ Slug '${config.slug}' hoort bij batch-lead ${existing.lead_id} (${lead?.listing_url ?? "listing onbekend"}).` +
            `\n  Push geweigerd — anders overschrijft deze run die mockup achter zijn live URL.` +
            `\n  Zelfde salon? Run dan met --treatwell ${lead?.listing_url ?? "<listing-url>"} zodat het aantoonbaar matcht.` +
            `\n  Andere salon? Geef deze een eigen slug (bijv. via --name met plaatsnaam) en push opnieuw.`,
        );
        process.exit(1);
      }
    }

    const row = await upsertMockupBySlug(client, { slug: config.slug, config, source, placeId, brief, model: run.model });
    console.log(`✓ Pushed to Supabase 'mockups' (id ${row.id}, source ${row.source})`);
    // A pushed mockup is live on the DEPLOYED mock app — the shareable URL and
    // the opener must never default to localhost (a pasted localhost link is a
    // wasted opener; the wa.me message would carry it verbatim).
    const base = process.env.REVIVO_MOCK_BASE_URL ?? DEFAULT_MOCK_BASE_URL;
    const mockUrl = `${base.replace(/\/$/, "")}/${config.slug}`;
    console.log(`\nShareable mockup URL:\n   ${mockUrl}`);

    // The opener (B4): the ready-to-send first message for THIS mockup. Same
    // builder as scripts/build-openers.ts — deterministic, hook from real data.
    const opener = buildOpener({ config, mockUrl, facts });
    console.log(`\nOpener (hook: ${opener.hook}):`);
    console.log(
      opener.whatsappUrl
        ? `   WhatsApp: ${opener.whatsappUrl}`
        : `   WhatsApp: geen NL-mobiel bekend → gebruik IG-DM of e-mail`,
    );
    console.log("\n" + opener.plainText.split("\n").map((l) => `   ${l}`).join("\n") + "\n");
  } else {
    console.log("\nPreview it locally:");
    console.log(`   cd apps/customer-template && REVIVO_CONFIG="${relConfig}" pnpm dev`);
    console.log(`   # or via the mock app:  cd apps/mockups && pnpm dev   → http://localhost:4321/${config.slug}\n`);
  }
}

main().catch((err) => {
  // A scrape-fidelity MISMATCH found before a failed generation rides on the
  // error (see runMockupPipeline) — surface it, it's the more important signal.
  const fidelity = (err as { scrapeFidelity?: FidelityReport }).scrapeFidelity;
  if (fidelity?.verdict === "mismatch") {
    console.warn(`\n⚠ Scrape-fidelity: ${fidelity.summary}`);
    console.warn(`   → De Treatwell-scrape kan stuk zijn (layout gewijzigd?). Controleer vóór een nieuwe poging.`);
  }
  console.error("\n✗ " + (err as Error).message + "\n");
  process.exit(1);
});
