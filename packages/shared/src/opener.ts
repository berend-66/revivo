import type { ListingFacts } from "./listing-facts";
import type { SiteConfig } from "./site-config";
import { dutchMobileToWaNumber, isDutchMobile } from "./phone";

/**
 * The opener builder (roadmap B4): a generated mockup → a ready-to-send Dutch
 * first message. Deterministic, templated, NO LLM — at 20 sends we measure
 * whether the copy is too samey before paying for model variation.
 *
 * Shape follows docs/OUTREACH.md §4 ("lead with the artifact"):
 *   - ONE link (the live mockup). The marketing site is NOT in the WhatsApp/IG
 *     body — a second link dilutes the click and raises spam score; it lives in
 *     the e-mail signature only. The brand name rides in the sign-off instead.
 *   - ONE call to action: a low-friction OPINION question ("wat zou je als
 *     eerste anders willen zien?") — not "ben je geïnteresseerd?", which asks
 *     for a buying-signal the reader hasn't formed yet and is easy to ignore.
 *   - An OPT-OUT line on every message (legal: art. 11.7 Tw / GDPR art. 21, and
 *     it lowers the WhatsApp block-rate that actually kills the channel).
 *   - Two variants by hook strength: a praiseworthy RATING leads the message
 *     (Variant A); a weak hook (menu item / city only) drops the flattery and
 *     lets the artifact be the compliment (Variant B).
 *   - A no-website variant (`noWebsite`): when the salon has no own site, lead
 *     with that gap ("nog geen eigen website") — this would be their FIRST site,
 *     a stronger pitch — and surface the low-risk terms (€999 / 5 werkdagen /
 *     geen aanbetaling) once. Same one-link / opt-out / question-CTA rules.
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

/** Our own marketing site — linked ONLY in the e-mail signature (the "who we
 * are" follow-up). Kept out of the WhatsApp/IG body on purpose: one link only.
 * Brand constant, not env-configurable. */
export const MARKETING_URL = "https://revivostudios.io/";

/** Named campaign variants for the opener intro.
 *  "wk-nl-ma" = NL vs Marokko WK match day — references the game
 *  as a casual reason to share the mockup. */
export type OpenerCampaign = "wk-nl-ma";

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
  /** Optional named campaign that replaces the generic intro with a
   * timely hook (e.g. a match day). Copy stays factual — only the
   * framing changes; the mockup link + contents clause are unchanged. */
  campaign?: OpenerCampaign;
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

/** Sign-off carries the brand name (the "who we are" cue, since the WhatsApp/IG
 * body has no marketing link) + the opt-out (legal + protects the number). */
const SIGN_OFF = "Groetjes, Berend (Revivo Studios)";
const OPT_OUT = "Geen interesse? Eén berichtje terug en je hoort niets meer van me.";

function fmtRating(rating: number): string {
  return String(rating).replace(".", ",");
}

