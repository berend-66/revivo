import { SiteConfigSchema, slugify, type SiteConfig, type SalonBrief } from "@revivo/shared";
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
 * `withDeterministicImages`) so a flaky model can never break rendering.
 */
export async function generateMockup(
  brief: SalonBrief,
  client: LLMClient = createLLMClient(),
): Promise<GenerateResult> {
  const userMessage = briefToMessage(brief);
  let lastError = "";

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

    const parsed = safeParseJson(text);
    if (!parsed.ok) {
      lastError = parsed.error;
      continue;
    }

    // Rewrite image URLs to deterministic placeholders BEFORE validation — the
    // model's image URLs are discarded anyway, so they must never trigger a
    // costly retry over a malformed URL.
    normalizeImagesInPlace(parsed.value);

    const result = SiteConfigSchema.safeParse(parsed.value);
    if (!result.success) {
      lastError = result.error.issues
        .map((i) => `- ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      continue;
    }

    return { config: result.data, usage, attempts: attempt };
  }

  throw new Error(`Mockup generation failed schema validation after 2 attempts:\n${lastError}`);
}

function briefToMessage(brief: SalonBrief): string {
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
  if (brief.notes) lines.push(`Notities: ${brief.notes}`);
  return `Briefing voor de salon:\n${lines.join("\n")}`;
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
