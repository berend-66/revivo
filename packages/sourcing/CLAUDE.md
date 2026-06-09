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
treatwell.ts       → fetchTreatwellListing / parseTreatwellHtml / treatwellListingToFacts → ListingFacts; listingFactsToBrief (REAL data, deterministic, NO LLM)
fact-check.ts      → crossCheckListing(raw, facts) → state↔JSON-LD scalar agreement report (deterministic scrape-fidelity backstop, NO LLM/vision)
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
  selectors minimal (one marker + parse) so cosmetic HTML changes don't break it. `fetchTreatwellListing`
  is just `fetch` in front of the pure `parseTreatwellHtml(html, sourceUrl)` — split out so the
  extractor is unit-tested offline against captured HTML (see `## Tests`).
- **The silently-bad-scrape backstop is `crossCheckListing` (`fact-check.ts`), NOT vision.** Because a
  Treatwell page carries the salon's scalars twice (`window.__state__` + JSON-LD), we re-extract each
  source independently and flag any disagreement on name/geo/rating/reviewCount/hours/photos — exactly
  the failure a layout change would cause (state parse breaks, JSON-LD stays intact). It's deterministic,
  makes no LLM/vision call, and `gen-mockup` prints its one-line verdict on every Treatwell run (warn,
  don't block). It guards **scalars only** (JSON-LD has no menu/team/reviews) — price/menu correctness is
  covered by the golden snapshot test, and about-PROSE by `checkAboutFidelity` (`@revivo/llm`). The
  screenshot-vision comparator that was built + measured (Phase 6) proved false-positive-prone and stays a
  manual spot-check only (`@revivo/verify`); this is the structured replacement for it.
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

## Tests

`pnpm -F @revivo/sourcing test` (or `pnpm -r test` from the root) runs the **vitest**
regression harness. It is fully **offline** — no network, no keys — feeding committed real
HTML in `test/fixtures/treatwell/` through the pure `parseTreatwellHtml` → `treatwellListingToFacts`
path and asserting a frozen golden `ListingFacts` snapshot (every price, all 7 hours rows, team,
reputation, ≥4★ review dedup, photos). This is the moat's load-bearing regression anchor: a
silently-broken scraper ships a mockup that is confidently wrong about the salon's own business.

- Fixtures are real captured bytes, so the asserted values are frozen regardless of how the live
  page later drifts — they anchor **our parser**, not Treatwell's live data. Refresh a fixture
  only deliberately (re-capture + `pnpm -F @revivo/sourcing test -u` to update the snapshot).
- `no-state.html` strips `window.__state__` to prove the JSON-LD fallback recovers scalars,
  warns, and **omits** services/team/reviews rather than inventing them.
- `fact-check.test.ts` covers `crossCheckListing`: PASS on the faithful page, MISMATCH when the
  state hours are deliberately mangled (JSON-LD intact), and UNCHECKABLE when only one source exists.

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
