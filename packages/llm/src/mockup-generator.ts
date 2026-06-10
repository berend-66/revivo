import { SiteConfigSchema, slugify, type SiteConfig, type SalonBrief, type ListingFacts } from "@revivo/shared";
import { createLLMClient, type LLMClient } from "./client";
import { MOCKUP_SYSTEM_PROMPT } from "./prompts/mockup-system";

export interface GenerateResult {
  config: SiteConfig;
  usage?: { inputTokens: number; outputTokens: number };
  attempts: number;
}

/**
 * brief → SiteConfig via the LLM. Validates with Zod and retries once with the
 * validation error fed back, since models occasionally miss the schema by a
 * field. Image URLs are deterministically rewritten afterwards (see
 * `normalizeImagesInPlace`) so a flaky model can never break rendering.
 *
 * When `facts` are supplied (a real Treatwell listing), the architecture is
 * "facts deterministic, voice LLM": the facts are surfaced to the model as
 * authoritative grounding for its VOICE (copy/colour/layout), then
 * `applyListingFacts` deterministically overwrites the factual fields of the
 * returned config (services, prices, hours, team, reputation, reviews, contact,
 * booking, location, photos). The model's invented facts are discarded — only
 * its voice survives — so model drift can never reach the mockup.
 */
export async function generateMockup(
  brief: SalonBrief,
  client: LLMClient = createLLMClient(),
  facts?: ListingFacts,
): Promise<GenerateResult> {
  const userMessage = briefToMessage(brief, facts);
  let lastError = "";
  // Accumulated over ALL attempts — a schema retry costs a second full
  // completion, and the spend estimate downstream must not undercount it.
  let totalIn = 0;
  let totalOut = 0;
  let sawUsage = false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const user =
      attempt === 1
        ? userMessage
        : `${userMessage}\n\nJe vorige antwoord was ongeldig:\n${lastError}\nLever opnieuw, nu exact volgens het schema.`;

    const { text, usage } = await client.complete({
      system: MOCKUP_SYSTEM_PROMPT,
      user,
      json: true,
      maxTokens: 4096,
      temperature: 0.7,
    });
    if (usage) {
      sawUsage = true;
      totalIn += usage.inputTokens;
      totalOut += usage.outputTokens;
    }

    const parsed = safeParseJson(text);
    if (!parsed.ok) {
      lastError = parsed.error;
      continue;
    }

    // Rewrite image URLs to deterministic placeholders BEFORE validation — the
    // model's image URLs are discarded anyway, so they must never trigger a
    // costly retry over a malformed URL.
    normalizeImagesInPlace(parsed.value);
    // Models intermittently emit `null` for optional string fields (e.g. a
    // service `description: null`), which fails an `.optional()` Zod check —
    // strip those before validating so a stray null never forces a retry.
    stripStrayNullsInPlace(parsed.value);

    const result = SiteConfigSchema.safeParse(parsed.value);
    if (!result.success) {
      lastError = result.error.issues
        .map((i) => `- ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      continue;
    }

    const config = facts ? SiteConfigSchema.parse(applyListingFacts(result.data, facts)) : result.data;
    return {
      config,
      usage: sawUsage ? { inputTokens: totalIn, outputTokens: totalOut } : undefined,
      attempts: attempt,
    };
  }

  throw new Error(`Mockup generation failed schema validation after 2 attempts:\n${lastError}`);
}

function briefToMessage(brief: SalonBrief, facts?: ListingFacts): string {
  const lines = [
    `Naam: ${brief.name}`,
    `Stad: ${brief.city}`,
    `Type: ${brief.type}`,
    `Taal: ${brief.language}`,
  ];
  if (brief.vibe) lines.push(`Vibe/karakter: ${brief.vibe}`);
  if (brief.address) lines.push(`Adres: ${brief.address}`);
  if (brief.postcode) lines.push(`Postcode: ${brief.postcode}`);
  if (brief.instagram) lines.push(`Instagram: @${brief.instagram}`);
  if (brief.website) lines.push(`Huidige website: ${brief.website}`);
  if (brief.knownServices) lines.push(`Bekende diensten/prijzen:\n${brief.knownServices}`);
  if (brief.preferLayout) lines.push(`Voorkeur layout: ${brief.preferLayout}`);
  // Only surface Google rating/coords when we lack richer listing facts — the
  // ECHTE GEGEVENS block below supersedes them (and avoids conflicting numbers).
  if (!facts) {
    if (typeof brief.rating === "number") {
      const reviews = typeof brief.reviewCount === "number" ? ` (${brief.reviewCount} reviews)` : "";
      lines.push(
        `Google-rating: ${brief.rating}★${reviews} — toon dit hooguit als '${brief.rating}★ op Google${reviews}', NOOIT als aantal (tevreden) klanten.`,
      );
    }
    if (typeof brief.lat === "number" && typeof brief.lng === "number") {
      lines.push(`Coördinaten (gebruik exact deze in location.lat/lng): ${brief.lat}, ${brief.lng}`);
    }
  }
  if (brief.notes) lines.push(`Notities: ${brief.notes}`);

  let msg = `Briefing voor de salon:\n${lines.join("\n")}`;
  if (facts) msg += `\n\n${factsToGrounding(facts)}`;
  return msg;
}

/**
 * Render the scraped facts as an authoritative grounding block so the model's
 * VOICE (copy, palette, layout) fits the real salon — even though these exact
 * fields get deterministically overwritten by `applyListingFacts` afterwards.
 * It is told to omit team/reputation/testimonials (filled from facts) and to
 * spend its effort on the parts that are genuinely its job.
 */
function factsToGrounding(facts: ListingFacts): string {
  const L: string[] = [];
  if (facts.reputation) {
    const r = facts.reputation;
    L.push(
      `Reputatie: ${fmtRating(r.rating)}★ op ${r.source ?? "Treatwell"}${
        r.reviewCount ? ` (${r.reviewCount} reviews)` : ""
      }`,
    );
  }
  if (facts.team?.length) {
    L.push(
      `Team (${facts.team.length} ${facts.team.length === 1 ? "stylist" : "stylisten"}): ${facts.team
        .map((t) => t.name)
        .join(", ")}`,
    );
  }
  if (facts.services?.length) {
    L.push(`Diensten-categorieën: ${facts.services.map((c) => c.category).join("; ")}`);
    const samples = facts.services
      .map((c) => c.items[0])
      .filter((i): i is NonNullable<typeof i> => Boolean(i))
      .slice(0, 6)
      // Keep the vanaf qualifier in the model's voice grounding too — echoing a
      // from-price as a flat price in a headline is the same misstatement class.
      .map((i) => `${i.name} ${i.price != null ? `${i.from ? "vanaf " : ""}${fmtEuro(i.price)}` : "op aanvraag"}`);
    if (samples.length) L.push(`Voorbeeldprijzen: ${samples.join(" · ")}`);
  }
  if (facts.address) {
    const coords =
      facts.lat !== undefined && facts.lng !== undefined ? ` (coördinaten ${facts.lat}, ${facts.lng})` : "";
    // The ligging pin lives HERE, next to the data, not only in the system
    // prompt's rule list: the first hardened batch still produced "in het hart
    // van Utrecht" in 6/14 generations on the system rule alone.
    L.push(
      `Locatie: ${facts.address}${facts.city ? `, ${facts.city}` : ""}${coords} — beschrijf de ligging NIET verder dan dit adres + stad (geen "hartje"/"centrum"/"loopafstand"/wijk; de salon zit mogelijk buiten het centrum).`,
    );
  }
  if (facts.description) {
    L.push(
      `Over de salon (ECHTE omschrijving, door de salon zélf geschreven — dit is je ENIGE bron voor de about-copy): "${facts.description
        .slice(0, 700)
        .trim()}". Herschrijf dit in je eigen woorden en toon, maar voeg GEEN concrete details toe die hier niet in staan — geen verzonnen muziekgenre, drankjes, geuren, inrichting, jaartallen of sfeerclaims. Elke feitelijke bewering in de about moet terug te voeren zijn op deze omschrijving of de bovenstaande gegevens.`,
    );
  }

  return [
    "# ECHTE GEGEVENS (bron: Treatwell) — LEIDEND",
    "Deze feiten zijn geverifieerd en worden NA jouw antwoord automatisch en exact in de config gezet (diensten + prijzen, openingstijden, team, reputatie, reviews, telefoon, boeking, locatie, foto's). Verzin hier NIETS bij en spreek ze NIET tegen. Laat team, reputation én testimonials zélf WEG uit je JSON — die worden uit deze echte data gevuld. Besteed je aandacht aan wat WEL jouw taak is en bij deze échte salon past: de layout-keuze, het kleurenpalet, de merknaam-stijl, hero headline/subheadline, about-copy, tagline, gallery-captions en meta.",
    ...L,
  ].join("\n");
}

