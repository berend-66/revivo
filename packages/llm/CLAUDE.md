# @revivo/llm — agent context

The mockup generator: turns a short salon brief into a complete, Zod-valid `SiteConfig` (the moat). Model-agnostic by design.

## Model-agnostic design (don't break this)

The generator depends ONLY on the `LLMClient` interface (`src/client.ts`). It never imports a provider SDK. Switching provider is an `.env` change, never a code change — this matters because OpenRouter has a markup we may not keep paying.

```
config.ts         → reads LLM_PROVIDER / LLM_API_KEY / LLM_MODEL / LLM_BASE_URL into LLMSettings
client.ts         → createLLMClient(settings) returns an LLMClient
                    · OpenAICompatibleClient covers openrouter AND openai (same wire format)
                    · anthropic provider currently throws — add adapters/anthropic.ts to enable
                      native prompt caching at scale
mockup-generator.ts → generateMockup(brief, client?, facts?) + applyListingFacts (facts passthrough)
check-about.ts    → checkAboutFidelity — the about-prose fabrication guard
dry-run.ts        → stubMockup(brief) — deterministic config, no LLM, no cost
run-mockup.ts     → THE shared pipeline (B3): resolveListingBrief / runMockupPipeline /
                    generateMockupForListing — CLI and batch worker both run this path
run-mockup-job.ts → runGenerateMockupJob(db, job): one claimed generate_mockup job start
                    to finish; the ONE db-composing module in src/ (see rules below)
bin/gen-mockup.ts → the operator CLI: arg parsing + sinks ONLY, calls run-mockup.ts
```

