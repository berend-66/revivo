import { z } from "zod";

/**
 * SiteConfig — the complete data spec a customer site needs to render.
 *
 * The same shape powers every variant (Atelier / Studio / Neon) and is the
 * artifact the mockup-generator pipeline produces from a salon's brief (and
 * later, Google Place + Instagram). Validate with `SiteConfigSchema.parse(json)`
 * before rendering; the LLM occasionally produces near-misses that Zod catches.
 *
 * This lives in @revivo/shared because both the customer-template (consumer)
 * and packages/llm (producer) depend on it. It is a CONTRACT — changing the
 * shape ripples to every variant and the generator prompt. See
 * apps/customer-template/CLAUDE.md.
 */

const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected #rrggbb hex color");

// Exported (not just the inferred type) so the listing-facts schema can reuse
// these as runtime Zod schemas — the scraped facts share SiteConfig's shapes.
export const ServiceItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  /** Price in EUR. Use `null` for quote-only services. */
  price: z.number().nullable(),
  /** True when `price` is a from-price (the listing showed "vanaf" or a price
   * range) — variants render "vanaf €X". Showing a from-price as a flat price
   * misstates the salon's own menu, the cardinal sin. */
  from: z.boolean().optional(),
  durationMin: z.number().int().positive().optional(),
});

export const ServiceCategorySchema = z.object({
  category: z.string(),
  items: z.array(ServiceItemSchema).min(1),
});

const GalleryItemSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
  /** Optional aspect-ratio hint for layouts that vary cell sizes. */
  aspect: z.enum(["square", "portrait", "landscape"]).optional(),
});

export const HoursRowSchema = z.object({
  day: z.string(),
  open: z.string().optional(),
  close: z.string().optional(),
  closed: z.boolean().optional(),
});

export const TestimonialSchema = z.object({
  author: z.string(),
  quote: z.string(),
  rating: z.number().int().min(1).max(5).optional(),
  source: z.string().optional(),
});

// A named stylist/staff member. Populated ONLY from a real source (e.g. a
// Treatwell listing) — never invented by the generator. `rating`/`reviewCount`
// are per-stylist where the source exposes them.
export const TeamMemberSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
  /** A short focus / "what clients say" tag (e.g. a top review sentiment). */
  specialty: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  photoUrl: z.string().url().optional(),
});

// Aggregate reputation, e.g. "4,7★ op Treatwell · 2.907 reviews". Sourced from a
// real listing, never fabricated — distinct from the per-quote `testimonials`.
export const ReputationSchema = z.object({
  /** Aggregate star rating, 0–5 (e.g. 4.7). */
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative().optional(),
  /** Where the rating comes from, e.g. "Treatwell" or "Google". */
  source: z.string().optional(),
});

export const LAYOUT_VARIANTS = ["atelier", "studio", "neon"] as const;

export const SiteConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "lowercase kebab-case"),
  layout: z.enum(LAYOUT_VARIANTS),

  brand: z.object({
    name: z.string(),
    tagline: z.string().optional(),
    logoUrl: z.string().url().optional(),
    colors: z.object({
      primary: ColorSchema,
      accent: ColorSchema.optional(),
      ink: ColorSchema.optional(),
      surface: ColorSchema.optional(),
    }),
  }),

  hero: z.object({
    headline: z.string(),
    subheadline: z.string().optional(),
    images: z.array(z.string().url()).min(1).max(4),
    /** Optional CTA override; defaults to "Boek een afspraak" → booking. */
    cta: z
      .object({
        label: z.string(),
        href: z.string(),
      })
      .optional(),
  }),

  about: z.object({
    heading: z.string(),
    body: z.array(z.string()).min(1),
    portrait: z.string().url().optional(),
    stats: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  }),

  services: z.array(ServiceCategorySchema).min(1),

  gallery: z.array(GalleryItemSchema).min(2),

  hours: z.array(HoursRowSchema).length(7),

  location: z.object({
    address: z.string(),
    /** Optional by design: Treatwell listings carry NO postcode, and a required
     * field forced the model to invent one — verifiably wrong on 7 of the first
     * 13 batch mockups. Present only when a real source (Google Places, the
     * operator) supplies it; variants render-if-present. */
    postcode: z.string().optional(),
    city: z.string(),
    country: z.string().optional().default("Nederland"),
    lat: z.number().optional(),
    lng: z.number().optional(),
    transitNotes: z.string().optional(),
  }),

  booking: z.object({
    provider: z.enum(["treatwell", "salonized", "booksy", "phorest", "cal", "custom"]),
    iframeUrl: z.string().url().optional(),
    externalUrl: z.string().url().optional(),
    label: z.string().optional(),
  }),

  contact: z.object({
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    email: z.string().email().optional(),
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    tiktok: z.string().optional(),
  }),

  testimonials: z.array(TestimonialSchema).optional(),

  // Named stylists + aggregate reputation. Additive + optional so every existing
  // example/row keeps validating, and all variants render-if-present (like
  // `testimonials`). Both are SOURCED (Treatwell listing), never invented — the
  // generator omits them and `applyListingFacts` fills them deterministically.
  team: z.array(TeamMemberSchema).optional(),

  reputation: ReputationSchema.optional(),

  // Optional by design: the mockup generator must NOT fabricate a KvK/BTW —
  // they are public, verifiable identifiers and a made-up number is an instant
  // credibility break on an opener the salon owner inspects. Real values come
  // from Stage-4 KvK enrichment; until present the footer omits the line.
  // `.default({})` lets the model omit the whole block (so it never retries over
  // a "missing legal" schema error) while keeping `config.legal` always present
  // for the variant footers. See packages/llm/src/prompts/mockup-system.ts.
  legal: z
    .object({
      kvk: z.string().optional(),
      btw: z.string().optional(),
    })
    .default({}),

  meta: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      locale: z.enum(["nl-NL", "en-NL"]).default("nl-NL"),
    })
    .default({ locale: "nl-NL" }),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;
export type LayoutVariant = (typeof LAYOUT_VARIANTS)[number];
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;
export type ServiceItem = z.infer<typeof ServiceItemSchema>;
export type GalleryItem = z.infer<typeof GalleryItemSchema>;
export type HoursRow = z.infer<typeof HoursRowSchema>;
export type Testimonial = z.infer<typeof TestimonialSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type Reputation = z.infer<typeof ReputationSchema>;
