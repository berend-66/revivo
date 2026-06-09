import type { ListingFacts } from "./listing-facts";
import type { SiteConfig } from "./site-config";
import { dutchMobileToWaNumber, isDutchMobile } from "./phone";

/**
 * The opener builder (roadmap B4): a generated mockup → a ready-to-send Dutch
 * first message. Deterministic, templated, NO LLM — at 20 sends we measure
 * whether the copy is too samey before paying for model variation.
 *
 * The whole play is SPECIFICITY, and specificity only works when every claim
 * is TRUE. The cardinal sin applies to the opener even more than the mockup:
 * one checkable false statement ("op Treatwell" for a salon that isn't there,
 * "jullie echte prijzen" over an invented menu, praise for a 2,9★) and the
 * owner knows the message isn't really about them. So every fragment here is
 * assembled from data that is genuinely present, and degrades to PLAINER copy
 * — never to fabricated enthusiasm:
 *   - the platform ("op Treatwell") is derived from the facts' source URL /
 *     the reputation's own source field, never defaulted;
 *   - the rating hook requires a rating worth complimenting (≥ 4.5 with ≥ 25
 *     reviews for the strong variant, ≥ 4.0 for the mild one);
 *   - the menu-item hook cites only a REAL (scraped) item that is still on
 *     the current config;
 *   - the "what's in the mockup" clause lists only what the mockup really
 *     carries from scraped data (prijzen/team/reviews).
 *
 * Lives in @revivo/shared because it is pure templating over the shared
 * contracts (SiteConfig + ListingFacts) and every surface needs it: the
 * gen-mockup CLI (after --push), scripts/build-openers.ts, the C2 worklist.
 */

/** The deployed mock host, until mock.revivo.nl lands. Callers (CLI, scripts)
 * use this as the env-overridable default — deliberately NOT localhost, a
 * pasted localhost link is a wasted opener. buildOpener itself still takes the
 * full URL; it never assembles one. */
export const DEFAULT_MOCK_BASE_URL = "https://revivo-mockups.vercel.app";

export interface OpenerInput {
  config: SiteConfig;
  /** Full public mockup URL (e.g. https://mock.revivo.nl/utrecht-hairstyle) —
   * the caller owns the base URL; never hardcode one here. */
  mockUrl: string;
  /** Richer hook material when the lead came from a listing. */
  facts?: ListingFacts | null;
}

export interface Opener {
  /** wa.me deep link with the message pre-filled — ONLY for a Dutch mobile
   * (a landline cannot host WhatsApp; a dead link kills the opener). */
  whatsappUrl?: string;
  /** Compact single-paragraph variant for an Instagram DM. */
  igDmText: string;
  emailSubject: string;
  emailBody: string;
  /** The canonical message (what the WhatsApp link carries). */
  plainText: string;
  /** Which specificity hook was used — operator visibility (and a samey-ness check). */
  hook: string;
}

const nlNumber = new Intl.NumberFormat("nl-NL");

function fmtRating(rating: number): string {
  return String(rating).replace(".", ",");
}

/** "Where I found you" — only ever a platform the data actually names. */
function platformOf(config: SiteConfig, facts?: ListingFacts | null): string | undefined {
  if (facts) {
    if (facts.reputation?.source) return facts.reputation.source;
    try {
      if (new URL(facts.sourceUrl).hostname.includes("treatwell")) return "Treatwell";
    } catch {
      // sourceUrl is schema-validated; defensive only
    }
    return undefined;
  }
  return config.reputation?.source;
}

