# @revivo/sourcing — agent context

Turns external salon data into a `SalonBrief` (the generator's input contract).
Today: **places mode** — a Google Place (+ Instagram-light) → `SalonBrief`. Stage 4
will add the KvK enrichment + the cron that batch-sources leads through this same code.

```
config.ts          → GOOGLE_PLACES_API_KEY → SourcingSettings
places.ts          → Google Places API (NEW) client: getPlaceDetails / searchSalonByText / placePhotoMediaUrl
instagram.ts       → Instagram-light: normalize handle + paste-through bio/captions + provider seam
places-to-brief.ts → placeToBrief(PlaceDetails, InstagramLight?) → SalonBrief
pipeline.ts        → assembleBriefFromPlaces() / assembleBriefFromFixture()  ← the entry points
fixtures.ts        → FIXTURE_PLACE / FIXTURE_INSTAGRAM (offline + --dry-run + the e2e LLM test)
```

## Design rules (don't break these)

- **No Instagram scraping.** TOS + ban risk. "Light" = handle + human-pasted bio/captions,
  plus an env-gated `InstagramProvider` seam for a licensed 3rd-party API later. Pasted data
  always wins over provider data (the operator looked at the real profile).
- **Pass through real facts, never invent character.** `vibe` is set only from genuine signal
  (IG bio → Google editorial blurb); if absent, leave it empty and let the model infer from
  facts. Real phone / address / **opening hours** / reviews ride along in `brief.notes` so the
  mockup mirrors reality — that credibility is what makes the WhatsApp opener land.
- **Places API (New), not legacy.** `places.googleapis.com/v1` with header auth + a field mask
  per call. Field masks are mandatory and also cap billing. No SDK — `fetch` only.
- **`SalonBrief` lives in `@revivo/shared`**, not here. This package is a *producer* of briefs;
  `@revivo/llm` is the consumer. Sourcing must never depend on llm.

## Running it

No CLI of its own — it's a library. Exercise it through the generator:

```bash
pnpm gen-mockup --place-id "ChIJ..."            # live (needs GOOGLE_PLACES_API_KEY)
pnpm gen-mockup --query "Kapsalon Mira Utrecht" # live: text-search → first hit → brief
pnpm gen-mockup --dry-run --places             # offline: FIXTURE_PLACE → brief → stub config
```

## Not built yet

- KvK enrichment (SBI 9602 filter) — Stage 4.
- A real `InstagramProvider` adapter (the seam exists; no adapter wired).
- Brand-color extraction + design-quality screenshot judging of a current site.
