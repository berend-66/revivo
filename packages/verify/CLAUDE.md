# @revivo/verify — agent context

> ⚠ **Manual spot-check tool ONLY — not a gate, not a trusted measurement.** The
> screenshot-vs-screenshot vision comparator was built as the Phase 6 measurement
> instrument and then *measured*: on a mockup whose every fact was hand-verified CORRECT
> against Treatwell it reported **3/3 false positives** (misread €55→€35, the Sunday
> "gesloten" cell, and the real scraped phone — which it both misread digit-wise and called
> "invented" because Treatwell renders no phone on the page). Root cause: small-text OCR
> misreads on a ~19000px downscaled page + "not on the listing screenshot" ≠ "invented".
> **The reliable fabrication check is `checkAboutFidelity` in `@revivo/llm`** (a text check,
> validated both directions) — use that, not this, to catch the "Spaanse muziek" class.
> This package stays as an eyeball-it spot-check; never trust its `mistakeCount` blindly.

It screenshots a rendered mockup + the salon's real Treatwell page and asks a multimodal
model to COUNT factual discrepancies — wrong prices/services/team/rating/hours, and invented
atmosphere claims in the about-prose.

```
src/screenshot.ts → playwright-core full-page screenshots (desktop/mobile). Resolves a
                    CACHED Chromium (newest chromium_headless_shell-* under ms-playwright)
                    so it never downloads. Best-effort cookie-consent dismiss for Treatwell.
src/verify.ts     → verifyMockupAgainstListing({mockupUrl, treatwellUrl}) → VerifyResult.
                    Vision call (createVisionClient from @revivo/llm). mistakeCount = crit+major,
                    RECOMPUTED in code from issues (never trust the model's arithmetic).
src/serve.ts      → serveMockups(): spawn apps/mockups SSR dev server with Supabase env
                    stripped → local examples/generated/<slug>.json fallback → real /v/<layout> CSS.
bin/verify.ts        → `pnpm verify-mockup` (single mockup; serves unless --mockup-url given)
bin/test-templates.ts→ `pnpm -F @revivo/verify test-templates` (3-variant acceptance, serves once)
```

## Design rules

- **Library is pure (URLs → report); the bin owns serving.** `verify.ts`/`screenshot.ts`
  take URLs and never spawn anything. `serve.ts` is the only place that launches a server.
- **Depends on `@revivo/llm`, NEVER the reverse.** The vision capability (`CompleteOptions.images`,
  `createVisionClient`, `VISION_LLM_MODEL`) lives in `@revivo/llm`. Verification is its own
  `verify-mockup` command on purpose — bolting `--verify` onto `gen-mockup` would make a
  `llm → verify → llm` package cycle. Keep the DAG one-directional.
- **Faithful render = the mockups SSR app.** Don't screenshot a customer-template build:
  its single `index.astro` statically imports all three variant Layouts → all-variant Tailwind
  globals collide. The mockups app's `/v/<layout>/<slug>` split ships exactly one variant's CSS.
- **The judge compares the mockup against the REAL listing, NOT the scraped facts.** Giving it
  the facts we extracted would just measure render-fidelity; screenshotting Treatwell live makes
  it an INDEPENDENT check that also catches scraper mistakes. Ignore styling/voice; only facts.
- **Cached Chromium only.** `resolveExecutablePath()` picks the newest cached headless-shell so
  no download happens; override with `PLAYWRIGHT_EXECUTABLE_PATH` (e.g. non-mac-arm64 layout).

## Running it

```bash
# 1) generate the mockup (writes examples/generated/<slug>.json)
pnpm gen-mockup --place-id ChIJ... --treatwell https://www.treatwell.nl/salon/<slug>/

# 2) measure it (serves the mockup itself, screenshots both, counts mistakes)
pnpm verify-mockup --slug <slug> --treatwell https://www.treatwell.nl/salon/<slug>/ \
  --name "<Salon>" --viewport both
# reports → packages/verify/out/<slug>-<viewport>.json (gitignored)

# 3-variant acceptance (needs <base>-atelier|studio|neon configs present locally)
pnpm -F @revivo/verify test-templates --base <slug> --treatwell <url> --name "<Salon>"
```

`VISION_LLM_MODEL` (default `qwen/qwen3.7-plus`) selects the judge; same OpenRouter key as the
generator. Set `VERIFY_DEBUG=1` to surface the served app's stderr.

## Phase 6.5 — the decision (MADE: shelved, 2026-06-05)

The measurement was run on the one fully-verified salon (Utrecht Hairstyle) and the comparator
itself failed it (3/3 false positives, above). Decision with Berend: **do NOT promote this to a
runtime `--push` gate.** The deterministic scrape measured accurate; the screenshot comparator is
the unreliable part — promoting it would gate on hallucinations. Fabrication risk (the real residual
concern) is handled by `checkAboutFidelity` (`@revivo/llm`) instead. See `docs/PROGRESS.md` decision
log (2026-06-05). This package is retained only for occasional manual eyeballing; if you ever want a
*reliable* scraper-fidelity measurement, build the structured fact-check (vision EXTRACTS Treatwell
facts → deterministic diff vs our known scraped facts), not screenshot-vs-screenshot comparison.
