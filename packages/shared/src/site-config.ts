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

const ServiceItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  /** Price in EUR. Use `null` for "vanaf"/quote-only services. */
  price: z.number().nullable(),
  durationMin: z.number().int().positive().optional(),
});

const ServiceCategorySchema = z.object({
  category: z.string(),
  items: z.array(ServiceItemSchema).min(1),
});

const GalleryItemSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
  /** Optional aspect-ratio hint for layouts that vary cell sizes. */
  aspect: z.enum(["square", "portrait", "landscape"]).optional(),
});

const HoursRowSchema = z.object({
  day: z.string(),
  open: z.string().optional(),
  close: z.string().optional(),
  closed: z.boolean().optional(),
});

const TestimonialSchema = z.object({
  author: z.string(),
  quote: z.string(),
  rating: z.number().int().min(1).max(5).optional(),
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
    postcode: z.string(),
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

  legal: z.object({
    kvk: z.string(),
    btw: z.string().optional(),
  }),

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