Default today: `LLM_PROVIDER=openrouter`, `LLM_MODEL=anthropic/claude-sonnet-4.5` (Claude quality through the user's existing OpenRouter key). To move off OpenRouter later: set `LLM_PROVIDER=anthropic` + implement the native adapter (then prompt caching becomes available — the system prompt is a large stable prefix built for exactly that).

## Running it

```bash
# From repo root. Reads .env automatically.
pnpm gen-mockup --name "Lume Atelier" --city Amsterdam --vibe "warm, rustig, premium"
pnpm gen-mockup --brief path/to/brief.json
pnpm gen-mockup --dry-run --name "Test" --city Utrecht   # no API call, no cost
pnpm gen-mockup --help
```

Output → `apps/customer-template/examples/generated/<slug>.json` (gitignored). Preview with the command the CLI prints.

Reproduce the two reference mockups:
```bash
pnpm gen-mockup --name "Bloom Beauty" --city Haarlem --type beauty \
  --vibe "rustige, luxe beautysalon; natuurlijke uitstraling, groen en hout"   # → atelier
pnpm gen-mockup --name "VOLT" --city Rotterdam \
  --vibe "jonge, brutale kapsalon; kleurspecialisten; neon; Gen-Z; TikTok"     # → neon
```

## How generation works

1. `briefToMessage` formats the `SalonBrief` into the user turn.
2. `MOCKUP_SYSTEM_PROMPT` (`prompts/mockup-system.ts`) instructs the model to emit a SiteConfig JSON: pick a layout variant by vibe, choose a palette, write Dutch copy, realistic NL prices, 7-day hours, placeholder image URLs.
3. Response is JSON-extracted (tolerates ```fences/prose), **image URLs are rewritten to deterministic picsum URLs BEFORE validation** (so a bad model URL never forces a retry), stray `null`s on optional fields are stripped (`stripStrayNullsInPlace`, preserving the legitimately-nullable `price`), then `SiteConfigSchema.parse`.
4. On schema failure, one retry with the Zod errors fed back. Two failures → throw.
5. **Facts passthrough** — if `generateMockup(brief, client?, facts?)` is given real `ListingFacts` (from `@revivo/sourcing`'s Treatwell scraper), they're surfaced as an authoritative "ECHTE GEGEVENS" block in the user turn so the model's VOICE fits the real salon, then `applyListingFacts` deterministically **overwrites** the factual fields of the validated config (services/prices, hours, team, reputation, testimonials=real reviews, contact.phone, booking=real URL, location, photos) and the result is re-validated. The model's invented facts are discarded; only its voice survives.

## Verification: fabrication check + vision client

- **`checkAboutFidelity(config, facts)` (`src/check-about.ts`) is the reliable fabrication guard.** Facts are pinned deterministically, so the LLM can only be "confidently wrong about the owner's business" in the about-PROSE. This is a TEXT check: it compares the about-copy (+ tagline/headlines) against the salon's real `facts.description` + known structured facts and flags concrete unsupported claims (music/drinks/awards/year/experience/backstory). `gen-mockup` runs it automatically when `facts.description` exists and **warns, doesn't block**. Validated both directions (clean about → clean; injected "Spaanse muziek"/year/award → flagged). It is the durable replacement for the shelved screenshot-vision gate (see below). Derives `verdict` from claim count in code; no-op when there's no real description.
- **The vision client (`createVisionClient`, `CompleteOptions.images`, `VISION_LLM_MODEL`) exists, but screenshot-vision verification is NOT a runtime gate — it's a manual spot-check only (`@revivo/verify`).** Measured on a fully-hand-verified-correct mockup it produced 3/3 false positives (misread price/hours/phone off a downscaled page). The vision capability stays here (model-agnostic, no SDK leak) for that spot-check tool and future uses; `@revivo/verify` depends on this package, never the reverse — don't add `--verify` to `gen-mockup` (it would cycle the graph).

## Conventions / gotchas

- **NEVER re-add "verzin …" fabrication instructions to the prompt (Stage 2.5 invariant).** A mockup is an opener the real salon owner inspects, so the generator must not invent *verifiable or clickable* facts: KvK, BTW, email, Instagram handle, WhatsApp, third-party booking URLs, lat/lng, and `about.stats` numbers are emitted ONLY when they come from the brief — otherwise omitted (or `booking.provider: "custom"` with no URL). Real grounding (lat/lng, rating, review count) arrives as structured `SalonBrief` fields and is surfaced by `briefToMessage`; the model copies it, never invents it. Inventing a fake KvK or a dead "Boek je afspraak" link is exactly what the audit caught — don't reintroduce it. Fabricating plausible *prices/services* is still fine (not verifiable, expected for a mockup).
- **`SiteConfig` lives in `@revivo/shared`**, not here. This package is the *producer*; customer-template is the *consumer*. Keep the system prompt's inline schema in sync with `@revivo/shared` when the contract changes — they're two copies of the same truth (prompt needs a prose description; runtime needs the Zod schema).
- **Image URLs are always discarded.** Don't waste prompt effort making the model produce real ones; `normalizeImagesInPlace` overwrites them with picsum. In Treatwell mode `applyListingFacts` then replaces them with the salon's REAL photos (sized to the count) — hero, gallery, **and `about.portrait`** (the editorial portrait is an image too; missing it once let a picsum placeholder survive into a real mockup); picsum is last-resort only.
- **Facts deterministic, voice LLM.** When real `ListingFacts` exist, the model must NOT decide services/prices/hours/team/reputation/reviews — those are overwritten by `applyListingFacts`. The prompt tells it to omit team/reputation/testimonials. Keep it that way: never let the model's invented facts win over the scraped truth.
- **Prompt caching is not implemented** (OpenRouter path). It's deferred until we go native Anthropic at volume — the prompt is already structured as a stable prefix + small variable suffix so caching is a drop-in then.
- **Cost**: ~1.7k in / 2.2k out tokens per mockup (~€0.04 on Sonnet via OpenRouter). Fine for validation; revisit at Stage 4 scale.

## Places mode + Supabase sink (built)

- **`SalonBrief` + `slugify` now live in `@revivo/shared`** (not here). This package consumes the brief; `@revivo/sourcing` produces it. The system prompt's inline schema is still the prose copy of `SiteConfig` — keep it in sync.
- **Places mode** lives in `@revivo/sourcing` (Google Place + Instagram-light → `SalonBrief`). The **`bin/` CLI is arg-parsing + sinks ONLY**; every mode funnels into `runMockupPipeline` (`src/run-mockup.ts`) — the same path the batch worker runs, so CLI and batch behaviour cannot drift. `--place-id`/`--query`/`--fixture-place` build the brief, then the shared pipeline runs; `--push` upserts via `@revivo/db`.

## Batch worker core (B3)

- **`run-mockup.ts` is the single generation path.** `resolveListingBrief` (listing URL → brief
  + facts, optional places-combo for Google postcode/coords), `runMockupPipeline` (cross-check →
  generate/stub → about-fidelity → gate verdict), `generateMockupForListing` (composed — what the
  worker and the future C1 cron call). It returns **structured gate reports** (`MockupGates`) and
  never prints, exits, or reads env beyond the default client — formatting/disposition belongs to
  the callers. Don't add a batch-only or CLI-only generation branch; extend the pipeline.
- **Gates are SOFT.** `verdict: "needs_review"` on a scrape cross-check MISMATCH or an
  about-prose FABRICATION; an uncheckable/errored check is *reported* (`aboutFidelitySkipped`)
  but never gates — degraded coverage is not disagreement. The worker still pushes the mockup
  (the operator reviews the live mock URL) and parks the lead `needs_review` + `review_reason`.
- **`run-mockup-job.ts` is the ONE module in `src/` that composes `@revivo/db`** (the rest of
  src/ stays provider/pipeline-pure). It still creates no clients and reads no env — the caller
  (scripts/generate-pending.ts today, the C1 cron later) owns the Supabase client. It lives here,
  not in `scripts/`, because the cron must import it — a scripts/ copy would be the second code
  path the roadmap bans.
- **The worker only processes leads still `pending`.** Jobs outlive runs (bounded drain, retry
  backoff); a claimed job whose lead the operator meanwhile moved (`dropped`/`needs_review`/
  `mockup_generated`) completes as outcome "skipped" — no generation, no lead mutation. The lead
  status is the operator's control surface; never make the worker override it. A stub run
  (`opts.dryRun`) pushes the stub mockup but leaves the lead `pending` for the same reason.
- **Slug stability is enforced, not assumed.** A lead with an existing mockup row keeps that
  row's slug whatever the model picked this run (the prompt's slug is a guideline, not
  deterministic) — re-runs, incl. stub → real, overwrite in place and never orphan a row behind
  its live URL. Only a first-ever mockup goes through `pickMockupSlug`, which claims a slug that
  is free or already this lead's (desired → `-city`, boundary-aware → `-N`); a batch run must
  never overwrite a hand-made mockup (`lead_id` null) or another lead's. The CLI `--push` honors
  the same rule: it refuses a lead-owned slug unless the `--treatwell` URL matches that lead's
  listing (provably the same salon).

## Tests

`pnpm -F @revivo/llm test` (vitest, offline — no keys, no tokens): a queue-based fake
`LLMClient` + a stubbed global `fetch` over sourcing's committed real listing fixture cover the
facts passthrough (dry-run + LLM paths), fabrication → `needs_review`, errored-check →
skipped-not-verdict, gate aggregation, slug claiming, disposition mapping, and
`resolveListingBrief` incl. the places combo.

## Not built yet (future)

- **Native Anthropic adapter** + prompt caching (`adapters/anthropic.ts`).
- **Brand-color extraction from real photos** and **design-quality screenshot judging** of a prospect's current site.