function fmtRating(n: number): string {
  return String(n).replace(".", ",");
}

function fmtEuro(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
  return `€${s}`;
}

/**
 * Deterministic facts passthrough — the second half of "facts deterministic,
 * voice LLM". Overwrites the factual fields of a generated config with the
 * scraped truth, discarding whatever the model invented for them. Only touches a
 * field when the listing actually provides it, so a partial listing degrades
 * gracefully (and a salon with no listing keeps the hardened omit-don't-invent
 * behaviour). Returns a new config; the caller re-validates it.
 */
export function applyListingFacts(config: SiteConfig, facts: ListingFacts): SiteConfig {
  const next: SiteConfig = structuredClone(config);

  if (facts.services?.length) next.services = facts.services;
  if (facts.hours?.length === 7) next.hours = facts.hours;
  if (facts.team?.length) next.team = facts.team;
  if (facts.reputation) next.reputation = facts.reputation;
  if (facts.reviews?.length) next.testimonials = facts.reviews;
  if (facts.phone) next.contact = { ...next.contact, phone: facts.phone };

  // A real, clickable booking URL (the listing itself) — replaces the hardened
  // "custom, no URL" fallback now that we genuinely have one.
  if (facts.bookingUrl) {
    next.booking = {
      provider: "treatwell",
      externalUrl: facts.bookingUrl,
      label: next.booking.label ?? "Boek online via Treatwell",
    };
  }

  // Location: overwrite only what the listing provides; keep the LLM/Google
  // postcode (Treatwell has no postcode; the brief carries Google's when known).
  if (facts.address) next.location.address = facts.address;
  if (facts.city) next.location.city = facts.city;
  if (facts.postcode) next.location.postcode = facts.postcode;
  if (facts.lat !== undefined) next.location.lat = facts.lat;
  if (facts.lng !== undefined) next.location.lng = facts.lng;
  // Model-authored transitNotes are DROPPED in facts mode: no listing field
  // carries transit info, so any value here is invented — the ligging-claim
  // class the batch audit caught ("op loopafstand van het station" for a salon
  // 3 km out). The prompt forbids it too, but this makes it deterministic.
  delete next.location.transitNotes;

  // Photos, sized dynamically to however many the listing has. The picsum
  // placeholders from `normalizeImagesInPlace` survive only when there are none.
  if (facts.photos?.length) {
    const photos = facts.photos;
    next.hero.images = photos.slice(0, Math.min(4, photos.length));
    if (photos.length >= 2) {
      next.gallery = photos.map((url, i) => {
        const caption = config.gallery[i]?.caption;
        return { url, aspect: "landscape" as const, ...(caption ? { caption } : {}) };
      });
    }
    // The editorial portrait (atelier's About) is also an image — without this
    // the model's picsum placeholder survives and renders on a real mockup.
    // Prefer one beyond the hero set for variety; fall back to the last available.
    next.about.portrait = photos[Math.min(4, photos.length - 1)];
  }

  return next;
}