/** "a, b en c" — Dutch list join. */
function nlList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} en ${parts[parts.length - 1]}`;
}

/** The most specific TRUE thing we can say, in descending strength:
 * praiseworthy rating (+count) → real menu item still on the config → city.
 * The platform is omitted from the hook when the intro already names it. */
function pickHook(config: SiteConfig, facts: ListingFacts | null | undefined, platform?: string): string {
  const rep = config.reputation ?? facts?.reputation;
  if (rep) {
    const stars = `${fmtRating(rep.rating)}★`;
    // Name the rating's own source only when it differs from the intro's platform.
    const src = rep.source && rep.source !== platform ? ` op ${rep.source}` : "";
    if (rep.rating >= 4.5 && rep.reviewCount && rep.reviewCount >= 25) {
      return `${stars} met ${nlNumber.format(rep.reviewCount)} reviews${src} — dat zie je niet vaak`;
    }
    if (rep.rating >= 4.0) {
      return `${stars}${src}, mooi om te zien`;
    }
    // A rating that isn't a compliment is not a hook. Fall through.
  }
  // Only a SCRAPED menu item (facts), and only if the current config still
  // shows it — a config-invented item would be a fabricated claim.
  const item = facts?.services?.[0]?.items?.[0];
  const stillOnConfig =
    item && config.services.some((c) => c.items.some((i) => i.name === item.name));
  if (item && stillOnConfig) {
    return `mooi aanbod, met o.a. ${item.name.toLowerCase()}`;
  }
  return `mooie salon in ${config.location.city}`;
}

/** What the mockup REALLY carries from scraped data — never claim more. */
function realContentsClause(config: SiteConfig, facts?: ListingFacts | null): string | undefined {
  const parts: string[] = [];
  if (facts?.services?.length && config.services.length) parts.push("jullie echte prijzen");
  if (facts?.team?.length && config.team?.length) parts.push("jullie team");
  if (facts?.reviews?.length && config.testimonials?.length) parts.push("echte reviews");
  return parts.length ? nlList(parts) : undefined;
}

/** encodeURIComponent leaves ! ' ( ) * raw; an unencoded ' or ) in a salon
 * name makes terminal/chat linkifiers truncate the wa.me URL mid-message. */
function encodeWaText(text: string): string {
  return encodeURIComponent(text).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildOpener(input: OpenerInput): Opener {
  const { config, mockUrl, facts } = input;
  const name = config.brand.name;
  const platform = platformOf(config, facts);
  const hook = pickHook(config, facts, platform);
  const foundOn = platform ? `op ${platform}` : "online";

  const contents = realContentsClause(config, facts);
  const madeLine = contents
    ? `Ik bouw websites voor salons en heb er voor jullie alvast één gemaakt, met ${contents} erin:`
    : `Ik bouw websites voor salons en heb alvast een voorbeeld gemaakt van hoe jullie eigen site eruit kan zien:`;

  const plainText = [
    `Hoi! Ik kwam ${name} ${foundOn} tegen — ${hook}.`,
    madeLine,
    mockUrl,
    `Kijk gerust even rond — benieuwd wat je ervan vindt. Niets voor jullie? Ook helemaal prima.`,
    `Groet, Berend`,
  ].join("\n\n");

  const igDmText =
    `Hoi! Ik kwam ${name} ${foundOn} tegen — ${hook}. ` +
    (contents
      ? `Ik bouw websites voor salons en maakte alvast een voorbeeld met ${contents} erin: `
      : `Ik bouw websites voor salons en maakte alvast een voorbeeld van hoe jullie eigen site eruit kan zien: `) +
    `${mockUrl} — benieuwd wat je ervan vindt!`;

  const emailSubject = `Een website-voorbeeld voor ${name}`;
  const emailBody = [
    `Hoi,`,
    `Ik kwam ${name} ${foundOn} tegen — ${hook}.`,
    contents
      ? `Ik bouw websites voor kappers en salons. Om te laten zien wat ik bedoel heb ik alvast een voorbeeld gemaakt van hoe jullie eigen site eruit kan zien — met ${contents} erin:`
      : `Ik bouw websites voor kappers en salons. Om te laten zien wat ik bedoel heb ik alvast een voorbeeld gemaakt van hoe jullie eigen site eruit kan zien:`,
    mockUrl,
    `Kijk gerust even rond. Vragen of feedback hoor ik graag; en is het niets voor jullie, dan ook helemaal prima.`,
    `Groet,\nBerend`,
  ].join("\n\n");

  // First candidate that is genuinely a Dutch mobile — a landline in
  // contact.phone must not shadow a mobile we know from the listing.
  const mobile = [config.contact.whatsapp, config.contact.phone, facts?.phone].find((p) =>
    isDutchMobile(p ?? undefined),
  );
  const waNumber = dutchMobileToWaNumber(mobile ?? undefined);
  const whatsappUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeWaText(plainText)}` : undefined;

  return { whatsappUrl, igDmText, emailSubject, emailBody, plainText, hook };
}
