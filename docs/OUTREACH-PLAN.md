# Revivo — Outreach Masterplan

> **What this is.** The standing *strategy + campaign plan* for getting Revivo's first paying
> customers. This is the **masterplan**; concrete **execution artifacts derive from it** (a
> per-batch checklist, the weekly runbook, the lead list). It answers *what we do, in what order,
> and how we know it's working* — the **tactics** (message/channels/close/legal) live in
> [OUTREACH.md](OUTREACH.md), the **evidence + sources** in [OUTREACH-RESEARCH.md](OUTREACH-RESEARCH.md).
> Written 2026-06-30. Revise it when the data moves; don't let it go stale.

> **Anchors** (unchanged): €999 one-time, 5-werkdagen SLA, solo operator, ~50–200 lifetime
> customers, **truth-only**, the mockup is the moat. **Goal: first paying customer ASAP.**

---

## 0. Where we actually are (read first)

- **~20 openers already sent** — on the *old* copy (two links, "ben je geïnteresseerd?"), WhatsApp.
  At least one reply: **Wax and More** (4,9★/1.230, lukewarm) raising the canonical objection
  *"mijn website wordt weinig gebruikt, mensen vinden mij via Treatwell."* That's not a failure —
  it's the single most important objection in the business, and it's now answered (brand / Google /
  ownership; **never** commission — we embed their Treatwell booking link).
- **The new opener is shipped** (one link, opinion-question CTA, opt-out, Variant A/B, truth-gated).
- **So strategically:** treat the first ~20 as the **pilot / debug batch** (proved the mechanics
  work end-to-end). The *next* batch on the new opener is **Batch 1 — our first clean baseline.**
  We do **not** try to A/B old-vs-new (n far too small to attribute); we just reset and measure
  forward on the new copy.

**Immediate consequence — the first execution step is free signal we already own:** before sending
anything new, **tally the 20** (delivered / read / replied / positive / objection text). Even at
n=20 the *qualitative* read (which objections recur, did anyone click the mockup) tells us whether
to fix the opener, the targeting, or the offer. The leads table / admin "outreach" view already
holds `outreach_sent → replied | dropped`; the gap to fill is **why** each non-reply or reply went
the way it did.

---

## 1. The bet & what each batch tests

**The bet:** a finished, true, personalized mockup sent cold converts NL salons into €999 customers
better than any normal pitch. We are **not** optimising a known-good funnel — we are testing whether
the funnel *exists*. So the priority is a **clean read of reply → call → close**, not volume.

**What "ASAP" actually means here.** ASAP does **not** mean blast more — volume is hard-capped by
build throughput (~1–2 sites/week) and WhatsApp number-ban risk. ASAP comes from **conversion
quality**: maximise the close rate on the warm replies we *can* generate, and strip every gram of
friction out of reply → call → paid. The lever to the first sale is the **close**, not the send
count.

**Funnel arithmetic (planning assumption, NOT a forecast — flagged as such for sizing only).**
Take a planning-midpoint positive-reply rate **p ≈ 10%** (the 20-tally will replace this), reply→call
≈ 50%, call→close ≈ 30% → **send→close ≈ 1.5% → ~50–65 well-targeted sends per first close.** You're
~20 in. So the realistic path to the first paid customer is **~40–60 well-chosen sends with tight
follow-up and a sharp close** — a small-numbers game where one good-fit salon can land it sooner.
The job of this plan is to make those ~40–60 sends *count*.

**Kill / pivot signal** (from the measurement research): at this n the kill signal is **not** a low
number — it's a **consistent *value* objection across replies** ("ik zie de meerwaarde niet", not
"stuur maar info"). One booked call that reaches a genuine "maybe/ja" is strong evidence the bet is
alive. Don't rethink the product on copy/channel noise; see the decision gate (§5).

---

## 2. Target & selection — the ICP  ⭐

The targeting decision dominates everything downstream — a wrong-fit list makes even perfect copy
fail. **Bias hard toward salons that feel a real gap, away from the ones already winning online.**

**The Wax-and-More lesson, generalised:** a salon crushing it on Treatwell (very high rating, huge
review count, busy, *already has a site*) feels **no pain** → hardest sell. Don't lead with them.

