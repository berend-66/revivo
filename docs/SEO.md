# Revivo SEO + AEO Playbook — actionable, templatable, NL-salon-specific

*Durable playbook · created 2026-06-30 · companion to [docs/SEO-MASTERPLAN.md](SEO-MASTERPLAN.md) (the phased build plan). Findings came from a multi-agent web sweep, then adversarial verification: every named tool's URL was fetched to confirm it's real (0 hallucinated), and myth-prone claims were fact-checked against first-party sources. Survey-derived ranking weightings (BrightLocal/Whitespark) are expert consensus, not Google-published fact.*

> Scope: small static Astro brochure sites (services, prices, hours, reviews, Treatwell booking link). Value prop = **brand + Google-vindbaarheid + AI-findability**. Operator builds solo with coding agents and wants every technique templated **once** into the customer-template, then auto-applied to every generated site from `SiteConfig`. This report separates what the **website can win** (local organic + entity layer) from what the **owner must do** (Google Business Profile + reviews), and names only verified-real tooling.

---

## 1. TL;DR — highest-leverage moves, in priority order

1. **Build one `<SalonSchema>` Astro partial that emits a single JSON-LD `@graph` from `SiteConfig`** — `HairSalon`/`BeautySalon`/`NailSalon` node + `WebSite` + optional `BreadcrumbList`. This is the biggest *templatable* lever for both local rich-result eligibility and AI-assistant entity trust. It ships to every site for free. (Structured data is an **eligibility** feature, not a ranking factor — frame it that way.)
2. **Add a shared `<Seo>` head partial to the customer-template variant Layouts** — self-referencing canonical + robots + unique `<title>`/meta + OG/Twitter. The variant Layouts today have **only title + description + favicon** — this is the technical-SEO hole.
3. **Unique, intent-matched `<title>` + meta per page**, templated as `{Service} in {Stad} | {Salon}`. On-page is the single biggest **local-organic** factor (~33% in BrightLocal 2026). Pure template change keyed off existing fields.
4. **Add `@astrojs/sitemap` to the customer-template + a dynamic `robots.txt.ts`** that references the sitemap and **does not block answer-engine crawlers**. `site` is already wired via `REVIVO_SITE_URL`; the integration is one line.
5. **Single-source NAP from `SiteConfig`** rendered byte-identical into footer, contact page, and JSON-LD, with a build-time equality assertion. This is the entity-consistency anchor that both Google and AI assistants reward.
6. **Ship a GBP onboarding checklist as part of the product.** The map pack — the most visible result for "kapper Utrecht" — is dominated by **owner-side** signals (GBP primary category #1, reviews ~20%, photos). You cannot template your way into the map pack; you template the website and *enable* the owner on GBP.
7. **Don't regress Core Web Vitals.** Astro's zero-JS static output gets you "good" CWV for free; the only real work is `astro:assets` for the hero image and **lazy-loading the Treatwell embed**. CWV is a tiebreaker, not a primary lever — don't over-invest.
8. **Force per-prospect ORIGINAL copy** (real stylists, services, neighbourhood, voice). One template stamping 50–200 near-duplicate sites is a genuine thin-content risk; the mockup generator's per-salon originality is exactly what mitigates it. Treat "never emit identical paragraphs across customers" as a hard generator rule.

---

## 2. Local SEO (highest ROI) — NL-specific

The local result splits into two surfaces with different owners. Be honest with the salon about which is which.

### 2a. The map pack — owner-controlled, website supports (ship a checklist)

| Lever | Why it's #1-tier | Action |
|---|---|---|
| **GBP primary category** | The single dominant Local Pack ranking factor in every 2025/26 survey (BrightLocal, Whitespark). | Set the most specific **Dutch** category: `Kapper` / `Schoonheidssalon` / `Nagelsalon` / `Barbier` — **never** generic "Salon". Add up to 9 secondaries from the salon's service list (which Revivo already extracts). Store primary+secondaries in `SiteConfig` so JSON-LD `@type` and copy stay consistent. |
| **GBP completeness** | "Businesses with complete, accurate info are more likely to show up." | Fill Services (price + description per service, reuse `SiteConfig.services`), "from the business" description (NL, with stad/wijk + primary services), attributes, hours. |
| **GBP website + appointment URL** | Routes map-pack clicks to the owned site. | **GBP website = the new owned domain** (accrues the SEO equity); **GBP appointment URL = the embedded Treatwell link** (bookings keep flowing). This is the clean story given the value prop is ownership, not commission saving. |
| **Photos** | Repeatedly cited as the second-biggest GBP signal + a legitimacy cue. | Upload 50+ real photos: interior, team, before/after, exterior **with signage**. |
| **Reviews + velocity** | ~20% of Local Pack weighting (up from 16%); recency matters as much as count — "80 reviews with 15 this month beats 200 from 2023". | Run a review-velocity loop (see 2c). Owner replies to **every** review — Google rewards engagement. |

> **Trap to flag:** keyword-in-business-name ranks ~#3 for the pack, **but** adding service/city words to the GBP *name* violates Google's representation guidelines and risks **suspension**. Keep the GBP name = the real-world salon name only.

### 2b. Citations / directories — NL-specific, identical NAP

Seed a dozen **consistent, relevant** listings — quality beats hundreds of spam citations (which Google ignores). Use the byte-identical `SiteConfig` NAP + primary category, tracked in the admin tool:

- **Google Business Profile** (the anchor)
- **Apple Business Connect** (`businessconnect.apple.com`) — Apple Maps is the **#2 NL citation source** per Whitespark, feeds Siri + on-device suggestions; many iPhone-heavy NL customers never open Google Maps.
- **Bing Places** (`bingplaces.com`) — can **import directly from GBP**; feeds Bing Maps + Microsoft Copilot / Bing-backed assistants.
- **DeTelefoongids / Goudengids** — largest NL directory (~3.5M visitors/yr).
- **Yelp.nl, Facebook Page, Foursquare** (global aggregators that Maps/AI pull from).
- **Treatwell** — doubles as the booking surface **and** a high-authority salon citation.

NAP consistency is a top prominence/trust signal (BrightLocal cites consistent-NAP businesses as ~40% more likely to appear in the pack — directional survey data, not Google-published). Don't over-engineer phone formatting (Mueller: exact format isn't required) — prioritise the **same digits/name** everywhere.

