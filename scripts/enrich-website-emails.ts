/**
 * Enriches pending leads with email addresses found on the salon's own website.
 *
 * Treatwell never exposes email addresses. This script closes that gap:
 *   1. Google Places text search → websiteUri (one call per lead)
 *   2. Fetch homepage + /contact page → extract first mailto: address
 *   3. Write email back into listing_facts_json in Supabase
 *
 * Usage:
 *   pnpm enrich-emails                     # all pending leads without email
 *   pnpm enrich-emails --city amsterdam    # filter by city
 *   pnpm enrich-emails --limit 20          # cap at N leads
 *   pnpm enrich-emails --dry-run           # print without writing to DB
 */

import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createServiceClient } from "@revivo/db";

dotenv.config({ path: resolve(fileURLToPath(import.meta.url), "../../.env") });

const { values } = parseArgs({
  options: {
    city: { type: "string" },
    limit: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(`Usage: pnpm enrich-emails [options]

Options:
  --city <city>    Filter leads by city (case-insensitive)
  --limit <n>      Stop after N leads (default: 50)
  --dry-run        Print results without writing to DB
  --help           Show this help
`);
  process.exit(0);
}

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";
if (!GOOGLE_API_KEY) {
  console.error("GOOGLE_PLACES_API_KEY not set in .env — cannot look up website URLs");
  process.exit(1);
}

const DRY_RUN = values["dry-run"] ?? false;
const LIMIT = Math.min(parseInt(values.limit ?? "50", 10) || 50, 200);
const CITY_FILTER = values.city?.toLowerCase();

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ── Google Places ──────────────────────────────────────────────────────────

async function findWebsiteUri(name: string, city: string): Promise<string | null> {
  const query = `${name} ${city} kapper`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.websiteUri",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1, regionCode: "NL", languageCode: "nl" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`  Places API ${res.status}: ${body.slice(0, 120)}`);
    return null;
  }
  const json = (await res.json()) as any;
  const place = json?.places?.[0];
  if (!place) return null;
  const website = place.websiteUri as string | undefined;
  return website ?? null;
}

// ── Website email extraction ───────────────────────────────────────────────

const EMAIL_RE = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
// Bare email fallback (contact pages often list emails as plain text)
const BARE_EMAIL_RE = /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g;

// Domains we never want to return as "the salon's email"
const BLACKLISTED_DOMAINS = new Set([
  "treatwell.nl", "treatwell.com", "google.com", "facebook.com",
  "instagram.com", "salonized.com", "booksy.com", "example.com",
  "fresha.com", "phorest.com",
]);

function isValidSalonEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (BLACKLISTED_DOMAINS.has(lower.split("@")[1] ?? "")) return false;
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".svg")) return false;
  return true;
}

function extractEmailFromHtml(html: string): string | null {
  // Prefer explicit mailto: links
  const mailtos: string[] = [];
  let m: RegExpExecArray | null;
  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(html))) {
    if (m[1] && isValidSalonEmail(m[1])) mailtos.push(m[1].toLowerCase());
  }
  if (mailtos.length) return mailtos[0]!;

  // Fallback: bare email addresses in text
  BARE_EMAIL_RE.lastIndex = 0;
  while ((m = BARE_EMAIL_RE.exec(html))) {
    if (m[1] && isValidSalonEmail(m[1])) return m[1].toLowerCase();
  }
  return null;
}

async function fetchEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  const fetchPage = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA, "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  // Try homepage first
  const home = await fetchPage(websiteUrl);
  if (home) {
    const email = extractEmailFromHtml(home);
    if (email) return email;
  }

  // Try /contact page
  const base = new URL(websiteUrl).origin;
  for (const path of ["/contact", "/contact-us", "/contacteer-ons", "/over-ons"]) {
    const contactHtml = await fetchPage(`${base}${path}`);
    if (contactHtml) {
      const email = extractEmailFromHtml(contactHtml);
      if (email) return email;
    }
  }

  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────

const client = createServiceClient();

// Load pending leads without an email address
let query = client
  .from("leads")
  .select("id, name, city, listing_facts_json")
  .eq("status", "pending")
  .limit(LIMIT);

if (CITY_FILTER) query = query.ilike("city", CITY_FILTER);

const { data: leads, error } = await query;
if (error) { console.error("DB error:", error.message); process.exit(1); }
if (!leads?.length) { console.log("Geen pending leads gevonden."); process.exit(0); }

// Only process leads without an email already
const toEnrich = leads.filter((l) => !l.listing_facts_json?.email);
console.log(`${toEnrich.length} leads zonder emailadres (van ${leads.length} opgehaald)\n`);

let found = 0;
let notFound = 0;

for (const lead of toEnrich) {
  const name = lead.listing_facts_json?.name ?? lead.name ?? "Onbekend";
  const city = lead.city ?? "";
  process.stdout.write(`${name} (${city}) ... `);

  // Step 1: find website via Google Places
  const websiteUrl = await findWebsiteUri(name, city);
  if (!websiteUrl) {
    console.log("geen website gevonden op Places");
    notFound++;
    continue;
  }

  // Step 2: extract email from website
  const email = await fetchEmailFromWebsite(websiteUrl);
  if (!email) {
    console.log(`website: ${websiteUrl} — geen emailadres`);
    notFound++;
    continue;
  }

  console.log(`✓ ${email} (via ${websiteUrl})`);
  found++;

  if (!DRY_RUN) {
    const updatedFacts = { ...(lead.listing_facts_json ?? {}), email, websiteUrl };
    const { error: updateErr } = await client
      .from("leads")
      .update({ listing_facts_json: updatedFacts })
      .eq("id", lead.id);
    if (updateErr) console.warn(`  DB update mislukt: ${updateErr.message}`);
  }

  // Politeness: don't hammer websites
  await new Promise((r) => setTimeout(r, 500));
}

console.log(`\nKlaar: ${found} emails gevonden, ${notFound} niet gevonden`);
if (DRY_RUN) console.log("(dry-run — niets weggeschreven naar DB)");
