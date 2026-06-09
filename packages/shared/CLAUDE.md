# @revivo/shared — agent context

The dependency root: contracts + pure helpers every other package builds on.
Zero workspace dependencies (zod only) — keep it that way; anything here is
importable by sourcing, llm, db, scripts, and the apps without DAG knots.

```
site-config.ts   → SiteConfig (THE render contract — see hard rules in root CLAUDE.md)
salon-brief.ts   → SalonBrief (the generator's input contract) + slugify
listing-facts.ts → ListingFacts (the salon's REAL scraped facts)
phone.ts         → isDutchMobile / dutchMobileToWaNumber (one definition — sourcing's
                   brief guards and the opener's wa.me gate must never disagree)
opener.ts        → buildOpener(config, mockUrl, facts?) → ready-to-send Dutch opener (B4)
```

## Rules

- **`SiteConfig` is a contract.** Additive/optional changes only; sync the inline prose
  schema in `packages/llm/src/prompts/mockup-system.ts` and check all three
  customer-template variants handle absence.
- **The opener is deterministic + templated — NO LLM** until ~20 real sends prove the
  copy too samey (measure first). **Every claim must be TRUE** — it degrades to plainer
  copy, never to fabricated enthusiasm: the rating hook needs ≥4,5★ + ≥25 reviews
  (strong) or ≥4,0★ (mild) — a mediocre rating is not a hook; the menu-item hook cites
  only a SCRAPED item still present on the config (config-invented services are never
  cited); the platform is derived from `facts.sourceUrl` / `reputation.source`, never
  defaulted to "Treatwell"; the "what's in the mockup" clause lists only what genuinely
  came from scraped data. Don't reintroduce an unconditional claim into the templates.
- **`whatsappUrl` is gated on `isDutchMobile`** over `contact.whatsapp → contact.phone
  → facts.phone` (first genuine mobile wins). A wa.me link to a landline is a dead link
  on exactly the message that must win trust; the text is percent-encoded incl. `'()!*`
  so salon names can't truncate the link. Callers own the mock base URL (`buildOpener`
  never assembles one; `DEFAULT_MOCK_BASE_URL` is the env-overridable deployed host for
  callers — never localhost in an opener).

## Tests

`pnpm -F @revivo/shared test` — pure unit tests (phone gate, wa.me normalization,
hook ladder, NL number formatting). No network, no env.
