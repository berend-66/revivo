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
 *   - we deliberately do NOT name where we found them ("op Treatwell"/"online"):
 *     telling a salon their online presence is already strong undercuts the
 *     pitch. The intro is just "Ik kwam {name} tegen, {hook}";
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

/** Our own marketing site — linked at the end of every opener as the "more
 * info / who we are" follow-up. Brand constant, not env-configurable. */
export const MARKETING_URL = "https://revivostudios.io/";

export interface OpenerInput {
  config: SiteConfig;
  /** Full public mockup URL (e.g. https://mock.revivo.nl/utrecht-hairstyle) —
   * the caller owns the base URL; never hardcode one here. */
  mockUrl: string;
  /** Richer hook material when the lead came from a listing. */
  facts?: ListingFacts | null;
  /** True when the salon has NO own website — enables the stronger "eerste
   * website" angle instead of the generic "ik heb een voorbeeld gemaakt". */
  noWebsite?: boolean;
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

/** "a, b en c" — Dutch list join. */
function nlList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} en ${parts[parts.length - 1]}`;
}

/** The most specific TRUE thing we can say, in descending strength:
 * praiseworthy rating (+count) → real menu item still on the config → city.
 * No platform is ever named (we don't tell them their online presence is set). */
function pickHook(config: SiteConfig, facts: ListingFacts | null | undefined): string {
  const rep = config.reputation ?? facts?.reputation;
  if (rep) {
    const stars = `${fmtRating(rep.rating)}★`;
    if (rep.rating >= 4.5 && rep.reviewCount && rep.reviewCount >= 25) {
      return `${stars} met ${nlNumber.format(rep.reviewCount)} reviews, mooi om te zien`;
    }
    if (rep.rating >= 4.0) {
      return `${stars}, mooi om te zien`;
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
  const { config, mockUrl, facts, noWebsite } = input;
  const name = config.brand.name;
  const hook = pickHook(config, facts);

  let plainText: string;
  let igDmText: string;
  let emailSubject: string;
  let emailBody: string;

  if (noWebsite) {
    // Stronger angle: this would be their FIRST website, not an upgrade.
    // Lead with the gap ("nog geen eigen website"), not with discovery ("ik kwam jullie tegen").
    const contents = realContentsClause(config, facts);
    const contentsNote = contents ? `, met ${contents} erin,` : "";

    plainText = [
      `Hoi! Ik zag dat ${name} nog geen eigen website heeft — maar wel ${hook}!`,
      `We hebben alvast een complete eerste versie voor jullie gemaakt${contentsNote}:`,
      mockUrl,
      `Kijk gerust even rond. Als jullie het mooi vinden: €999 eenmalig, live in 5 werkdagen. Geen aanbetaling, geen risico.\nMeer info: ${MARKETING_URL}`,
      `Groetjes, Berend`,
    ].join("\n\n");

    igDmText =
      `Hoi! Ik zag dat ${name} nog geen eigen website heeft — maar wel ${hook}! ` +
      `We maakten alvast een complete eerste versie${contentsNote}: ` +
      `${mockUrl} — €999 eenmalig, 5 werkdagen live. Geen aanbetaling. Meer info: ${MARKETING_URL}`;

    emailSubject = `Een website voor ${name} — klaar om te bekijken`;
    emailBody = [
      `Hoi,`,
      `Ik zag dat ${name} nog geen eigen website heeft — maar wel ${hook}!`,
      `We bouwen websites voor kappers en salons. Om te laten zien wat dat voor jullie kan worden, hebben we alvast een complete eerste versie gemaakt${contentsNote}:`,
      mockUrl,
      `Kijk gerust even rond. Als jullie het mooi vinden: €999 eenmalig, live in 5 werkdagen. Geen aanbetaling, geen risico. Meer over ons: ${MARKETING_URL}`,
      `Groetjes,\nBerend`,
    ].join("\n\n");
  } else {
    const contents = realContentsClause(config, facts);
    const madeLine = contents
      ? `Ik bouw websites voor salons en heb er voor jullie één gemaakt, met ${contents} erin:`
      : `Ik bouw websites voor salons en heb een voorbeeld gemaakt van hoe jullie eigen site eruit kan zien:`;

    plainText = [
      `Hoi! Ik kwam ${name} tegen, ${hook}!`,
      madeLine,
      mockUrl,
      `Kijk gerust even rond, benieuwd wat je ervan vindt! Ik hoor graag als je geïnteresseerd bent 😁\nVerdere info kan je op onze eigen website vinden: ${MARKETING_URL}`,
      `Groetjes, Berend`,
    ].join("\n\n");

    igDmText =
      `Hoi! Ik kwam ${name} tegen, ${hook}! ` +
      (contents
        ? `Ik bouw websites voor salons en maakte een voorbeeld met ${contents} erin: `
        : `Ik bouw websites voor salons en maakte een voorbeeld van hoe jullie eigen site eruit kan zien: `) +
      `${mockUrl} — benieuwd wat je ervan vindt! Ik hoor graag als je geïnteresseerd bent 😁 Meer info: ${MARKETING_URL}`;

    emailSubject = `Een website-voorbeeld voor ${name}`;
    emailBody = [
      `Hoi,`,
      `Ik kwam ${name} tegen, ${hook}!`,
      contents
        ? `Ik bouw websites voor kappers en salons. Om te laten zien wat ik bedoel heb ik er voor jullie één gemaakt, met ${contents} erin:`
        : `Ik bouw websites voor kappers en salons. Om te laten zien wat ik bedoel heb ik een voorbeeld gemaakt van hoe jullie eigen site eruit kan zien:`,
      mockUrl,
      `Kijk gerust even rond, benieuwd wat je ervan vindt! Ik hoor graag als je geïnteresseerd bent. Meer over ons: ${MARKETING_URL}`,
      `Groetjes,\nBerend`,
    ].join("\n\n");
  }

  // First candidate that is genuinely a Dutch mobile — a landline in
  // contact.phone must not shadow a mobile we know from the listing.
  const mobile = [config.contact.whatsapp, config.contact.phone, facts?.phone].find((p) =>
    isDutchMobile(p ?? undefined),
  );
  const waNumber = dutchMobileToWaNumber(mobile ?? undefined);
  const whatsappUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeWaText(plainText)}` : undefined;

  return { whatsappUrl, igDmText, emailSubject, emailBody, plainText, hook };
}
