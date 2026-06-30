# Revivo SEO/AEO — Implementation Masterplan

*Created 2026-06-30 · companion to [docs/SEO.md](SEO.md) (the playbook — **why** these techniques work). This doc is **how** we build them into the product, phase by phase. Detailed per-subphase execution plans are produced separately (plan mode) right before each phase is built — this masterplan is the strategic frame they hang off.*

---

## North star

> Make every generated salon site rank for local intent and be trusted by search **and** AI answer engines — by templating the SEO/entity layer **once** into the customer-template and driving it entirely from `SiteConfig`, so all ~50–200 lifetime sites inherit it at **zero marginal operator effort**.

This is not a peripheral feature. "Google-vindbaarheid" is one of the three things Revivo sells (brand · ownership · findability), so the SEO layer is part of the **core product value**, not a defer-until-20-customers nice-to-have. It earns its place now.

## The two tracks

| Track | What | Who controls it | Where it lives |
|---|---|---|---|
| **A — Website** | The templated SEO/entity/perf layer | You (templated once, auto-applied) | Phases 0–5, in code |
| **B — Owner enablement** | GBP, citations, reviews, GSC | The salon owner (you enable + check) | A runbook shipped per site (ops, not code) |

Be honest internally: roughly **half** the local-ranking outcome (the map pack) lives in Track B, which you *enable and verify* but do not *control*. The website cannot substitute for a well-run Google Business Profile; it wins the **organic** results and feeds the **entity-trust layer** that both Google and AI assistants lean on.

## Cross-cutting invariants (hold across every phase)

1. **`SiteConfig` is the single source of truth.** Page content **and** JSON-LD/meta read the same fields. Never hand-author schema that can drift from the visible page (Google requires markup to represent visible content; drift risks a manual action).
2. **The mock app stays non-indexable.** `apps/mockups` (SSR) keeps its existing `X-Robots-Tag: noindex` + `robots.txt Disallow: /`. Any canonical/schema added to the *shared* variant Layouts must not leak mockups into the index or compete with the real production site.
3. **Omit `AggregateRating`/`Review` on the salon's own node by default.** An embedded Treatwell review widget = self-controlled reviews → **star-ineligible** + manual-action risk. Real review weight accrues on GBP.
4. **`robots.txt` default-allow.** Never copy "block-AI" publisher boilerplate into a salon site. A generator guard-test asserts no `Disallow: /` and no answer-engine-bot disallow regression.
5. **Per-salon original copy is a hard generator rule.** Stamping 50–200 near-duplicate sites is genuine doorway/thin-content spam; the mockup generator's per-salon originality (real stylists, prices, neighbourhood, voice) is the mitigation.
6. **Preserve each variant's font/visual DNA.** The shared SEO partials are brand-neutral *metadata* only — they must not homogenize the atelier/studio/neon look.

## Dependency graph & build order

```
Phase 0  (SiteConfig contract)  ──┬──►  Phase 1 (schema)
                                  ├──►  Phase 2 (head + sitemap + robots)
                                  ├──►  Phase 3 (single-source NAP)   ◄── also needs Phase 2
                                  └──►  Phase 5 (conversion + AEO extras) ◄── also needs 1 + 2
Phase 4 (performance) ── independent; sequence after Phase 2 to avoid head/layout churn
Track B (owner runbook) ── start now; independent of all code
```