interface ParseOk {
  ok: true;
  value: unknown;
}
interface ParseErr {
  ok: false;
  error: string;
}

/** Extract a JSON object from model output, tolerating ```json fences and prose. */
function safeParseJson(text: string): ParseOk | ParseErr {
  let candidate = text.trim();

  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidate = fence[1].trim();

  if (!candidate.startsWith("{")) {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last > first) candidate = candidate.slice(first, last + 1);
  }

  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }
}

const ASPECT_DIMS: Record<string, [number, number]> = {
  portrait: [1200, 1500],
  landscape: [1600, 1100],
  square: [1200, 1200],
};

function picsum(seed: string, w: number, h: number): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

/**
 * Recursively delete `null`-valued keys before validation. The model sometimes
 * emits `null` for optional fields (e.g. a service `description: null`), which
 * Zod rejects under `.optional()`. `price` is the one field that is legitimately
 * `z.number().nullable()` ("op aanvraag"), so its `null` is preserved.
 */
function stripStrayNullsInPlace(node: unknown): void {
  if (Array.isArray(node)) {
    for (const x of node) stripStrayNullsInPlace(x);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, val] of Object.entries(node as Record<string, unknown>)) {
      if (val === null && k !== "price") delete (node as Record<string, unknown>)[k];
      else stripStrayNullsInPlace(val);
    }
  }
}

/**
 * Overwrite every image URL with a deterministic picsum URL seeded by slug +
 * role, mutating the raw parsed object in place BEFORE Zod validation. The LLM
 * controls structure (counts, aspects, captions); we guarantee URLs are valid
 * and stable. Defensive against missing/odd fields since this runs pre-validation.
 * Real salon photos replace these in a later stage.
 */
function normalizeImagesInPlace(raw: unknown): void {
  if (typeof raw !== "object" || raw === null) return;
  const c = raw as Record<string, any>;
  const s =
    (typeof c.slug === "string" && c.slug) ||
    (c.brand?.name ? slugify(c.brand.name) : "mockup");

  if (Array.isArray(c.hero?.images)) {
    c.hero.images = c.hero.images.map((_: unknown, i: number) =>
      picsum(`${s}-hero-${i + 1}`, 1800, 2200),
    );
  }

  if (Array.isArray(c.gallery)) {
    c.gallery = c.gallery.map((g: any, i: number) => {
      const aspect = g?.aspect === "landscape" || g?.aspect === "square" ? g.aspect : "portrait";
      const [w, h] = ASPECT_DIMS[aspect]!;
      return { ...g, url: picsum(`${s}-g${i + 1}`, w, h) };
    });
  }

  if (c.about && typeof c.about === "object" && c.about.portrait) {
    c.about.portrait = picsum(`${s}-portrait`, 1200, 1500);
  }
}
