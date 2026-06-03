import { z } from "zod";

/**
 * SalonBrief — the minimal input contract the mockup generator turns into a full
 * SiteConfig. It is the INPUT counterpart to SiteConfig (the output): the brief
 * is what we know about a salon, SiteConfig is the site we render for it.
 *
 * Three ways a brief is assembled, all converging on this one shape:
 *   1. Manual flags / a pasted Instagram bio (Stage 2 MVP, CLI).
 *   2. Places mode — `@revivo/sourcing` maps a Google Place (+ Instagram-light)
 *      into a brief (`placeToBrief`).
 *   3. The full sourcing pipeline (Stage 4) feeds the same `placeToBrief`.
 *
 * It lives in @revivo/shared because it is a contract shared by the producer of
 * briefs (`@revivo/sourcing`) and their consumer (`@revivo/llm`). Keeping it
 * here means sourcing never has to depend on the LLM package.
 */
export const SalonBriefSchema = z.object({
  name: z.string(),
  city: z.string(),
  type: z.enum(["hair", "beauty", "both"]).default("hair"),
  /** Free-text character description — the single most useful field for the LLM. */
  vibe: z.string().optional(),
  address: z.string().optional(),
  postcode: z.string().optional(),
  instagram: z.string().optional(),
  website: z.string().optional(),
  /** Pasted price list / services, free text. The LLM structures it. */
  knownServices: z.string().optional(),
  /** Preferred copy language. */
  language: z.enum(["nl", "en"]).default("nl"),
  /** Optional steer toward a specific variant; otherwise the LLM picks. */
  preferLayout: z.enum(["atelier", "studio", "neon"]).optional(),
  notes: z.string().optional(),
});

export type SalonBrief = z.infer<typeof SalonBriefSchema>;

/** Lowercase kebab-case slug from a salon name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