### Tiering (qualify every lead into one)
- **Tier A — prioritise** (the easy yeses): **no owned website at all** (or a dead/placeholder one)
  · owner-operated · a **Dutch mobile** reachable · **4,0–4,8★ with a real review base** (gives a
  true hook, signals they care, not so flawless they're untouchable). The audit already found
  *3 of 13* salons had **no website at all** — those are the bullseye.
- **Tier B — second wave:** a **dated / thin** existing website (Wix-from-2016, a one-pager, a
  Facebook-only presence). Real upgrade story, slightly harder.
- **Tier C — skip (for now):** a strong existing site · no mobile (landline-only → no wa.me) ·
  mediocre reviews / no honest hook · the very-successful-and-knows-it salon. Not "never" — just
  not while we're hunting the first yes.

### List building
- The Treatwell directory crawler already produces these and the listing scrape exposes
  rating/website/photos — so qualification is mostly **already in the data**; add a lightweight
  "has own website?" + "mobile present?" flag to the worklist.
- **Cities — recommendation (low-stakes, changeable):** start with **Utrecht** (already crawled,
  66 leads, mockups proven there) so we don't waste an existing list, then add **one** comparable
  mid-size city for fresh Tier-A volume — **Amersfoort, Nijmegen, or Haarlem** (dense salon supply,
  *not* Amsterdam — over-saturated, pricier, more salons already have agencies/sites). Pick one and
  go; expand only when a city's Tier-A pool is worked through.
- **Target inventory:** **~40–60 qualified Tier-A/B leads** lined up — enough to feed the next
  2–3 batches without re-crawling mid-sprint.

---

## 3. Phased rollout & experiment design

Run it as **fixed-variable batches** so each read is clean (no A/B at this n — hold message +
channel constant; the only thing that changes batch-to-batch is the lead list).

| Phase | What | Size | Purpose |
|---|---|---|---|
| **Pilot (done)** | the ~20 old-opener sends | ~20 | proved the mechanics; mine it for objections (§0) |
| **Batch 1** | new opener, WhatsApp-first, Tier-A only | ~15–20 | first **clean baseline** on the new copy |
| **Gate** | read it (§5) | — | keep / change-message / change-channel / rethink |
| **Batch 2+** | same copy+channel, next Tier-A/B leads | ~20 | accumulate toward a real signal (~50–100 cumulative) |

**Rules:** one channel + one message per batch; honor any "nee"/opt-out instantly; never re-hit a
non-responder outside the 4-touch cadence; **respond to every reply fast** (a cooling warm reply is
the biggest leak in the whole funnel).

---

## 4. Weekly operating rhythm (the recurring execution loop)  ⭐

A repeatable loop, *independent of exact hours* — compresses or stretches to whatever evening blocks
exist. The ordering is what matters, not the calendar:

1. **Source & qualify** — crawl a city (or draw from the existing pool) → tag Tier A/B/C → keep a
   working list of ~20 Tier-A ready to send.
2. **Generate** — run the batch worker over the Tier-A leads → mockups live at `mock.<domain>/{slug}`
   (already `noindex`). Spot-check each for 0 fabrication before it's send-eligible.
3. **Send a batch** — from the warmed WhatsApp number, **ramped** (§7), in the salon-friendly window
   (late morning / quiet early afternoon, Tue–Thu; learn the real window from reply timestamps).
4. **Work replies — daily, fast.** This is the highest-value activity in the whole loop. A reply
   gets a same-day response and a booked call. Reciprocity decays; momentum is the asset.
5. **Run calls & close** — the §6 runbook → iDEAL link in the moment → asset collection.
6. **Build & deliver** — won site inside the 5-werkdagen SLA. Build capacity (~1–2/wk) is the real
   throughput ceiling, so **don't out-send what you can build** once closes start landing.
7. **Follow-up cadence** runs in parallel: every sent lead is on the **4-touch** schedule
   (T1 day 0 / T2 +3 / T3 +9 channel-switch / T4 +16 true breakup) — see OUTREACH.md §3.

**The bottleneck moves over time:** early on it's *replies* (need more at-bats); once closes start,
it's *build capacity*. Plan the next loop around whichever is currently scarce.

---

## 5. Funnel, metrics & decision gates  ⭐

**The funnel:** `sent → delivered → mockup-click (human, bot-filtered) → reply → positive reply →
call booked → paid`. Log per send: salon, channel, tier, hook type, send time, click(human),
reply(+sentiment), call, paid, opt-out, **block/report**, objection text.

**The two diagnostics that matter most at our n:**
- **Human mockup-click** (you own the slug — almost no cold operation has this). It splits failure
  cleanly: **low click → fix the opener/targeting; high click but no reply → fix the mockup/offer.**
- **Every reply's *text*.** At n≈20–50 the qualitative objection signal *is* the ROI — it's how we
  tell a value problem from a copy problem.

**Channel-health counter (can force a decision before reply data is conclusive):** blocks + reports
per number. **> ~2–3% → pause that number, rotate, review copy/targeting.**

**The read (Bayesian, per channel):** posterior `Beta(1+positives, 1+N−positives)`; report the 95%
credible interval and `P(p > p0)`, not a point estimate. `p0 ≈ 0.10` (a derived viability floor —
recompute from real call/close rates, see OUTREACH.md §7). **Don't expect to "estimate the rate" at
n=20** (3/20 → CrI ≈ [5%, 36%]); you're looking for *direction* + objections.

**Decision gate after each batch:**
- **Scale** (more of the same): `P(p>p0) ≥ 0.80` **and** ≥1 reply reached the call stage.
- **Keep going, no change:** posterior straddles `p0`, N < ~50 → just thin, send another batch.
- **Change the *message*:** good human-click, `P(p>p0) ≤ 0.20` → opener earns looks but offer/CTA
  doesn't convert → fix mockup/CTA.
- **Change the *channel*:** low delivered/click across 2 batches, or block/report > ~2–3% → rotate
  number / next channel.
- **Rethink the *product/offer*:** only after **~100+ sends across ≥2 channels** with a consistent
  *value* objection — never on early noise.

---

## 6. Reply → call → close runbook  ⭐

The send is only the trigger; this is where the first €999 is actually won. Full copy/objection
tables are in OUTREACH.md §4; this is the *sequence*.

1. **Reply lands → respond same day.** Don't presume they loved it (a reply can be a question or a
   critique). Warmly offer the call as a **"we lopen 'm samen door"** walkthrough, not a sales call:
   *"Zal ik 'm even met je doorlopen — hoe 't werkt en wat 't kost? 15 minuten, kies maar een moment:
   {Cal.com}."*
