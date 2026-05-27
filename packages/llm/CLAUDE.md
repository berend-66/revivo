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
3. Response is JSON-extracted (tolerates ```fences/prose), **image URLs are rewritten to deterministic picsum URLs BEFORE validation** (so a bad model URL never forces a retry), then `SiteConfigSchema.parse`.
4. On schema failure, one retry with the Zod errors fed back. Two failures → throw.

## Conventions / gotchas

- **`SiteConfig` lives in `@revivo/shared`**, not here. This package is the *producer*; customer-template is the *consumer*. Keep the system prompt's inline schema in sync with `@revivo/shared` when the contract changes — they're two copies of the same truth (prompt needs a prose description; runtime needs the Zod schema).
- **Image URLs are always discarded.** Don't waste prompt effort making the model produce real ones; `normalizeImagesInPlace` overwrites them. Real photos arrive in a later stage (Instagram scrape).
- **Prompt caching is not implemented** (OpenRouter path). It's deferred until we go native Anthropic at volume — the prompt is already structured as a stable prefix + small variable suffix so caching is a drop-in then.
- **Cost**: ~1.7k in / 2.2k out tokens per mockup (~€0.04 on Sonnet via OpenRouter). Fine for validation; revisit at Stage 4 scale.

## Not built yet (future)

- **Places mode** — assemble a `SalonBrief` from a Google Place ID + Instagram scrape instead of manual flags (Stage 2 → Stage 4 bridge).
- **Native Anthropic adapter** + prompt caching (`adapters/anthropic.ts`).
- **Supabase sink** — write configs to a `mockups` table instead of local files, served by `apps/mockups` at `mock.revivo.nl/{slug}`.
- **Brand-color extraction from real photos** and **design-quality screenshot judging** of a prospect's current site.