### 2c. Review-velocity loop (templatable per salon)

- Generate a **direct Google review URL** per salon from its Place ID (`https://search.google.com/local/writereview?placeid=…` or the GBP short link). Store `placeId` in `SiteConfig`.
- Render a "Laat een review achter" button + a **printable QR** (built at deploy time) on a `/review` page and in the footer.
- Hand the salon a ready WhatsApp/SMS template with the link to send 1–3 days post-visit (SMS open rates >90%).

### 2d. Location & service-page strategy for "[dienst] [stad]" queries

This is where the **website wins** (local *organic* + a relevance feed into the pack). The #1 and #2 local-organic factors are a dedicated page per service and geographic keyword relevance of content.

- **One service page per core service** (`/diensten/balayage`, `/diensten/herenknippen`, `/diensten/gelnagels`…): service + city in `<title>`/H1, real prices, duration, before/after photos, a front-loaded 1–2 sentence answer, and the Treatwell CTA.
- **One substantive location page** anchored on stad + wijk: neighbourhood, parking/OV, route, openingstijden, team, real reviews surfaced as plain text.
- **Title/H1/meta templating** from `SiteConfig`: home `{Salon} — Kapper in {Stad}`; service `{Service} in {Stad} | {Salon}`; meta includes stad + wijk + primary service + a booking nudge. Set `<html lang="nl">`, `og:locale=nl_NL`.

> **Doorway-page guardrail (critical for a templated fleet):** for a single-location salon, mass-producing `{service} {elke wijk}` pages with only the place-name swapped is **scaled-content / doorway spam** (Mueller flagged 1,300 such pages as doorways). Generate a **handful of genuinely unique, locally-substantive pages** — the mockup generator must *source* local specifics (real prices, photos, parking/route), not synonym-spin. Aim 40–60% unique content per page.

---

## 3. On-page & technical SEO for Astro — concrete checklist

The customer-template variant Layouts currently emit only `title + description + favicon` and a render-blocking Google Fonts `<link>`. The marketing site (`apps/marketing/src/layouts/Layout.astro`) already does canonical, OG/Twitter, and bidirectional hreflang correctly — mirror that into the customer-template. Checklist:

