# revivo — roadmap (next steps)

Forward-looking plan. Written 2026-06-09, after the Stage 2.7 milestone (real-data
sourcing + the shelved-vision / text-fidelity decision) shipped and the inherited
7-phase plan completed. Pairs with [PROGRESS.md](PROGRESS.md) (what's *built* + decision
log) and [ARCHITECTURE.md](ARCHITECTURE.md) (system shape). This file is what's *next*.

> Synthesized from three independent plan drafts (value-first, risk-first,
> dependency-first). Where they disagreed, the reconciling call is recorded inline.

---

## Where we are

The **moat already works end-to-end for one salon**: `pnpm gen-mockup --treatwell <url> --push`
deterministically scrapes a Treatwell listing → real `ListingFacts` → LLM authors *voice*
→ `applyListingFacts` overwrites the *facts* → Supabase `mockups` row → renders at
`mock.revivo.nl/{slug}` in all three variants (0 picsum, 0 fabrication, verified on Utrecht
Hairstyle). `checkAboutFidelity` guards invented prose. The screenshot-vision comparator was
measured FP-prone and shelved.

**What's missing to get to revenue**, in dependency order:
1. a **list of prospect URLs** (the crawler) — the single missing input to the working pipeline;
2. a way to **run the pipeline in volume** (batch + later cron) without a second code path;
3. a friction-free **opener loop** (config → ready-to-send WhatsApp/IG/email message);
4. everything downstream — qualification (KvK), adapter breadth, close & delivery.

## The sequencing principle

The biggest risk in the whole business is **market risk**: *does the personalized-mockup
opener actually convert?* That is the company's core thesis; cron, adapters, KvK, and delivery
are all moot until it's validated. So the priority is the shortest path to **sending ~20 real
openers and measuring reply rate.**

