import { z } from "zod";
import type { SiteConfig, ListingFacts } from "@revivo/shared";
import { createLLMClient, type LLMClient } from "./client";

/**
 * About-fidelity check — the cheap, RELIABLE fabrication guard.
 *
 * The mockup's facts are deterministic (scraped → `applyListingFacts`), so the only
 * place the LLM can be "confidently wrong about the owner's own business" is the VOICE
 * it authors: the about-prose. The failure class to catch is an invented concrete,
 * checkable atmosphere/story detail — a music genre ("vaak klinkt er Spaanse muziek"),
 * drinks, scents, interior details, awards, a founding year, "X jaar ervaring", a
 * fabricated backstory — that doesn't trace to the salon's real source material. One
 * such detail tells the owner the text isn't really about them and breaks the moat.
 *
 * This is a TEXT problem (about-copy vs the salon's real description + known facts), not
 * a screenshot problem — so it's done with a short, reliable text-LLM call, NOT the noisy
 * screenshot-vision comparator (which, measured on the first real salon, produced a 100%
 * false-positive rate — misreading prices, hours, and phone digits off a downscaled page).
 * Generic tone words ("warm", "persoonlijk", "rustig") are NOT claims and are ignored.
 */

export const AboutClaimSchema = z.object({
  /** The exact phrase from the about-text that asserts an unsupported fact. */
  quote: z.string(),
  /** Why it isn't supported by the source material. */
  issue: z.string(),
  kind: z.enum(["atmosphere", "award", "year", "experience", "backstory", "other"]).optional(),
});
export type AboutClaim = z.infer<typeof AboutClaimSchema>;

const ModelSchema = z.object({
  claims: z.array(AboutClaimSchema).default([]),
  verdict: z.enum(["clean", "fabrication"]).default("clean"),
});

export interface AboutFidelityReport {
  verdict: "clean" | "fabrication";
  claims: AboutClaim[];
  model: string;
  /** Tokens this check itself spent — counted into the batch cost estimate. */
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AboutFidelityInput {
  config: SiteConfig;
  facts: ListingFacts;
  client?: LLMClient;
}

const SYSTEM = `Je bent een strenge feitencheck-redacteur voor revivo, dat op maat gemaakte salonwebsites levert. De "over ons"-tekst van een salon wordt naar de ÉCHTE salon-eigenaar gestuurd als opener. Daarom mag de tekst GEEN concrete, controleerbare bewering bevatten die niet uit het bronmateriaal volgt — één verzonnen detail (een specifiek muziekgenre, drankjes, geuren, inrichting, een award, een jaartal, "X jaar ervaring", een verzonnen achtergrondverhaal) verraadt meteen dat de tekst niet écht over deze salon gaat.

Je krijgt (1) het BRONMATERIAAL (de echte omschrijving van de salon + bekende feiten) en (2) de te controleren TEKST. Markeer ALLEEN concrete, verifieerbare beweringen in de TEKST die NIET door het bronmateriaal worden gedekt.

WEL markeren: een specifiek muziekgenre, geserveerde drankjes, geuren, concrete inrichtingsdetails, awards/prijzen, een oprichtingsjaar of "sinds 19xx", "X jaar ervaring/bestaat al X jaar", een persoonlijk achtergrondverhaal of herkomst die niet in de bron staat, een specialisme dat de salon niet aanbiedt.

NIET markeren: algemene toon en sfeerwoorden zonder controleerbare claim ("warm", "persoonlijk", "rustig", "vakkundig", "welkom"); herformuleringen van wat wél in de bron staat; algemene uitnodigingen ("kom langs"); feiten die in de bekende feiten staan (plaats, aangeboden diensten, teamleden, beoordeling).

Geef ALLEEN een JSON-object terug, zonder tekst eromheen:
{
  "claims": [ { "quote": "<letterlijke zin/zinsdeel uit de TEKST>", "issue": "<waarom niet gedekt>", "kind": "atmosphere|award|year|experience|backstory|other" } ],
  "verdict": "clean" | "fabrication"
}
"verdict" is "fabrication" zodra er minstens één claim is, anders "clean". Bij twijfel of iets een echte controleerbare claim is: NIET markeren (liever een gemiste dan een valse alarm).`;

/** Compile everything we legitimately know about this salon into the allowed source. */
function buildSource(config: SiteConfig, facts: ListingFacts): string {
  const lines: string[] = [];
  if (facts.description?.trim()) {
    lines.push(`Echte omschrijving van de salon (door de salon zelf geschreven):\n"${facts.description.trim()}"`);
  }
  const city = config.location?.city ?? facts.city;
  if (city) lines.push(`Plaats: ${city}`);
  if (config.location?.address) lines.push(`Adres: ${config.location.address}`);
  const services = config.services?.flatMap((c) => [c.category, ...c.items.map((i) => i.name)]) ?? [];
  if (services.length) lines.push(`Aangeboden diensten/categorieën: ${services.join(", ")}`);
  const team = (config.team ?? []).map((t) => t.name).filter(Boolean);
  if (team.length) lines.push(`Teamleden: ${team.join(", ")}`);
  if (config.reputation) {
    lines.push(
      `Beoordeling: ${config.reputation.rating}★` +
        (config.reputation.reviewCount ? ` (${config.reputation.reviewCount} reviews)` : "") +
        (config.reputation.source ? ` op ${config.reputation.source}` : ""),
    );
  }
  return lines.join("\n");
}

/** Collect the LLM-authored prose that could carry an invented factual claim. */
function buildText(config: SiteConfig): string {
  const parts: string[] = [];
  if (config.brand.tagline) parts.push(config.brand.tagline);
  if (config.hero.headline) parts.push(config.hero.headline);
  if (config.hero.subheadline) parts.push(config.hero.subheadline);
  if (config.about.heading) parts.push(config.about.heading);
  parts.push(...config.about.body);
  return parts.join("\n\n");
}

function extractJsonObject(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`about-check returned no JSON object. Raw: ${text.slice(0, 200)}`);
  }
  return JSON.parse(s.slice(start, end + 1));
}

/**
 * Flag concrete claims in the mockup's about-prose that aren't supported by the salon's
 * real description + known facts. Returns `{verdict:"clean", claims:[]}` when faithful.
 * No-op-safe: if there's no real description to check against, returns clean.
 */
export async function checkAboutFidelity(input: AboutFidelityInput): Promise<AboutFidelityReport> {
  const client = input.client ?? createLLMClient();
  if (!input.facts.description?.trim()) {
    return { verdict: "clean", claims: [], model: client.model };
  }

  const source = buildSource(input.config, input.facts);
  const text = buildText(input.config);

  const res = await client.complete({
    system: SYSTEM,
    user: `BRONMATERIAAL:\n${source}\n\n----\n\nTE CONTROLEREN TEKST (de "over ons" + koppen van de mockup):\n${text}\n\nGeef het JSON-object.`,
    json: true,
    maxTokens: 1200,
    temperature: 0,
  });

  const parsed = ModelSchema.parse(extractJsonObject(res.text));
  // Derive verdict from claims in code (don't trust the model's own bookkeeping).
  const verdict = parsed.claims.length > 0 ? "fabrication" : "clean";
  return { verdict, claims: parsed.claims, model: client.model, usage: res.usage };
}
