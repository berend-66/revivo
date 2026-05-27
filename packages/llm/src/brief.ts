import { z } from "zod";

/**
 * SalonBrief — the minimal human/sourced input the generator turns into a full
 * SiteConfig. In manual mode (Stage 2 MVP) you fill this by hand or paste from
 * a prospect's Instagram bio. In places mode (later) it's assembled from a
 * Google Place + Instagram scrape.
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