2. **The "Treatwell brengt mij klanten" reply** (you'll get this a lot): validate → reframe to
   **visitekaartje / Google-vindbaarheid / van jóu**, low-pressure, **no commission claim.** If
   they're genuinely thriving and uninterested, let them go gracefully (and note the pattern).
3. **The 15-min call:** ~1 min agenda → **~6 min walk *their* live mockup and invite 2 small edits**
   (this co-creation is the real endowment lever — don't over-question) → light true-yeses → **price
   only now** (€999 eenmalig, eigen .nl-domein, 5 werkdagen; care plan *after*) → trial-close.
4. **On a clear "ja":** confirm, then **send the iDEAL link in the moment** (don't "mail it later" —
   friction and a cooling endowment effect are the enemy) → asset-collection list → schedule the
   build.
5. **Build & deliver** inside 5 werkdagen → that becomes **customer #1 and your first real social
   proof** (one named local-salon quote beats any vague claim).

**Honest urgency only** (a true limited build capacity, the genuinely-temporary preview). **Never
fake scarcity.**

---

## 7. Timeline & milestones to the first paid customer

ASAP, reconciled with the one real lead-time cost (a safe WhatsApp number).

**The WhatsApp-number call (recommended):** warming a **dedicated, burnable number** is the single
biggest channel-risk mitigation — a fresh number blasting near-identical messages is the textbook
ban profile. **But** full warm-up (~1–2 wks) fights "ASAP." **Reconciliation:**
- You already have a number that sent the first ~20 — **keep nurturing those live threads on it**
  (they're already "warm" conversations, low ban risk).
- **Start warming a dedicated number now, in parallel** (~1 week of real two-way use is enough to
  begin), then send **Batch 1 from it, ramped** (~5/day → 10 → 20). This costs ~a week but protects
  every send after — net faster to *sustained* outreach, which is what gets to the first yes.

**Milestone ladder** (sequence, not dates):
- **M1 — Mine + qualify.** Tally the 20 (objections, any clicks). Qualify ~40–60 Tier-A/B leads
  across Utrecht + 1 city. Start the dedicated-number warm-up.
- **M2 — Batch 1 out.** ~15–20 new-opener sends from the (minimally warmed) number; cadence + reply
  SLA running.
- **M3 — First call booked & run** (walkthrough framing). ← the first real conversion signal.
- **M4 — First close & deliver** in 5 werkdagen. ← the goal.
- **M5 — Iterate:** read the gate, scale or adjust, and turn customer #1 into social proof.

The fastest path to M4 is **M3 quality**, not send volume. Protect the calls.

---

## 8. Pre-flight checklist (must be true before Batch 1 send #1)  ⭐

| # | Item | State |
|---|---|---|
| 1 | New opener deployed (one link, question-CTA, opt-out, Variant A/B) | ✅ done |
| 2 | Mockups live + `noindex` + `robots.txt` | ✅ done |
| 3 | A place to **log sends/replies/objections** (admin "outreach" view or the leads table) | ◻︎ confirm it captures objection text + click |
| 4 | **Dedicated WhatsApp number** warming started | ◻︎ start now (§7) |
| 5 | **Cal.com** intro-call link live (`/kennismaking`) | ◻︎ operator task (PROGRESS "manually pending") |
| 6 | **Stripe iDEAL payment link** ready to paste | ◻︎ confirm exists |
| 7 | Short **privacy/opt-out note** on revivostudios.io (the opener links it) | ◻︎ cheap, do it (OUTREACH.md §8) |
| 8 | **~40–60 qualified Tier-A/B leads** with mockups generated + spot-checked | ◻︎ the M1 work |
| 9 | Brand-domain decision (`mock.<brand-domain>` vs `*.vercel.app`) | ◻︎ nice-to-have, not a blocker for WhatsApp |

Items 4–8 are the real M1 work; 1–2 are done. None of 3–9 individually blocks a *first* small batch
except a missing way to **book the call (5)** and **take payment (6)** — those two must be live before
a reply can convert, so they're the highest-priority operator tasks.

---

## How execution plans derive from this

- **Per-batch checklist** = (lead list for this batch) + (which opener variant per lead) + (send
  window) + (the log columns to fill). One throwaway list per batch.
- **Weekly runbook** = §4 made concrete for the week's available evenings.
- **The gate (§5)** is run *after every batch* and its outcome dictates the next batch's shape.

When in doubt, the order of operations is always: **get the call → protect the call → close the
call.** Everything upstream (targeting, copy, channel) exists to produce one good call with a
real-fit salon.
