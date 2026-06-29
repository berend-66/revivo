import { z } from "zod";
import {
  ServiceCategorySchema,
  HoursRowSchema,
  TestimonialSchema,
  TeamMemberSchema,
  ReputationSchema,
} from "./site-config";

/**
 * ListingFacts — the salon's REAL, verified facts as scraped from its public
 * listing (today: Treatwell). This is the third leg of the brief→config pipeline:
 *
 *   SalonBrief   — what we know going in (name, city, vibe, Google grounding)
 *   ListingFacts — the authoritative truth (menu, prices, hours, team, reviews)
 *   SiteConfig   — the rendered site
 *
 * Architecture: facts deterministic, voice LLM. The LLM authors only voice
 * (brand, colours, headline, about prose, captions, layout); these factual
 * fields are then deterministically written into the SiteConfig by
 * `applyListingFacts`, so model drift on facts can never reach the mockup. That
 * is the fix for the "confidently wrong about the owner's own business" failure —
 * a mockup must mirror the salon's real menu/prices/team, not invent them.
 *
 * It lives in @revivo/shared because the producer (`@revivo/sourcing`, which
 * scrapes + parses with NO LLM) and the consumer (`@revivo/llm`, which grounds
 * the prompt and applies the passthrough) both depend on it. Reuses SiteConfig's
 * own sub-schemas so a fact maps 1:1 into the config it overwrites. Every field
 * is optional — a listing may expose only some of them, and a salon with no
 * Treatwell page yields none (falling back to Google-only, which omits rather
 * than invents).
 */
export const ListingFactsSchema = z.object({
  /** The canonical listing URL the facts were scraped from. */
  sourceUrl: z.string().url(),
  name: z.string().optional(),
  /** Plain-text salon description (HTML stripped) — voice grounding, not copied verbatim. */
  description: z.string().optional(),
  phone: z.string().optional(),
  /** Instagram handle WITHOUT the @ (e.g. "cremode_hair_beautysalon"), or a full
   * profile URL. Verified to belong to this exact salon before storing. */
  instagram: z.string().optional(),
  /** Street line, e.g. "Lange Jansstraat 6". */
  address: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  /** A real, clickable booking URL (the listing itself). */
  bookingUrl: z.string().url().optional(),
  services: z.array(ServiceCategorySchema).optional(),
  /** Up to 7 day-rows in week order, mirroring SiteConfig.hours. */
  hours: z.array(HoursRowSchema).optional(),
  team: z.array(TeamMemberSchema).optional(),
  reputation: ReputationSchema.optional(),
  /** Curated real reviews (the listing's own), already mapped to testimonials. */
  reviews: z.array(TestimonialSchema).optional(),
  /** Real salon photo URLs, best-resolution first. Key-free / public-safe. */
  photos: z.array(z.string().url()).optional(),
});

export type ListingFacts = z.infer<typeof ListingFactsSchema>;
