# customer-template — agent context

A single Astro app that renders any salon's website from one `SiteConfig` JSON. Same data, three completely different design DNAs (variants), chosen per-salon by `config.layout`.

This app serves two roles:
1. **Mockup display** (Stage 2 onward) — `mock.revivo.nl/{slug}` will fork or wrap this app and feed it the LLM-generated `SiteConfig`.
2. **Production customer site** (Stage 5) — the final website each paying customer gets is a build of this app with their `SiteConfig` baked in.

## The variant pattern

```
src/
  types/site-config.ts        # The contract — Zod schema + TypeScript type
  data/load-config.ts         # Reads + validates from REVIVO_CONFIG env var
  pages/index.astro           # Single page that switches on config.layout
  variants/
    atelier/
      Layout.astro            # Self-contained variant page (html + head + body)
      sections/*.astro        # 8 sections; each takes { config: SiteConfig }
    studio/  ...
    neon/    ...
  styles/
    atelier.css               # ONE per variant. Loaded only by that Layout.
    studio.css
    neon.css
examples/
  lume-atelier.json
  mast-studio.json
  spark-hair.json
```

Each variant `Layout.astro` is a **complete page**: `<html>`, `<head>`, fonts, body, and all sections. **Variants do not share CSS, fonts, or section components.** Sharing would compromise the variant-as-distinct-personality model.

## Variant DNAs

| Variant | Aesthetic | Display font | Body | Mono | Vibe |
|---|---|---|---|---|---|
| **atelier** | warm editorial magazine | Fraunces (var opsz/SOFT/WONK) | DM Sans | DM Mono | refined, mature, slow |
| **studio** | brutalist high-fashion minimal | Bricolage Grotesque (var wdth) | IBM Plex Sans | IBM Plex Mono | confident, restrained, modern |
| **neon** | contemporary maximalist | Unbounded | Hanken Grotesk | JetBrains Mono | energetic, bold, young |

Brand color comes from `config.brand.colors.primary`. Atelier uses it as decorative accent; Studio uses it sparingly as a single sharp accent; Neon uses it dominantly (color-blocked sections, oversized prices, pill CTAs).

## `SiteConfig` is a contract

`src/types/site-config.ts` defines the Zod schema for `SiteConfig`. This shape is **the artifact the mockup-generator LLM in Stage 2 must produce.** Changing the shape breaks the LLM prompt and every downstream variant.

When you must change `SiteConfig`:
1. Update the Zod schema + TypeScript type.
2. Update every example config in `examples/` to match.
3. Update every variant that consumes the changed field.
4. Once Stage 2 ships, also update the LLM extraction prompt + cached system prompt.

**Don't add optional escape hatches** ("if field X exists, render Y differently") — that erodes the contract. Either the field is in the schema (and every variant handles it) or it's not.

## Adding a new variant

(Don't do this unless asked.) Steps:

1. Add the variant name to the `layout` enum in `src/types/site-config.ts`.
2. Create `src/styles/<name>.css` — define a `@theme` block with brand tokens and any custom utilities. Pick fonts **distinct from existing variants**. Don't reuse Fraunces, Bricolage, or Unbounded.
3. Create `src/variants/<name>/Layout.astro` + `src/variants/<name>/sections/*.astro`. Reuse the standard sections (Hero, About, Services, Gallery, etc) or invent new ones — anything goes, but **every section must take `{ config: SiteConfig }`** and read only from that.
4. Register in `src/pages/index.astro` variant map.
5. Add an example config to `examples/<name>.json` with `"layout": "<name>"`.
6. Add a `dev:<name>` script to `package.json`.
7. Screenshot desktop + mobile.

## Image handling

The example configs use `https://picsum.photos/seed/...` URLs — **placeholders, not the design intent**. Real salon sites will pull from the salon's Instagram photos via the mockup-generator pipeline. Don't replace picsum with stock images in the examples — keep them as obviously-placeholder seeded URLs so the design is clearly the point.

Photo-quality risks to be aware of: salon Insta photos are mostly vertical/square/filtered. Hero sections that demand a horizontal landscape will look weird. Each variant's Hero handles this differently:
- Atelier: tall portrait photo on right (matches Insta aspect)
- Studio: framed portrait inset bottom-right
- Neon: rotated portrait with color-block offset

## Booking widgets

`config.booking.iframeUrl` is the embed URL when the salon already has Treatwell / Salonized / Booksy / etc. The variants currently don't actually iframe it — they link to `config.booking.externalUrl` instead. **Don't add the iframe embed until we've actually tested with each provider** — each has its own embed JS and sizing quirks.

## Running locally

```bash
pnpm dev:atelier         # examples/lume-atelier.json
pnpm dev:studio          # examples/mast-studio.json
pnpm dev:neon            # examples/spark-hair.json

# Custom config:
REVIVO_CONFIG=examples/<your>.json pnpm dev
```

The config path is resolved relative to `apps/customer-template/`.

## Hard rules specific to this app

- **Don't mix the revivo brand with customer brands.** revivo's burgundy + cream + Cormorant lives in `apps/marketing/`, not here. The customer-template has no revivo branding — these are *the salon's* sites.
- **Don't share CSS across variants.** See above.
- **Don't add features that only one variant uses to `SiteConfig`.** If "Atelier needs a quote section but Studio/Neon don't" — make all three handle a `testimonials` field (the existing pattern), or don't add the section. No variant-specific schema fields.
- **Don't fetch from the network in `Layout.astro` or sections.** Astro frontmatter runs at build time; the LLM stage already did the data work. Sections read from `props.config` only.