- [ ] **`site` set in `astro.config`** — already wired via `REVIVO_SITE_URL`. Required for sitemap + absolute URLs.
- [ ] **`@astrojs/sitemap`** (official, `npx astro add sitemap`) — emits `sitemap-index.xml` + `sitemap-0.xml` into `dist/` at build for all static routes. Use `serialize(item)` for lastmod/priority and to drop utility routes; `filter` to exclude e.g. a thank-you page.
- [ ] **`robots.txt` via `src/pages/robots.txt.ts`** (dynamic endpoint, reuses `site` — no hardcoded domains). Return `User-agent: *` / `Allow: /` / `Sitemap: ${new URL('sitemap-index.xml', site)}`. Prefer this over an unverified community plugin.
- [ ] **Self-referencing canonical** per page: `new URL(Astro.url.pathname, Astro.site).toString()` (exactly the pattern marketing Layout line 32 already uses). Astro's default canonical fallback is `Astro.url.href`, which leaks query/duplicate variants — set it explicitly.
- [ ] **Shared `<Seo>` head partial** — either adopt **`astro-seo`** (`<SEO>` covers title, titleTemplate, description, canonical, noindex/nofollow/noarchive, openGraph, twitter, languageAlternates, `extend`) or hand-roll a tiny `Seo.astro` (no dep, matches the marketing site's hand-rolled head). Both are valid; `astro-seo` is the boring, well-trodden pick for a solo operator.
- [ ] **OG + Twitter on customer sites** — currently missing. Salons share their new link on WhatsApp/Instagram (Revivo's own opener channel), so a missing/generic card kills the share. Add `og:type=website`, `og:title/description/url`, `og:locale=nl_NL`, `og:image` (abs URL, 1200×630), `twitter:card=summary_large_image`. For a **per-salon OG image**, use **`astro-og-canvas`** (build-time PNG per page from title/logo/palette; maintained by Astro core member Chris Swithinbank) on static sites; on the SSR mock app use Satori/`@vercel/og` at request time. Drive title/colors from `SiteConfig` so every shared link looks bespoke.
- [ ] **hreflang — marketing only.** Marketing already does bidirectional nl/en + x-default (lines 52–54) correctly. Customer salon sites are **single-locale NL — do NOT add hreflang.** Optionally pass the sitemap `i18n` option on marketing for belt-and-suspenders xhtml:link alternates.
- [ ] **Fonts: replace render-blocking Google Fonts `<link>` with the Astro Fonts API** (`fonts` config + `<Font>`). Self-hosts files (removes the Google round-trip + GDPR exposure), preloads, and auto-generates a metric-matched fallback to **neutralize CLS**. **Verify the repo is on Astro ≥5.7** (the API is stable only from there; experimental before). On older Astro, fall back to `@fontsource-variable/*` + Fontaine. Keep `font-display: swap` and `var(--font-display)` so the per-variant distinct-font DNA is preserved.
- [ ] **Images: `astro:assets` `<Image>`/`<Picture>`** — variants currently render raw remote `<img>` (no format conversion, no srcset, no dimensions → slow LCP + CLS). Emit AVIF/WebP with `width`/`height`, responsive `sizes`. Set **`priority`** on exactly the **one** hero/LCP image (Astro emits `loading=eager` + `fetchpriority=high` + `decoding=sync`); lazy-load the rest. **Allowlist remote hosts** via `image.remotePatterns` in `astro.config` or Astro silently skips optimizing Instagram/picsum URLs. Better: have the mockup-generator **download curated photos at generation time** so the static production build optimizes them locally instead of hitting Instagram CDNs at runtime.
- [ ] **Core Web Vitals — don't regress.** Keep output static/islands; **defer/lazy-load the Treatwell widget** and any third-party script so they don't blow up LCP/INP. Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1. Spot-check in PageSpeed Insights pre-launch. No extra ranking credit past "Good".
- [ ] **prerender vs SSR — indexable == prerendered.** Production customer sites stay fully static (no adapter — they already are). The mock app (`apps/mockups`) is correctly `output:'server'` (per-request Supabase reads); treat it as **non-indexable: noindex + canonical to the real production domain**, and don't rely on `@astrojs/sitemap` there (it cannot enumerate dynamic `/{slug}` SSR routes). Net rule: **indexable = prerendered; SSR = mock/admin only.** If a future indexable page must be SSR, opt it back in with `export const prerender = true`.
- [ ] **`@astrojs/rss` — skip** unless a salon adds a `/blog` content collection. Brochure sites have no content stream; RSS on a page-less site is noise. Listed so it's a deliberate "no".
- [ ] **Descriptive URLs + light internal links** — readable Dutch slugs (`/diensten/balayage`, `/over-ons`), descriptive anchors ("balayage in Utrecht", not "klik hier"), cross-link home ↔ diensten ↔ locatie. Low-ceiling hygiene (Google: keywords in URLs have "hardly any effect"), just don't ship opaque URLs.

---

## 4. Structured data (schema.org JSON-LD) — exact @types & properties

Emit **one** `<script type="application/ld+json">` per page from a single `SalonSchema.astro` component that builds a `@graph` from `SiteConfig`. In Astro, render with `set:html={JSON.stringify(graph)}` (never raw interpolation — XSS), or use **`astro-seo-schema`** + **`schema-dts`** for compile-time type-checking so a `SiteConfig` change that breaks the schema **fails the build**.

### Node A — the salon (the core lever)

```jsonc
{
  "@type": "HairSalon",            // most specific subtype; array for combined e.g. ["HairSalon","BeautySalon"]
  "@id": "https://{domain}/#salon",
  "name": "...",
  "image": ["https://.../hero.jpg"],   // crawlable HTTPS, ≥50K px, 16:9/4:3/1:1
  "logo": { "@type": "ImageObject", "url": "..." },
  "url": "https://{domain}/",
  "telephone": "+31...",               // international form
  "priceRange": "€€",                  // or "€30–€90", <100 chars
  "currenciesAccepted": "EUR",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "...", "addressLocality": "{stad}",
    "addressRegion": "{provincie}", "postalCode": "...", "addressCountry": "NL"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 52.37312, "longitude": 4.89212 }, // ≥5 decimals, geocoded once
  "areaServed": "{stad/wijk}",
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Tuesday","Wednesday"], "opens": "09:00", "closes": "18:00" }
  ],
  "sameAs": ["{GBP url}", "{Instagram}", "{Treatwell listing}", "{Facebook}"],
  "hasOfferCatalog": {
    "@type": "OfferCatalog", "name": "Behandelingen",
    "itemListElement": [
      { "@type": "Offer",
        "itemOffered": { "@type": "Service", "name": "Balayage", "serviceType": "Haarkleuring" },
        "priceSpecification": { "@type": "PriceSpecification", "price": "120", "priceCurrency": "EUR" } }
    ]
  }
}
```

**@type subtype mapping from a `SiteConfig` business-category field:** hair → `HairSalon`; nails → `NailSalon`; brows/lashes/skin/general beauty → `BeautySalon`; day spa → `DaySpa`. The real schema.org chain is `HairSalon → HealthAndBeautyBusiness → LocalBusiness → Organization/Place`, so subtypes inherit every LocalBusiness property — being specific costs nothing.

**`openingHoursSpecification` notes:** 24h `hh:mm`; overnight = set `opens`/`closes` across midnight; closed-all-day = both `00:00`; 24h = `00:00`–`23:59`; use `validFrom`/`validThrough` (YYYY-MM-DD) for vakantie hours. Generate directly from `SiteConfig.hours` so it always matches the visible table.

**`hasOfferCatalog`** is the single best lever for AI/answer-engine queries like "wat kost balayage in Amsterdam" — encodes "what you do" to complement LocalBusiness's "who you are". Only include prices actually printed on the page; build it from the same `SiteConfig.services` array that renders the visible price list so they can never diverge.

### Node B — `WebSite`

```jsonc
{ "@type": "WebSite", "url": "https://{domain}/", "name": "{Salon}", "inLanguage": "nl",
  "publisher": { "@id": "https://{domain}/#salon" } }
```
**Do NOT add `potentialAction`/`SearchAction`** — the Sitelinks Search Box was retired globally **21 Nov 2024**. It triggers no feature now; pure noise.

### Node C — `BreadcrumbList` (multi-page sites only)

Still a supported rich result. As of Jan 2025 it no longer renders on mobile SERPs (root-domain shown), which *raises* the value of the markup for crawler/AI hierarchy understanding. Emit per-page `ListItem` (position, name, item:url) from the route structure. Optional for a pure one-pager.

### What NOT to emit

- **`AggregateRating`/`Review` on the salon's own node — OMIT by default.** Since 2019 (restated Dec 2025) Google rules that when the entity controls reviews about itself (directly **or via an embedded third-party widget**), its `LocalBusiness`/`Organization` pages are **ineligible** for the star feature. Stuffing the salon's own Google reviews here earns **no stars** and can look manipulative / risk a manual action. Show testimonials as **visible content only**; real review weight accrues on GBP. Make the template emit it **only** if `SiteConfig` carries genuinely independent, on-page review data (it normally won't).
- **`FAQPage` — low priority.** FAQ rich results were restricted to gov/health sites (Aug 2023) and then removed from Search entirely. Markup is harmless and may aid non-Google parsing, but **don't sell it as a rich-result win**. If a page has a real visible Q&A, emit it for AEO comprehension only — never expect stars/expandable panels.

### Validation (bake into the loop)

- `SiteConfig` is the **single source** for both the rendered page and the JSON-LD → hours/prices/NAP match by construction. **Make that an invariant: never source schema fields from anything but rendered `SiteConfig`.** Google's general guidelines require markup to be a true representation of visible content; mismatches risk manual actions.
- CI: run built HTML through `validator.schema.org` (syntax/coverage) + the **Rich Results Test** (`search.google.com/test/rich-results`, Google eligibility). Post-deploy: GSC URL Inspection.
- Optional lightweight lint diffing schema fields vs rendered fields to catch drift.

---

## 5. AEO / GEO — getting cited by AI answer engines

### What's genuinely different from classic SEO — honestly, very little

Google's own May-2026 guidance ("AI features and your website" + the generative-AI optimization guide) states plainly: AEO/GEO **is still SEO**, there are **no special optimizations** to appear in AI Overviews/AI Mode, and **no special schema** and **no llms.txt** are needed for Google — a page only needs to be indexed and snippet-eligible. So don't sell "AEO" to salons as a distinct mechanism.

The genuinely different parts that are worth acting on:

1. **Local AI answers ("goede kapper in de buurt") are grounded primarily on Google Business Profile, Maps, and review/citation data — not on crawling the salon's own site.** The website is supporting groundwork; **GBP completeness + reviews + clean LocalBusiness schema are the real levers.** Set this expectation explicitly.
2. **For ChatGPT/Perplexity/Claude (non-Google engines), crawler access actually matters** — covered below.
3. **Answer-first content gets lifted.** Lead each service/location page with a 1–2 sentence direct answer ("{Salon} is een kapper in {wijk}, {stad}, gespecialiseerd in {service}; online te boeken via Treatwell."), then a short Dutch FAQ block with concrete answers (price, parking, online booking). This overlaps entirely with good on-page SEO.
4. **Off-site presence matters more than your own site for ChatGPT/Perplexity** — they lean on third-party mentions and authoritative lists (GBP, Treatwell, Instagram, directories). The clean-NAP/citation work in §2 is your AEO groundwork.

### AI-crawler robots posture — clear recommendation: **allow everything**

AI crawlers split into two functional classes controlled by **separate** robots.txt tokens:

- **Answer-engine / citation crawlers** (fetch live + cite with a link): `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Googlebot`. **Blocking these kills AI visibility.**
- **Training crawlers** (absorb into weights, no attribution): `GPTBot`, `ClaudeBot`, `Google-Extended`, `anthropic-ai`. The tokens are **independent** — blocking training has **zero** effect on Google Search ranking/inclusion.

**Recommendation: a salon has no IP to protect and benefits from brand recall, so allow BOTH classes.** A default-allow robots.txt (`User-agent: *` / `Allow: /`) already lets every AI crawler in — you do **not** need to enumerate bots to allow them. The real risk for Revivo is an **accidental block via copy-pasted "block-AI" boilerplate** — never copy a publisher's block template into a salon site.

**Generator guard-test (load-bearing):** assert the rendered robots.txt contains **no `Disallow: /`** and no per-bot disallow for `GPTBot`/`OAI-SearchBot`/`ClaudeBot`/`PerplexityBot`. This catches a regression that would silently delete the site from AI answers. Anchor on the stable **token name**, not the versioned UA string.

**The one genuinely new operational risk — Cloudflare default-block.** As of July 2025 Cloudflare blocks AI crawlers **by default for new zones** (and offers Pay-Per-Crawl returning HTTP 402). If any salon domain sits behind Cloudflare with default settings, answer-engine crawlers can be blocked **at the edge regardless of robots.txt** — the site you sold for "AI findability" is invisible to exactly those systems. **Add a launch-runbook line:** if the domain is on Cloudflare, open AI Crawl Control and explicitly **allow** the answer-engine bots; verify with `curl -A 'OAI-SearchBot/1.3' https://{domain}/` asserting 200, not 402/403. On Vercel without Cloudflare's managed bot rules this risk mostly disappears — but **must** be checked for any client keeping their existing host/CDN.

### llms.txt — optional, defer, do not sell

`llms.txt` is a real, coherent spec (Jeremy Howard / Answer.AI, at `llmstxt.org`), but **not consumed by the systems that matter as of mid-2026**: Google explicitly declines it (Illyes, Search Central Live July 2025; Mueller likened it to the dead meta-keywords tag), server-log analyses show OpenAI/Anthropic/Perplexity crawlers don't fetch `/llms.txt`, and a ~300k-domain SE Ranking study found **no correlation** between having it and being cited. **Do not spend real effort and do not sell it to salons.** If you ship it anyway (cost ~0, the generator already holds the structured data), auto-derive `src/pages/llms.txt.ts` from `SiteConfig` (`# {Salon}` / `> {one-line NL summary}` / `## Pagina's` with curated links) so it never drifts — treat as cheap future-optionality, not a deliverable.

> Optional one-line future-proofing: a `Content-Signal: search=yes, ai-input=yes, ai-train=yes` line in robots.txt (Cloudflare's emerging policy; IETF AIPREF is still pre-ratification). One line of permissive intent — don't build tooling around AIPREF until an engine announces it reads the signals.

---

## 6. Claude skills / plugins / MCP to adopt — verified-real only

**Honest headline: there is NO official Anthropic SEO/AEO/schema skill** (the `anthropics/skills` repo contains art/docs/office/mcp-builder/webapp-testing/frontend-design — nothing SEO). Every SEO tool below is community-maintained or first-party-Google. **The "template once, apply to every site" automation is best built in-house** — `SiteConfig` → JSON-LD/title/NAP/review-link components + a CI validation check. The pragmatic stack is: template schema in code (§8), plus a couple of thin MCP/first-party tools for validation and the post-launch feedback loop.

### Adopt

| Name | Kind | URL | What it does | Install/use | Maturity | Verdict |
|---|---|---|---|---|---|---|
| **@astrojs/sitemap** | Official Astro integration | docs.astro.build/en/guides/integrations-guide/sitemap/ | Build-time `sitemap-index.xml`/`sitemap-0.xml` in `dist/`; needs `site`. | `npx astro add sitemap` | First-party, actively maintained (v3.7.3, May 2026). | **Adopt** — zero-friction, exactly as claimed. |
| **astro-seo** (jonasmerlin) | Community `<SEO>` component | github.com/jonasmerlin/astro-seo | Head tags from props: title/desc/canonical/robots/OG/Twitter/languageAlternates/`extend`. | `npm i astro-seo` | De-facto standard: 1.4k★, ~103k weekly downloads, v1.1.0 Jan 2026, MIT. | **Adopt** — boring, well-trodden, ideal for a solo operator. (Or hand-roll a 30-line `Seo.astro` if you prefer no dep.) |
| **astro-seo-schema** (codiume/orbit) + **schema-dts** (Google) | Community component + Google's official TS types | github.com/codiume/orbit · github.com/google/schema-dts | `<Schema item={graph}/>` with compile-time type-checking of JSON-LD; `schema-dts` is Google's official typings. | `npm i astro-seo-schema schema-dts` | `schema-dts` is verifiably Google's; astro-seo-schema is real (npm page 403s to bots but verifiable via GitHub). | **Adopt** — type-checked schema means a breaking `SiteConfig` change fails the build. |
| **astro-og-canvas** (delucis) | Build-time OG-image route | github.com/delucis/astro-og-canvas | `OGImageRoute()` renders per-page OG PNGs at build from title/logo/palette. | `npm i astro-og-canvas` | Pre-1.0 (0.x), pulls `canvaskit-wasm` (sizeable build dep); maintained by an Astro core member. | **Trial** — great for per-salon bespoke share cards on static sites; weigh the wasm build cost. |
| **Google Search Console** | First-party Google product | search.google.com/search-console | DNS-TXT verify, sitemap submit, URL Inspection/request-indexing, query/click/coverage/CWV (CrUX field) reports. | Verify domain at handover (build into onboarding). | Official, canonical. | **Adopt** — verify every customer domain at handover, submit sitemap, give owner access. CWV report needs traffic, so new sites show "insufficient data" there at first; indexing/inspection work immediately. |
| **Lighthouse MCP** (`@danielsogl/lighthouse-mcp`) | MCP server | npm `@danielsogl/lighthouse-mcp` (v1.3.0) | Runs Lighthouse/CWV audits an agent can call. | `npx`/MCP config | Verified real on npm. | **Trial** — wire into a **pre-deploy CWV gate** so an agent flags LCP/INP/CLS regressions per generated site. |

### Trial / low-confidence (vet before relying on in a paying-customer pipeline)

- **claude-seo** (10,129★) and **mcp-gsc** (1,088★) — genuinely popular; mcp-gsc is the practical phase-2 GSC feedback loop (needs each site verified in Search Console first — build verification into onboarding). **Trial** post-launch.
- **geo-optimizer-skill** (PyPI 4.14.1) — real; can audit/fix AI-discovery files. **Trial** as a generator-side auditor. Note its **`astro-geoready`** integration is **NOT on npm** (lives in the repo subdir — install from path).
- **siteaudit-mcp** (PyPI 1.2.0, 3★), **schema-org-mcp** (17★, **not on npm** — `npx schema-org-mcp` fails, clone+build), **dataforseo-mcp-server** (2.9.9, **paid** account). Early/low-adoption or paywalled — pin versions, test first.

### Honest bottom line

**Few/none are mature for this exact use case.** The robust play is **template the schema in code** (§8) + Google's own free validators (`validator.schema.org`, Rich Results Test) + **GSC** for the feedback loop + a **Lighthouse/PageSpeed** check in CI. Don't take a dependency on a low-star SEO MCP for the load-bearing path.

---

## 7. Skip / myths / low-ROI

- **Meta keywords tag** — ignored by Google. Don't emit it.
- **Keyword density / word-count targets** — "length alone doesn't matter for ranking."
- **Exact-match keyword domains** — "hardly any effect."
- **Strict H1→H2→H3 ordering** — "doesn't matter if out of order." Don't agonise.
- **Subdomain-vs-subdirectory debates** and **"duplicate content penalty" fear** — there's no penalty, only crawl inefficiency.
- **Bulk low-quality directory citations** — a dozen consistent NL listings beats hundreds of spam ones.
- **`FAQPage` rich results** — restricted to gov/health (2023) then removed from Search. Don't sell as a rich-result win; FAQ content is fine for AEO/on-page value only.
- **`SearchAction` / Sitelinks Search Box** — retired Nov 2024. Don't template it.
- **Self-serving `AggregateRating`/`Review` on the salon's own node** — ineligible for stars, can look manipulative, manual-action risk. Omit by default.
- **Structured data sold as a ranking factor** — it's an **eligibility/appearance** feature. Real value = rich-result eligibility + knowledge-panel data + AI entity trust.
- **Over-optimising CWV past "Good"** — no extra ranking credit; it's a tiebreaker among comparably relevant pages with no published weight.
- **llms.txt as a ranking/citation lever** — not consumed by major engines; no measured benefit. Optional cheap future-proofing at most.
- **Mass `{service} {elke wijk}` location pages** — doorway/scaled-content spam for a single-location salon.
- **"Special AEO tricks" to get into AI Overviews** — Google: AEO is still SEO, no special optimization or schema needed.

> Calibration note: BrightLocal/Whitespark weightings are **expert-survey consensus, not Google-published facts**. Google's only first-party local statement is **relevance / distance / prominence**, plus "there's no way to request or pay for a better local ranking." **Proximity (~15%) is large and uncontrollable** — "kapper {own wijk}" is winnable; "kapper {city centre}" from a suburb is not guaranteed. Set expectations accordingly.

---

## 8. Recommended next actions in the Revivo codebase

Everything collapses to **~3 templatable additions** to the customer-template variant Layouts, all driven by `SiteConfig`, plus a per-prospect operator runbook. Priority order:

### Phase 0 — extend the `SiteConfig` contract (one migration, unblocks everything)

Add as first-class fields (both buckets read from the same source): `placeId`, `geo` (lat/lng, geocoded once at generation time, ≥5 decimals), `businessCategory` (→ JSON-LD `@type`), `gbpPrimaryCategory` + `gbpSecondaryCategories`, `treatwellUrl`, `socials` (instagram/facebook/gbpUrl). Follow the SiteConfig-contract migration rule — don't break downstream.

### Phase 1 — `<SalonSchema.astro>` (biggest local + AI-citation lever)

One component that builds a single `@graph` from `SiteConfig`: node A `HairSalon`/`BeautySalon`/`NailSalon` (or array) with `@id #salon` + all of §4; node B `WebSite` (no `SearchAction`); node C optional `BreadcrumbList`. Render with `set:html={JSON.stringify(graph)}` or `astro-seo-schema` + `schema-dts`. **Omit `AggregateRating`/`Review` by default.** Render in `<head>` of all three variant Layouts.

### Phase 2 — shared `<Seo.astro>` partial + sitemap + robots

- `<Seo>`: self-referencing canonical (`new URL(Astro.url.pathname, Astro.site)`), robots (indexable for production; **noindex + canonical-to-production for the SSR mock app** — keep the existing mockup-noindex commit), unique title/meta from `SiteConfig` (`{Service} in {Stad} | {Salon}`), OG/Twitter (`og:locale=nl_NL`).
- `@astrojs/sitemap` in `apps/customer-template/astro.config.mjs` (`site` already wired).
- `src/pages/robots.txt.ts` referencing the sitemap, **default-allow** (no per-bot disallow). Add the **generator guard-test** asserting no `Disallow: /` and no answer-engine-bot disallow.

### Phase 3 — single-source NAP

Render the one `SiteConfig` NAP object byte-identical into footer + `/contact` + JSON-LD `PostalAddress`. Add a **build-time assertion** that JSON-LD address == rendered footer address. Use the identical string when seeding NL citations.

### Phase 4 — performance (don't regress CWV)

Migrate variant fonts to the **Astro Fonts API** (verify Astro ≥5.7 first; else `@fontsource-variable` + Fontaine) — keep per-variant font DNA. Migrate images to **`astro:assets`** with `priority` on the single hero, `image.remotePatterns` allowlisted (or download photos at generation time). **Lazy-load the Treatwell embed.** Wire a **Lighthouse MCP / PageSpeed** pre-deploy gate.

### Phase 5 — conversion + AEO + optional

`/review` page with auto-generated Google review deep-link + printable QR from `placeId`. Front-loaded NL answer + short FAQ block per service/location page (AEO comprehension, not rich results). Per-salon OG image via `astro-og-canvas`. Optional `llms.txt.ts` from `SiteConfig` (cheap, not a priority).

### Per-prospect operator runbook (ship alongside every site — the GBP gap)

GBP: set specific Dutch primary category + up to 9 secondaries, fill Services/description/attributes/hours, upload 50+ photos, **set GBP website = new domain + appointment URL = Treatwell**. Claim Apple Business Connect + Bing Places. Seed NL citations (DeTelefoongids/Goudengids, Yelp.nl, Facebook, Foursquare) with identical NAP. Kick off the review-velocity loop. **If on Cloudflare: allow answer-engine bots and verify with `curl -A 'OAI-SearchBot/1.3' ... → 200`.** Verify the domain in GSC, submit the sitemap, give the owner access. Track every step in the admin tool.

---

**Relevant codebase files:** `apps/customer-template/src/variants/atelier/Layout.astro` (the technical-SEO hole — head has only title+desc+favicon + render-blocking fonts; same shape for studio/neon variants), `apps/customer-template/astro.config.mjs` (`site` via `REVIVO_SITE_URL`, **no sitemap**), `apps/marketing/src/layouts/Layout.astro` (already does canonical L32, OG/Twitter L56–65, bidirectional hreflang L52–54 — mirror it; only weakness = render-blocking Google Fonts L67–72), `apps/mockups` (`output:'server'` SSR — keep noindex + canonical-to-production), `packages/shared/src/opener.ts` (the mockup is the moat — a per-prospect site already scoring well on these checks strengthens the opener).