**But** a mockup that is confidently wrong about the owner's own business is *worse than none*
(it destroys the moat **and** corrupts the market-risk measurement — a low reply rate then
can't be told apart from "wrong facts"). So a **thin, cheap correctness floor precedes the
first batch** — specifically the two ~1-evening items in Phase A. The *expensive* correctness
work (adapter-breadth, contract tests, broad fidelity sweeps) is genuinely demand-gated and
deferred (Phase D), which all three drafts agreed on.

Everything obeys the standing anchors: **~50–200 lifetime customers** (Vercel Cron + a Postgres
jobs table is the ceiling — no queues/Inngest/Redis), **5-werkdagen SLA**, **solo operator /
boring tech**, **the mockup is the moat — invest there first**.

### Mapping to the established stage labels
- **Phase A** — new pre-Stage-4 hardening (no prior label).
- **Phases B–C** — **Stage 4** (sourcing pipeline) + the thinnest slice of **Stage 3** (opener loop, minimal admin worklist).
- **Phase D** — Stage 4 breadth (KvK qualification, more adapters) — demand-gated.
- **Phase E** — **Stage 5** (build & deploy / close), built lazily on the first real "yes".

---

## Phase A — Correctness floor (gate before any volume)

Cheap, deterministic, no new infra. Protects the one path that batch will multiply.
There are **zero tests in the repo today**, and the Treatwell scraper is load-bearing moat code.

### A1 · Scraper regression harness + golden fixtures — *1 evening*
- Add **vitest** as the workspace test runner (root `pnpm -r test`); first tests live in `packages/sourcing`.
- Capture the raw HTML of Utrecht Hairstyle (+1–2 others) into committed `packages/sourcing/test/fixtures/treatwell/*.html` so tests are offline + deterministic (never hit the live network in CI).
- Refactor `fetchTreatwellListing` minimally so **HTML→facts is a pure function** (it nearly is via `RawListing`), then snapshot a frozen golden `ListingFacts` (every price, all 7 hours rows, team names+ratings, reputation, review dedup/≥4★, photo URLs).
- Add a **state-blob-absent** fixture and assert the JSON-LD fallback yields scalars + warns (proves graceful degradation is real, not assumed).
- **Exit:** `pnpm -r test` passes from a clean checkout with no network/keys; corrupting a parse helper makes a test fail with a clear diff.
- New: `packages/sourcing/test/treatwell.test.ts`, `.../fixtures/treatwell/*.html`, `.../__snapshots__/`, `vitest.config.ts`. Touch: root + `packages/sourcing/package.json`, `treatwell.ts`.

### A2 · Structured cross-source fidelity check (the non-vision backstop) — *1 evening*
- The Treatwell page carries **two independent fact sources** (`window.__state__` + JSON-LD), plus optional Google Places. A deterministic agreement check on the fields they overlap (name, lat/lng within ε, rating ±0.1, reviewCount drift band, hours-row count == 7, photos non-empty when JSON-LD has images) catches exactly the "state parse silently broke on this layout" failure that batch volume multiplies. This is the **structured fact-check** the open questions asked for as the replacement for the shelved screenshot-vision comparator.
- `packages/sourcing/src/fact-check.ts` → `crossCheckListing(raw, facts, placeOverlap?)` → structured `{field, stateValue, jsonLdValue, googleValue, agree}[]`. Pure, no LLM, **must not import `@revivo/llm`** (DAG).
- Wire into `gen-mockup` as a **warn-not-block** line beside `checkAboutFidelity` (same operator-judgment posture). Test PASS on the good fixture, FAIL on a mangled-hours fixture.
- **Exit:** every Treatwell run prints a one-line fidelity PASS or the disagreeing fields; DAG intact; CLAUDE.md records this as the durable deterministic backstop.
- *Scope note:* JSON-LD lacks menu/team/reviews, so this guards **scalars only** — prices stay covered by A1's golden snapshot + menu internal consistency. State the limit so it isn't mistaken for full coverage.

---

## Phase B — Volume + the revenue loop (core of Stage 4)

The milestone that lets you **send 20 openers and measure reply rate.** Hard constraint
throughout: **no second code path** — the batch/cron worker must reuse the CLI's
brief→facts→generate→apply→upsert chain verbatim, or the facts-deterministic design drifts.

### B1 · Leads + jobs schema (the dependency root) — *1 evening*
- Pure SQL + mirrored types; every later stage imports this. Resolves the existing nullable `mockups.lead_id` FK stub.
- `leads`: `id`, `source` (`marketplace|google_places`), `listing_url`, `place_id`, `query_text`, `name`, `city`, `postcode`, `kvk_number`, `sbi_code`, `listing_facts_json`, `place_details_json`, `status` (`pending|qualified|mockup_generated|outreach_sent|replied|dropped`), `drop_reason`, `next_retry_at`, timestamps. **Dedup via *partial-unique* indexes per source** — `listing_url` for marketplace, `place_id` for Places (do **not** force one composite key; that either rejects valid leads or merges distinct ones).
- `jobs`: `id`, `lead_id` FK, `job_type` (`generate_mockup` for now), `status` (`pending|running|succeeded|failed`), `attempt_count`, `last_error`, `next_retry_at`, timestamps, `completed_at`.
- Widen `mockups.source` CHECK to include `marketplace` (mirror the existing `…_source_listing.sql` pattern); add the real FK. Reuse the `set_updated_at` trigger + service-role-only RLS (copy `mockups.sql`).
- `packages/db/src/leads.ts` + `jobs.ts`: `LeadRow`/`JobRow` hand-mirroring the SQL (the "change both together" rule), `insertLeadIfNew` (returns `{inserted}`), `claimNextPendingJob`, `markJobResult` (backoff `next_retry_at = now + base·2^attempt`, capped), `listLeadsByStatus`.
- **Exit:** `@revivo/db` builds; migration applied; `insertLeadIfNew` is idempotent on the dedup key.

### B2 · Treatwell marketplace directory crawler (first lead producer) — *1 weekend*
- **Why marketplace before Google Places:** a DAG collapse the codebase confirms — each Treatwell directory entry *is* the listing URL the deterministic scraper already consumes (the state blob exposes `venueListingUri`). One crawler yields **both** the prospect list **and** the rich facts path. Strictly richer than Places, and it reuses `treatwell.ts` wholesale.
- `packages/sourcing/src/marketplace/treatwell-directory.ts` → `crawlTreatwellDirectory({cities, treatmentTypes})` → async-iterable of `{listingUrl, name?, city?}`. Same `window.__state__`/JSON-LD posture, same browser UA, **polite** (sequential, delay, low concurrency, page-cap per city). Anchor-href fallback (`/salon/<slug>/`) if a directory page lacks the state blob. Enumerate URLs only — facts come at generation time, keeping the crawl cheap. **Library only; no LLM import.**
- Prove the parser **against a captured directory fixture (offline) first** (test-first, consistent with Phase A) before wiring DB inserts.
- Thin `scripts/crawl-marketplace.ts` (hand-run for now): seed cities × treatments → `insertLeadIfNew(source:'marketplace', …, status:'pending')`; log inserted vs skipped.
- **Exit:** one real city → ≥30 deduped `pending` leads; a second run inserts 0; offline fixture parses without network; `packages/sourcing` still imports no `@revivo/llm`.
- *Risk:* directory state shape may differ from a salon page — the anchor-href fallback must be robust enough to carry the crawl alone. TOS/rate: public-page read, polite, bounded by the seed list (tiny at this scale).

### B3 · Batch generate worker — extract the CLI core, reuse it — *1 weekend*
- **DRY is the whole point.** Extract brief-resolution + generation from `bin/gen-mockup.ts` into `packages/llm/src/run-mockup.ts` → `generateMockupForListing({listingUrl, placeId?, overrides})` → `{config, facts, brief, model}`. The CLI shrinks to arg-parsing + sinks and calls this. `checkAboutFidelity` (A-phase: + `crossCheckListing`) stay in the path as **warn/gate** steps.
- `runGenerateMockupJob(leadId)`: load lead → `generateMockupForListing` → `upsertMockupBySlug({slug, config, source:'marketplace', leadId, brief, model})` → set `lead.status='mockup_generated'` → `markJobResult`. Lives in `@revivo/llm` or a `scripts/` entry (generation depends on llm; **not** in sourcing).
- `scripts/generate-pending.ts`: poll due `pending` jobs, **concurrency 1–2** (at this scale parallelism is a liability), per-job try/catch, attempt cap (~3) then `failed` + leave for manual review. Print a per-lead OK/FAIL summary + running cost estimate (~€0.04/mockup).
- Make the A2 cross-check + about-fidelity **soft gates**: on a hard disagreement, mark `needs_review` rather than silently shipping or silently dropping (preserves operator trust).
- **Exit:** the B2 leads become real `mockups` rows (source `marketplace`, `lead_id` set, spot-checked 0 picsum/0 fabrication); re-running skips done leads; a forced failure records `last_error` + future `next_retry_at` without crashing the batch; **all existing `gen-mockup` modes still work** (regression).
- *Risk:* slug collisions across distinct salons (same name/city) → slugify must disambiguate (append city/postcode); same-salon re-run overwriting in place is fine.

### B4 · The opener loop (config → ready-to-send message) — *1 evening*
- Highest-leverage revenue step and nearly free — the config already holds everything an opener needs. **No admin app, no WhatsApp Business API, no Instantly.ai.**
- `buildOpener(config|MockupRow)` → `{whatsappUrl?, igDmText, emailSubject?, emailBody?, plainText}`. Dutch copy: salon name + **a real, specific hook** (their actual rating/review count or a signature menu item from `ListingFacts` — specificity is what stops it reading as spam) + the `mock.revivo.nl/{slug}` link + a soft CTA.
- **Gate `whatsappUrl` on `isDutchMobile`** (reuse the `places-to-brief` guard) — never build a `wa.me` link for a landline; fall back to IG-DM/email copy. Surface after `--push` and as `--openers <file>` for a whole batch. Flip `lead.status → outreach_sent`.
- Keep it **templated + deterministic first**; only reach for an LLM-authored variant if 20 sends prove too samey (measure before adding model cost).
- **Exit:** for a mobile-number salon the CLI prints a working `wa.me` link pre-filled with a Dutch opener containing the live mock URL; for a landline it prints IG/email copy and no broken link; operator goes batch-run → 20 copy-pasted openers in <30 min.

> **Milestone after Phase B:** crawl a city → N correct mockups → N ready openers, with a
> correctness floor underneath. This is the experiment that tests the company's core thesis.
> *Measure reply rate before building anything in Phase C+.*

---

## Phase C — Automate + organize (only once the loop earns it)

Pulled forward only when running the loop by hand crosses the one-weekend-of-operator-work line.

### C1 · Single Vercel Cron + bounded poll — *1 weekend*
- The **entire** orchestration layer: a token-guarded (`CRON_SECRET`) serverless route polling the jobs table. This stage mostly exists to **not** build a queue service.
- `api/cron/source-leads` (run B2 crawl → insert `pending`) + `api/cron/generate-mockups` (drain ≤K due jobs via B3). Likely under `apps/mockups` (already has the Vercel adapter + service-role env — avoids a new top-level app). `vercel.json`: **daily** source crawl (~02:00 CET) + a few-times-daily generate poll (not hourly — daily+ is ample at this volume). Bounded per-invocation (Vercel timeout is the real cap); rely on `next_retry_at`, **no in-function retry loops**. The crawl may need **chunking** (one city per invocation, cursor in a tiny `crawl_state` row) to fit the timeout.
- **Exit:** authed manual hits insert leads / drain jobs; unauthed → 401; Vercel shows both crons registered with a successful scheduled run; a full day runs unattended.

### C2 · Minimal operator worklist (thinnest slice of Stage 3) — *1 weekend*
- Only when manual send-tracking breaks past ~20 prospects. A **read-mostly** authenticated page — **not** the full `apps/admin` Next.js workspace from the architecture doc.
- A `/admin/leads` route (simplest: an authed SSR page in `apps/mockups`, reusing its service-role DB access, behind Vercel Deployment Protection scoped to `/admin/*` only — the public `/{slug}` mockups stay open). Table of leads by status with the mock link + the B4 opener buttons (click-to-copy WA/IG/email) + a status dropdown calling `setLeadStatus` (one POST handler, service-role server-side).
- **No** Stripe / asset form / build trigger here — those are Phase E.
- **Exit:** one protected page shows all leads by status with live mock links; opener buttons copy a ready message; status changes persist; **public prospect links remain auth-free**.
- *Risk:* the protection must cover `/admin/*` and **never** the public `/{slug}` path — get route-gating right or you leak admin / block prospects.

---

## Phase D — Demand-gated qualification + breadth (measure first)

Explicitly deferred until a real prospect or a non-Treatwell salon blocks the loop. The
dependency that unlocks these is **data, not code** — the populated leads table tells you what's
actually needed. All three drafts agreed: do **not** build speculatively here.

### D1 · KvK SBI-9602 qualification — *1 weekend (excl. API access procurement)*
- Only matters once volume crawls pull non-salon noise. **Resolve the KvK API endpoint + auth first** (open question — don't stub a fake URL).
- `packages/sourcing/src/kvk.ts` (pure fetch, no LLM) → `{kvkNumber, sbiCodes}`; enrichment step writes `kvk_number`/`sbi_code`, sets `qualified` iff an SBI 9602 code is present, else `dropped` + reason. Gate the **Places path** generation on `qualified`; leave the **marketplace path** generating directly (its real reviews are its demand-proof). Offline fixture test for SBI extraction + the gate.
- *Risk:* name+city→registration matching is fuzzy — store the matched record for operator review, never overwrite a confirmed customer's KvK.

### D2 · Generic schema.org extractor + at most the single measured-top adapter — *1 evening (measure) + ~1 weekend per adapter actually built*
- **Measure first:** from the leads table, tally what share of real prospects use each platform (Fresha/Salonized/Salonkee/SalonHub/Aimy/Zenoti). Build adapters **strictly in descending share order; build zero if Treatwell coverage suffices.** Record the tally in PROGRESS.md so the choice is auditable.
- Extract the JSON-LD helpers from `treatwell.ts` into a shared `packages/sourcing/src/jsonld.ts` (covered by A1's snapshot, no behavior change). Add `packages/sourcing/src/schema-org.ts` — a generic `LocalBusiness` extractor covering **scalars only** (name/address/geo/rating/hours/photos), explicitly **not** menu/team/reviews (saying so prevents a silent-fabrication trap). Add the top non-Treatwell adapter as a sibling of `treatwell.ts` emitting the **unchanged `ListingFacts` contract** (prefer deterministic embedded-state/JSON-LD; defer any vision/LLM-only platform rather than ship an unreliable facts source).
- Codify a shared **adapter-contract test** (schema parses, hours 0-or-7 rows, reviews ≥4★ + author-deduped, photos key-free, no fabricated fields when the source is silent) that every future adapter must pass. Re-run a fidelity spot-check per new adapter.
- **Exit:** a PROGRESS.md tally ranks platforms by real share; at most the top adapter exists + passes the contract test + renders a correct mockup; the rest are explicitly deferred with the tally as the trigger to revisit.

---

## Phase E — Close & delivery (Stage 5; build lazily on the first real "yes")

Nothing here moves a prospect toward the *first* yes — it's the close/delivery mechanics that
only matter once outreach produces a paying customer. Build semi-manually on the first sale,
document each step, automate **only what recurs.**

### E1 · Stage-5 delivery seam — *2 weekends, lazy*
- On first sale: deliver semi-manually (fork config → `astro build` → deploy), then automate the recurring steps into a thin `packages/deploy` (Vercel + TransIP REST wrappers, per the architecture doc's deferred package).
- **Asset collection:** a minimal post-payment form for the few things a mockup can't scrape (logo, extra photos, confirmed booking provider) → merged into `SiteConfig`.
- **Photo re-hosting (won leads only):** download real photos (Treatwell CDN now; Google `placePhotoMediaUrl` server-side, **stripping the key**) → Supabase Storage → key-free URLs in the persistent config, so the live customer site doesn't depend on a third-party CDN. Gate strictly to won leads — re-hosting every speculative mockup balloons storage; Treatwell CDN is fine for the opener. (This also unblocks Google-only photos, currently discarded because the media URL embeds the API key.)
- **Resolve the TransIP ownership flow** (register in customer's name vs. transfer) before automating domain registration; manual-register in the meantime, attach via Vercel API.
- **Exit:** the first paying customer's mockup is forked, real assets merged, deployed to a per-customer Vercel project on their domain, photos re-hosted (key-free), within the 5-werkdagen SLA.

---

## Decisions to resolve (cross-cutting, gather as you go)

| # | Decision | Blocks | Lean |
|---|----------|--------|------|
| 1 | **Reply-rate read** from the first ~20 openers | everything past Phase B | run it before C+ |
| 2 | **KvK API** exact endpoint + auth scheme | D1 | procure access early; SBI filter is a manual admin step until then |
| 3 | **Platform tally** — which non-Treatwell platforms real prospects use | D2 | cheap manual count of 30–50 leads; build zero adapters until it justifies one |
| 4 | **TransIP** register-in-customer-name vs. transfer flow | E1 | confirm API support before automating; manual-register meanwhile |
| 5 | **Marketplace crawl** TOS/rate posture at directory scale | B2 | reuse the public-page, polite, bounded stance; cap pages/city |
| 6 | **Leads dedup** key asymmetry (`listing_url` vs `place_id`) | B1 | partial-unique per source, not one composite |
| 7 | **Domain `revivo.nl`** not registered; `hallo@` mailbox + Cal.com not live | marketing launch + a professional opener URL | operator task, independent of this build |

## Deliberately NOT building (anti-scope, per the anchors)

- **No queue/orchestration beyond Postgres jobs + one Vercel Cron** — no Inngest/Redis/k8s/worker fleet.
- **No full `apps/admin` workspace** before ~20 customers — C2 is a read-mostly worklist only.
- **No speculative adapter breadth** — measure platform share, build the top one (or none).
- **No screenshot-vision runtime gate** — measured FP-prone; stays a manual spot-check. The structured `crossCheckListing` (A2) is the deterministic guard.
- **No re-hosting speculative mockups; no AI photos; no self-service dashboard / A/B tests / multi-language** — all explicitly out until first 20 paying customers.
- **No second code path** for batch — the worker reuses the CLI's extracted core (B3).

## First move

**A1 + A2** (the two ~1-evening correctness items) — they're cheap, they pin the one path that
batch volume multiplies, and the repo has zero tests today. Then **B1→B2→B3→B4** is the straight
line to a sendable batch of 20 correct openers. Hold everything in Phase C+ until the reply-rate
read from those openers is in hand.
