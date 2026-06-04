# @revivo/llm — agent context

The mockup generator: turns a short salon brief into a complete, Zod-valid `SiteConfig` (the moat). Model-agnostic by design.

## Model-agnostic design (don't break this)

The generator depends ONLY on the `LLMClient` interface (`src/client.ts`). It never imports a provider SDK. Switching provider is an `.env` change, never a code change — this matters because OpenRouter has a markup we may not keep paying.

```
config.ts   → reads LLM_PROVIDER / LLM_API_KEY / LLM_MODEL / LLM_BASE_URL into LLMSettings
client.ts   → createLLMClient(settings) returns an LLMClient
              · OpenAICompatibleClient covers openrouter AND openai (same wire format)
              · anthropic provider currently throws — add adapters/anthropic.ts to enable
                native prompt caching at scale
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

## Conventions / gotchas

- **NEVER re-add "verzin …" fabrication instructions to the prompt (Stage 2.5 invariant).** A mockup is an opener the real salon owner inspects, so the generator must not invent *verifiable or clickable* facts: KvK, BTW, email, Instagram handle, WhatsApp, third-party booking URLs, lat/lng, and `about.stats` numbers are emitted ONLY when they come from the brief — otherwise omitted (or `booking.provider: "custom"` with no URL). Real grounding (lat/lng, rating, review count) arrives as structured `SalonBrief` fields and is surfaced by `briefToMessage`; the model copies it, never invents it. Inventing a fake KvK or a dead "Boek je afspraak" link is exactly what the audit caught — don't reintroduce it. Fabricating plausible *prices/services* is still fine (not verifiable, expected for a mockup).
- **`SiteConfig` lives in `@revivo/shared`**, not here. This package is the *producer*; customer-template is the *consumer*. Keep the system prompt's inline schema in sync with `@revivo/shared` when the contract changes — they're two copies of the same truth (prompt needs a prose description; runtime needs the Zod schema).
- **Image URLs are always discarded.** Don't waste prompt effort making the model produce real ones; `normalizeImagesInPlace` overwrites them with picsum. In Treatwell mode `applyListingFacts` then replaces them with the salon's REAL photos (sized to the count) — hero, gallery, **and `about.portrait`** (the editorial portrait is an image too; missing it once let a picsum placeholder survive into a real mockup); picsum is last-resort only.
- **Facts deterministic, voice LLM.** When real `ListingFacts` exist, the model must NOT decide services/prices/hours/team/reputation/reviews — those are overwritten by `applyListingFacts`. The prompt tells it to omit team/reputation/testimonials. Keep it that way: never let the model's invented facts win over the scraped truth.
- **Prompt caching is not implemented** (OpenRouter path). It's deferred until we go native Anthropic at volume — the prompt is already structured as a stable prefix + small variable suffix so caching is a drop-in then.
- **Cost**: ~1.7k in / 2.2k out tokens per mockup (~€0.04 on Sonnet via OpenRouter). Fine for validation; revisit at Stage 4 scale.

## Places mode + Supabase sink (built)

- **`SalonBrief` + `slugify` now live in `@revivo/shared`** (not here). This package consumes the brief; `@revivo/sourcing` produces it. The system prompt's inline schema is still the prose copy of `SiteConfig` — keep it in sync.
- **Places mode** lives in `@revivo/sourcing` (Google Place + Instagram-light → `SalonBrief`). The **`bin/` CLI orchestrates** sourcing + db; the library `src/` stays provider/pipeline-pure (only `LLMClient` + the generator). `--place-id`/`--query`/`--fixture-place` build the brief, then the unchanged `generateMockup` runs; `--push` upserts via `@revivo/db`.

## Not built yet (future)

- **Native Anthropic adapter** + prompt caching (`adapters/anthropic.ts`).
- **Brand-color extraction from real photos** and **design-quality screenshot judging** of a prospect's current site.