**Recommended order:** `0 → 1 → 2 → 3 → 4 → 5`, with **Track B drafted alongside Phase 0** (it's just a checklist and unblocks the owner-side levers immediately).

---

## Phases

Effort is in *operator-evenings* (Berend, solo): **S** ≈ 1 · **M** ≈ 2–3 · **L** ≈ 4+.

### Phase 0 — Extend the `SiteConfig` contract
*The migration that unblocks everything else.*

- **Goal:** add the first-class fields the SEO layer needs, plumbed through the generator, so the downstream partials can be fully templated.
- **Why:** schema, meta titles, and NAP all read from `SiteConfig`. A few needed fields don't exist yet, and adding them once is the unlock; everything after this is "render fields that now exist."
- **Fields to add / reconcile:** `placeId` · `geo {lat,lng}` (geocoded **once** at generation, ≥5 decimals) · `businessCategory` (→ JSON-LD `@type`) · `gbpPrimaryCategory` + `gbpSecondaryCategories` (Dutch GBP categories) · `treatwellUrl` (reconcile with existing `booking`) · socials (`contact.instagram/facebook` already exist — add `gbpUrl`). **Reconcile, don't duplicate:** `location.lat/lng` and `contact.*` socials already exist — extend, don't re-add.
- **Touches:** `packages/shared/src/site-config.ts` (Zod schema) · the generator in `packages/llm` (prompt + output contract) · the Places ingestion path (`placeId`, geocode) · `examples/*.json`.
- **Depends on:** nothing.
- **Done when:** a freshly generated `SiteConfig` carries all fields (or explicit `null`); existing example configs migrated; typecheck/build green; `pnpm gen-mockup --fixture-place` emits them.
- **Effort:** M.
- **Guardrails:** follow the SiteConfig-contract migration rule — **additive, optional, defaulted**; never rename/remove. Render-if-present everywhere downstream.

### Phase 1 — `<SalonSchema.astro>` (JSON-LD `@graph`)
*The biggest templatable lever.*

- **Goal:** emit one valid JSON-LD `@graph` per page, built from `SiteConfig`.
- **Why:** structured data is the strongest *templatable* signal for local **rich-result eligibility** and **AI entity trust**. It encodes *who you are* (`LocalBusiness`) **and** *what you do + what it costs* (`hasOfferCatalog`), which is exactly what lets Google/assistants answer "wat kost balayage in {stad}". (Frame it as **eligibility, not a ranking factor**.)
- **Nodes:** **A** salon — `HairSalon`/`BeautySalon`/`NailSalon` (by `businessCategory`), `@id #salon`, address/geo/`openingHoursSpecification`/`sameAs`/`hasOfferCatalog`/`priceRange`. **B** `WebSite` (**no `SearchAction`** — retired Nov 2024). **C** optional `BreadcrumbList` (multi-page only).
- **Touches:** new `apps/customer-template/src/components/SalonSchema.astro` (shared, consumed by all 3 variant Layout heads) · a pure `SiteConfig → graph` mapper (unit-testable) · optionally `astro-seo-schema` + `schema-dts` for compile-time type-checking (a breaking `SiteConfig` change then **fails the build**).
- **Depends on:** Phase 0 (`businessCategory`, `geo`, socials).
- **Done when:** rendered HTML passes `validator.schema.org` + Rich Results Test for one sample of each category; `AggregateRating`/`Review` absent by default; mapper unit-tested; renders in all 3 variants + the mock app **without** breaking noindex.
- **Effort:** M.
- **Guardrails:** render with `set:html={JSON.stringify(graph)}` (XSS-safe); only emit fields backed by visible content; stable `@id`.

### Phase 2 — `<Seo.astro>` + sitemap + robots
*Close the technical-SEO hole in the customer-template.*

- **Goal:** give every customer page a proper `<head>` (canonical, OG/Twitter, robots, unique title/meta) and generate a sitemap + `robots.txt`.
- **Why:** the variant Layouts today emit only `title + description + favicon`. That means **no canonical** (query/variant duplication risk), **no OG/Twitter** (your *own* WhatsApp/IG opener shares these links → a missing card kills the share), **no sitemap** (the package is installed but unwired), **no robots**. The marketing site already does all of this correctly — mirror it.
- **Touches:** new `src/components/Seo.astro` (shared) — self-referencing canonical (`new URL(Astro.url.pathname, Astro.site)`), robots, unique `{Service} in {Stad} | {Salon}` title/meta from `SiteConfig`, OG/Twitter (`og:locale=nl_NL`) · wire `@astrojs/sitemap` in `astro.config.mjs` (`site` already env-wired) · `src/pages/robots.txt.ts` (default-allow + `Sitemap:` ref) · mock app: noindex + canonical-to-production.
- **Depends on:** Phase 0 for the richest titles, but largely buildable independently.
- **Done when:** every page has a correct self-canonical; OG card previews correctly (test in WhatsApp/Slack); `sitemap-index.xml` builds; `robots.txt` default-allows + references the sitemap; **generator guard-test** asserts no `Disallow: /` and no answer-engine-bot disallow; mock app verified still noindex.
- **Effort:** M.
- **Guardrails:** keep mock noindex; **do not** add hreflang to single-locale salon sites; robots never blocks AI crawlers.

### Phase 3 — Single-source NAP
*The entity-consistency anchor.*

- **Goal:** one NAP (Name-Address-Phone) object rendered **byte-identical** into footer, `/contact`, and the JSON-LD `PostalAddress`.
- **Why:** NAP consistency is a top local prominence/trust signal and the anchor AI assistants reward; drift between footer and schema undermines both. Single-sourcing makes consistency structural, not a manual check.
- **Touches:** a shared NAP render (component/util) consumed by footer + contact + `SalonSchema` · a **build-time assertion** that footer-address == schema-address.
- **Depends on:** Phase 0 + Phase 2.
- **Done when:** the assertion passes; the same exact string is what you paste into NL citations.
- **Effort:** S.

### Phase 4 — Performance (don't regress CWV)
*Fix the floor; don't chase past "Good".*

- **Goal:** keep Core Web Vitals "Good" while adding images/fonts the right way.
- **Why:** CWV is a **tiebreaker, not a primary lever** — but the current raw `<img>` + render-blocking Google Fonts *actively* hurt LCP/CLS, and you ship salon Instagram photos unoptimized. This is fixing a real regression, not gold-plating.
- **Touches:** migrate variant images to `astro:assets` `<Image>`/`<Picture>` (`priority` on the single hero, `image.remotePatterns` allowlist — **or** download photos at generation time so the static build optimizes them locally) · fonts → Astro Fonts API (**verify Astro ≥5.7 first**; else `@fontsource-variable` + Fontaine), preserving per-variant DNA · lazy-load the Treatwell embed · wire a Lighthouse/PageSpeed pre-deploy gate.
- **Depends on:** sequence after Phase 2 (avoid head churn).
- **Done when:** PageSpeed lab "Good" on a sample site; fonts self-hosted with metric-matched fallback (no CLS); exactly one eager hero image; Treatwell deferred.
- **Effort:** M–L.
- **Guardrails:** don't homogenize variant fonts; check the Astro version before reaching for the Fonts API.

### Phase 5 — Conversion + AEO extras
*Compounding + comprehension.*

- **Goal:** ship the review loop, answer-first content, and per-salon OG images; optional `llms.txt`.
- **Why:** the review deep-link + QR (Track A's half of the loop) compounds the owner's GBP review work; answer-first copy + a real FAQ block aids AI comprehension (not rich results — those are dead); a bespoke OG image makes the opener share look custom; `llms.txt` is cheap future-optionality.
- **Touches:** `/review` page (Google `writereview` deep-link from `placeId` + build-time QR) · front-loaded NL answer + short FAQ block per service/location page · per-salon OG via `astro-og-canvas` (static) / Satori (mock SSR) · optional `src/pages/llms.txt.ts` from `SiteConfig`.
- **Depends on:** Phase 0, 1, 2.
- **Done when:** the review link resolves to the salon's Google review form; OG image renders per salon; FAQ markup framed as comprehension, never sold as a rich-result win.
- **Effort:** M.

### Track B — Owner runbook (parallel ops, not code)
*The map-pack lever lives here.*

- Becomes `docs/SEO-RUNBOOK.md` + an admin-tracked checklist: **GBP** (specific Dutch primary + ≤9 secondary categories, services/description/attributes/hours, 50+ photos, **website = new domain + appointment URL = Treatwell**) · Apple Business Connect + Bing Places · ~12 NL citations with identical NAP (DeTelefoongids/Goudengids, Yelp.nl, Facebook, Foursquare) · review-velocity kickoff · **Cloudflare bot check** (`curl -A 'OAI-SearchBot/1.3' https://{domain}/` → expect 200) · GSC verify + sitemap submit + owner access.
- **Effort:** S (doc) + later admin fields.

---

## Definition of done (whole initiative)

A freshly generated site ships — with **zero extra operator SEO work** — carrying: a valid `LocalBusiness` `@graph`, self-canonical + OG/Twitter, sitemap + default-allow robots, single-source NAP, "Good" CWV, **and** an operator runbook that gets GBP/citations/reviews/GSC done. Validated in CI by the Rich Results Test + PageSpeed + the generator guard-tests.

## Explicitly out of scope (for now)

Blog/content-collection + RSS (no content stream yet) · FAQ/`SearchAction` rich results (dead features) · `llms.txt` as a *sold* feature · paid SEO MCPs (DataForSEO) / rank-tracking · multi-location/doorway page generation · A/B testing. (Consistent with the "mockup-is-the-moat, defer peripherals" anchor — the SEO **core** layer above is in scope precisely because it *is* core product value.)

## Map to the playbook ([docs/SEO.md](SEO.md))

| Phase | Playbook section |
|---|---|
| 1 (schema) | §4 |
| 2 (head/sitemap/robots) | §3 |
| 3 (NAP) | §2b |
| 4 (performance) | §3 (perf items) |
| 5 (review/AEO/OG/llms) | §2c, §5 |
| Track B (runbook) | §2a, §8 |
| Myths to avoid | §7 |