/** "a, b en c" — Dutch list join. */
function nlList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} en ${parts[parts.length - 1]}`;
}

type HookTier = "strong" | "mild" | "menu" | "city";

interface HookResult {
  /** Operator-facing descriptor of why this lead got picked (printed in build-openers). */
  text: string;
  tier: HookTier;
  /** The real scraped menu item, lowercased — only set on the "menu" tier. */
  menuItem?: string;
}

/** The most specific TRUE thing we can say, in descending strength:
 * praiseworthy rating (+count) → real menu item still on the config → city.
 * No platform is ever named (we don't tell them their online presence is set).
 * The TIER also drives message shape: a rating LEADS the message (Variant A);
 * a menu item / city does not (Variant B — the artifact is the compliment). */
function pickHook(config: SiteConfig, facts: ListingFacts | null | undefined): HookResult {
  const rep = config.reputation ?? facts?.reputation;
  if (rep) {
    const stars = `${fmtRating(rep.rating)}★`;
    if (rep.rating >= 4.5 && rep.reviewCount && rep.reviewCount >= 25) {
      return { text: `${stars} met ${nlNumber.format(rep.reviewCount)} reviews, mooi om te zien`, tier: "strong" };
    }
    if (rep.rating >= 4.0) {
      return { text: `${stars}, mooi om te zien`, tier: "mild" };
    }
    // A rating that isn't a compliment is not a hook. Fall through.
  }
  // Only a SCRAPED menu item (facts), and only if the current config still
  // shows it — a config-invented item would be a fabricated claim.
  const item = facts?.services?.[0]?.items?.[0];
  const stillOnConfig =
    item && config.services.some((c) => c.items.some((i) => i.name === item.name));
  if (item && stillOnConfig) {
    const menuItem = item.name.toLowerCase();
    return { text: `mooi aanbod, met o.a. ${menuItem}`, tier: "menu", menuItem };
  }
  return { text: `mooie salon in ${config.location.city}`, tier: "city" };
}

/** What the mockup REALLY carries from scraped data — never claim more. */
function realContentsClause(config: SiteConfig, facts?: ListingFacts | null): string | undefined {
  const parts: string[] = [];
  if (facts?.services?.length && config.services.length) parts.push("jullie echte prijzen");
  if (facts?.team?.length && config.team?.length) parts.push("jullie team");
  if (facts?.reviews?.length && config.testimonials?.length) parts.push("echte reviews");
  return parts.length ? nlList(parts) : undefined;
}

/** The "Met … erin." clause naming what the mockup verifiably carries: an
 * optional real menu item (weak-hook tiers only) + the scraped contents list.
 * Empty string when nothing is certified — the message degrades to plainer
 * copy, never to a fabricated claim. */
function madeClause(menuItem: string | undefined, contents: string | undefined): string {
  if (menuItem && contents) return ` Met o.a. ${menuItem} en ${contents} erin.`;
  if (menuItem) return ` Met o.a. ${menuItem} erin.`;
  if (contents) return ` Met ${contents} erin.`;
  return "";
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
  const { config, mockUrl, facts, noWebsite, campaign } = input;
  const name = config.brand.name;
  const hook = pickHook(config, facts);
  const contents = realContentsClause(config, facts);

  // A praiseworthy rating leads the message; a weak hook does not.
  const leadWithHook = hook.tier === "strong" || hook.tier === "mild";
  // The menu item is only surfaced (in the "Met … erin" clause) on the weak path.
  const made = leadWithHook ? madeClause(undefined, contents) : madeClause(hook.menuItem, contents);

  // The one channel where a brand link belongs (in the signature) — shared by all variants.
  const emailSignature = `Groetjes,\nBerend — Revivo Studios\n${MARKETING_URL}`;
  const emailOptOut = "Geen interesse of liever geen e-mail meer? Eén reply en je hoort niets meer van me.";

  let plainText: string;
  let igDmText: string;
  let emailSubject: string;
  let emailBody: string;

  if (campaign === "wk-nl-ma") {
    // Match-day campaign: NL vs Marokko WK. Football-themed framing, same
    // mockup link + sign-off. "finale versie" is an intentional double meaning.
    // noWebsite distinction kept for the subject line only — body is unified.
    plainText = [
      `Hoi! Jij ook NL-Marokko aan het kijken? 👀`,
      `Ik maak websites voor salons zodat jullie ook op het hoogste niveau kunnen spelen. Om ervoor te zorgen dat je in de rust wat kan kijken om je wakker te houden heb ik alvast een eerste versie gemaakt voor ${name}:`,
      mockUrl,
      `Neem alvast een kijkje en laat me weten wat je ervan vindt :)\nIk kijk graag met je mee zodat we over een week een finale versie kunnen hebben in jouw stijl!`,
      `Groetjes, Nelson\n${MARKETING_URL}`,
    ].join("\n\n");

    igDmText =
      `Hoi! Jij ook NL-Marokko? 👀 Ik maak websites voor salons zodat jullie ook op het hoogste niveau kunnen spelen — kijk even in de rust naar wat ik voor ${name} gemaakt heb: ${mockUrl} — laat me weten wat je ervan vindt, zodat we over een week een finale versie hebben in jouw stijl! ${MARKETING_URL}`;

    emailSubject = noWebsite
      ? `Een website voor ${name} — even bekijken in de rust`
      : `Een website-voorbeeld voor ${name} — even bekijken in de rust`;

    emailBody = [
      `Hoi,`,
      `Jij ook NL-Marokko aan het kijken? 👀`,
      `Ik maak websites voor salons zodat jullie ook op het hoogste niveau kunnen spelen. Om ervoor te zorgen dat je in de rust wat kan kijken heb ik alvast een eerste versie gemaakt voor ${name}:`,
      mockUrl,
      `Neem alvast een kijkje en laat me weten wat je ervan vindt :)\nIk kijk graag met je mee zodat we over een week een finale versie kunnen hebben in jouw stijl!`,
      `Groetjes,\nNelson\n${MARKETING_URL}`,
    ].join("\n\n");
  } else if (noWebsite) {
    // Stronger angle: this would be their FIRST website, not an upgrade. Lead
    // with the gap ("nog geen eigen website"), weave the hook in as a "maar wel",
    // and surface the low-risk terms once. Same one-link / opt-out / question-CTA.
    plainText = [
      `Hoi! Ik zag dat ${name} nog geen eigen website heeft — maar wel ${hook.text} 🙂`,
      `Ik bouw websites voor salons en heb er alvast een eerste voor ${name} gemaakt.${made} Kijk maar:`,
      mockUrl,
      `Benieuwd wat je ervan vindt — wat zou je als eerste anders willen zien? (Als het bevalt: €999, live in 5 werkdagen, geen aanbetaling.)`,
      `${SIGN_OFF}\n${OPT_OUT}`,
    ].join("\n\n");

    igDmText =
      `Hoi! Ik zag dat ${name} nog geen eigen website heeft — maar wel ${hook.text} 🙂 ` +
      `Ik bouw websites voor salons en maakte alvast een eerste voor ${name}.${made} Kijk maar: ${mockUrl} ` +
      `— benieuwd wat je ervan vindt, wat zou je als eerste anders willen zien? (€999, 5 werkdagen live, geen aanbetaling.) ${SIGN_OFF}. ${OPT_OUT}`;

    emailSubject = `Een eerste website voor ${name}`;
    emailBody = [
      `Hoi,`,
      `Ik zag dat ${name} nog geen eigen website heeft — maar wel ${hook.text}!`,
      `Ik bouw websites voor kappers en salons. Om te laten zien wat dat voor ${name} kan worden, heb ik er alvast een eerste versie gemaakt.${made}`,
      mockUrl,
      `Benieuwd wat je ervan vindt — wat zou je als eerste anders willen zien? Als het bevalt: €999 eenmalig, live in 5 werkdagen, geen aanbetaling.`,
      emailSignature,
      emailOptOut,
    ].join("\n\n");
  } else {
    // --- canonical message (what the WhatsApp link carries) : ONE link, ONE CTA ---
    plainText = leadWithHook
      ? [
          `Hoi! Ik kwam ${name} tegen — ${hook.text} 🙂`,
          `Ik bouw websites voor salons en heb er alvast eentje voor ${name} gemaakt.${made} Kijk maar:`,
          mockUrl,
          `Benieuwd wat je ervan vindt — wat zou je als eerste anders willen zien?`,
          `${SIGN_OFF}\n${OPT_OUT}`,
        ].join("\n\n")
      : [
          `Hoi! Ik bouw websites voor salons en heb er voor ${name} alvast eentje gemaakt.${made} Kijk maar:`,
          mockUrl,
          `Benieuwd wat je ervan vindt — wat zou je graag anders zien?`,
          `${SIGN_OFF}\n${OPT_OUT}`,
        ].join("\n\n");

    // --- Instagram DM : compact one-paragraph form, same one-link/one-CTA rules ---
    const igIntro = leadWithHook
      ? `Hoi! Ik kwam ${name} tegen — ${hook.text} 🙂 Ik bouw websites voor salons en heb er alvast eentje voor ${name} gemaakt.${made} Kijk maar: ${mockUrl}`
      : `Hoi! Ik bouw websites voor salons en heb er voor ${name} alvast eentje gemaakt.${made} Kijk maar: ${mockUrl}`;
    igDmText = `${igIntro} — benieuwd wat je ervan vindt, wat zou je als eerste anders willen zien? ${SIGN_OFF}. ${OPT_OUT}`;

    // --- e-mail : the one channel where a brand link belongs (in the signature) ---
    emailSubject = `${name}, wat vind je hiervan?`;
    emailBody = (
      leadWithHook
        ? [
            `Hoi,`,
            `Ik kwam ${name} tegen — ${hook.text}!`,
            `Ik bouw websites voor kappers en salons. Om te laten zien wat ik bedoel heb ik er alvast eentje voor ${name} gemaakt.${made}`,
            mockUrl,
            `Benieuwd wat je ervan vindt — wat zou je als eerste anders willen zien?`,
            emailSignature,
            emailOptOut,
          ]
        : [
            `Hoi,`,
            `Ik bouw websites voor kappers en salons. Om te laten zien wat ik bedoel heb ik er voor ${name} alvast eentje gemaakt.${made}`,
            mockUrl,
            `Benieuwd wat je ervan vindt — wat zou je graag anders zien?`,
            emailSignature,
            emailOptOut,
          ]
    ).join("\n\n");
  }

  // First candidate that is genuinely a Dutch mobile — a landline in
  // contact.phone must not shadow a mobile we know from the listing.
  const mobile = [config.contact.whatsapp, config.contact.phone, facts?.phone].find((p) =>
    isDutchMobile(p ?? undefined),
  );
  const waNumber = dutchMobileToWaNumber(mobile ?? undefined);
  const whatsappUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeWaText(plainText)}` : undefined;

  return { whatsappUrl, igDmText, emailSubject, emailBody, plainText, hook: hook.text };
}
