# @revivo/sourcing — agent context

Turns external salon data into a `SalonBrief` (the generator's input contract) and,
for the salon's REAL facts, a `ListingFacts`. Two source modes today: **places mode**
(a Google Place + Instagram-light → `SalonBrief`) and **Treatwell mode** (a salon's
public listing → real menu/prices/team/hours/reviews/photos). Stage 4 adds KvK
enrichment + the cron that batch-sources leads through this same code.

```
config.ts          → GOOGLE_PLACES_API_KEY → SourcingSettings
places.ts          → Google Places API (NEW) client: getPlaceDetails / searchSalonByText / placePhotoMediaUrl
instagram.ts       → Instagram-light: normalize handle + paste-through bio/captions + provider seam
places-to-brief.ts → placeToBrief(PlaceDetails, InstagramLight?) → SalonBrief
treatwell.ts       → fetchTreatwellListing / treatwellListingToFacts → ListingFacts; listingFactsToBrief (REAL data, deterministic, NO LLM)
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
- **Structured grounding beats prose (Stage 2.5).** `placeToBrief` carries `lat` / `lng` /
  `rating` / `reviewCount` as typed `SalonBrief` fields (not just `notes` text) so the generator
  copies real coordinates/ratings instead of hallucinating them. `buildNotes` also emits
  "Contact-aanwijzingen" guards mirroring the prompt's no-fabrication rules against THIS salon's
  data: a non-mobile phone (`isDutchMobile` false) → "zet contact.whatsapp NIET"; no real website
  (`hasRealWebsite` false) → "verzin GEEN e-mailadres". Keep these in sync with the prompt.
- **Places API (New), not legacy.** `places.googleapis.com/v1` with header auth + a field mask
  per call. Field masks are mandatory and also cap billing. No SDK — `fetch` only.
- **`SalonBrief` lives in `@revivo/shared`**, not here. This package is a *producer* of briefs;
  `@revivo/llm` is the consumer. Sourcing must never depend on llm.
- **Treatwell extraction is deterministic, NOT an LLM call.** A salon's Treatwell page is
  server-rendered and embeds a `window.__state__` JSON blob (+ schema.org JSON-LD), so
  `treatwell.ts` reads typed JSON directly — `JSON.parse` of a balanced-brace-extracted blob,
  no parser dep, no LLM, zero model drift on facts. `window.__state__` is primary; JSON-LD is a
  redundant fallback for the scalar fields. It's a public-page read (no auth/API); keep the
  selectors minimal (one marker + parse) so cosmetic HTML changes don't break it. The eventual
  vision check is the backstop that catches a silently-bad scrape.
- **Treatwell is the source of truth for menu/prices/team/hours/reviews; Google stays for
  coords/postcode/extra photos.** `ListingFacts` is the real-data contract (lives in
  `@revivo/shared`); `@revivo/llm`'s `applyListingFacts` writes it into the config deterministically.
  Curating reviews to ≥4★ from the listing's REAL reviews is selection (what any salon site does),
  not fabrication — distinct from the places-path "paraphrase + anonymous byline" rule. Reviews are
  also **deduped by named author** (one per person; anonymous bylines never collapsed) so the same
  reviewer can't appear twice adjacent on the opener — `ListingFacts.reviews` is presentation-clean.

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
- **More listing-platform adapters** — each a sibling of `treatwell.ts` emitting the same
  `ListingFacts` contract (so `applyListingFacts` downstream is unchanged): **Fresha, Salonized,
  Salonkee, SalonHub, Aimy, Zenoti**. Treatwell is first because it dominates NL hair/beauty; the
  rest are **demand-driven** — prioritise by what share of the actual prospect list uses each
  (measure before building). Technique is per-platform: prefer a deterministic embedded-state /
  JSON-LD parse like Treatwell's; fall back to LLM/vision extraction only where a site exposes no
  structured data. A thin **generic schema.org-`LocalBusiness` extractor** is a cheap interim that
  covers the scalar fields (name/address/geo/rating/hours/photos) for many of these sites without a
  bespoke parser — but not their menu/team/reviews.
