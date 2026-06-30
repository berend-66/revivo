# Revivo Studios — Outreach Playbook (v2, first 20–50 sends)

> Synthesized 2026-06-29 from a 9-angle web-grounded research run (legal, channels, copy,
> psychology, free-artifact play, objections/close, cadence, salon market, measurement),
> with 34 high-stakes claims independently verified (legal = 3 voters each). Pairs with
> [PROGRESS.md](PROGRESS.md) / [ROADMAP.md](ROADMAP.md). This is the *outreach + conversion*
> reference; the opener code lives in `packages/shared/src/opener.ts`. The **raw per-angle
> findings + all sources** behind this playbook are in [OUTREACH-RESEARCH.md](OUTREACH-RESEARCH.md);
> the **campaign masterplan** that operationalizes it (ICP, batches, gates, timeline) is
> [OUTREACH-PLAN.md](OUTREACH-PLAN.md).

> **Practical operator guidance — not formal legal advice.** Where the research genuinely disagreed or was low-confidence, it's flagged inline, and the load-bearing facts (especially legal) are listed with sources in §10 so you can check them yourself. Anchors: ~50–200 lifetime customers, €999, mockup-first, **truth-only**, Berend solo on evenings/weekends.
>
> **Reading order:** sales-first — message (§2) → cadence (§3) → close (§4) → psychology (§5) → channels (§6) → measurement (§7). The legal/compliance **constraints** the tactics must respect are in §8.
>
> **Register convention used throughout:** address the owner as **"je/jij"**; use **"jullie"** only for the salon/team as a collective ("jullie team", "jullie prijzen"). Don't mix them randomly.

---

## 1. TL;DR — the core strategy

**Lead with the link on WhatsApp, send once-per-salon then ≤3 light touches, and treat the 15-minute call as a "we lopen 'm samen door"-walkthrough, not a pitch.** Your moat is a finished, true, personalized site at a public URL — so the opener's *only* jobs are (1) prove in the first 7 words this is really about *them*, (2) earn the click, (3) provoke a low-friction reply. Cut the current opener's two links and 3–4 asks down to **one link (the mockup) + one opinion question** ("wat zou je als eerste anders willen zien?"). Default channel order is **WhatsApp (when a Dutch mobile exists) → Instagram DM → email fallback**; phone only as a *warm* follow-up. Follow up **at most 4 times over ~3 weeks**, each touch adding a genuinely new true thing, ending on a *true* breakup — which is only honest if you actually give mockups an expiry. On the call, walk *their* live site, let them request edits, reveal €999 only *after* they've reacted to the quality, anchor it, then send the **Stripe/iDEAL link once they've said yes**. Treat batch one as a **funnel-debug + objection-mining run, not a conversion-rate estimate** — at n=20 you cannot tell a 10% reply rate from a 30% one.

Two things this version fixes that v1 got wrong: **(a) truth-safety** — no fabricated owner first name, and contents/feature claims are gated to what's actually on each lead's mockup; **(b) the real binding constraints** — your **build throughput** (~1–2 sites/week) and your **WhatsApp block/report rate**, not the reply rate, are what actually govern this business, so they're instrumented and drive the decision rule (§7).

---

## 2. The message (most important section)

### What's wrong with the current opener
```
Hoi! Ik kwam {name} tegen, {hook}!
Ik bouw websites voor salons en heb er voor jullie een gemaakt, met {jullie echte prijzen, jullie team en echte reviews} erin:
{mockUrl}
Kijk gerust even rond, benieuwd wat je ervan vindt! Ik hoor graag als je geinteresseerd bent :)
Verdere info kan je op onze eigen website vinden: {revivostudios.io}
Groetjes, Berend
```
Problems: **2 links** and **3–4 competing asks** ("kijk rond" + "wat vind je" + "geïnteresseerd?" + go-to-our-site). Multi-CTA is the *worst-performing* structure in the large datasets; the second link dilutes the click and raises email spam score; **"ben je geïnteresseerd?"** asks for a buying-signal commitment the reader hasn't formed (easy to **ignore**), where an *opinion* question is lower-friction. And the weakest hook tier — **"mooie salon in {city}"** — is exactly the generic flattery that now reads as an AI red flag.

> **Truth-gated placeholders (read before editing copy).** Two fields are produced by the existing `opener.ts` per-lead logic and must stay gated:
> - **`{hook}`** = the existing truth-only ladder (rating ≥4,5★/≥25 reviews → mild rating ≥4,0 → real on-mockup menu item → city). Unchanged.
> - **`{contents}`** = the existing `realContentsClause`, which lists **only the fields actually scraped and present** (prijzen / team / reviews). If nothing is certified, **`{contents}` is empty and the sentence is omitted.** **Never hardcode a contents claim, and never assert "foto's"** unless the builder certifies real photos are on that page.
> - **No `{voornaam}`.** The pipeline has no reliable owner-first-name field, and a wrong name (stylist vs owner) is the single most obvious "this isn't really about me" tell. Open with **"Hoi!" + the salon name** (which the code already exposes). Only ever personalize with a first name if you add a *verified* owner-name field with its own truth gate — out of scope for batch one, and in tension with §8's data-minimisation.

### Variant A — WhatsApp / IG, strong-or-mild hook tier (default)
```
Hoi! Ik kwam {name} tegen — {hook} 🙂

Ik bouw websites voor salons en heb er alvast eentje voor
{name} gemaakt. {contents} Kijk maar:

{mockUrl}

Benieuwd wat je ervan vindt — wat zou je als eerste anders willen zien?

Groetjes, Berend (Revivo Studios)
Geen interesse? Eén berichtje terug en je hoort niets meer van me.
```
- **`{name}` in the first 7 words** — self-relevance before the reader decides to ignore; survives the WhatsApp/IG preview crop.
- **`{hook}` from the truth-only ladder** — specific, checkable praise is the only flattery that reads sincere, and it's your "not misleading" legal argument.
- **"alvast eentje … gemaakt. {contents}"** — the give-first *offer* CTA: reciprocity (unconditional gift) + proof-of-personalization, but the contents line only states what's genuinely on *this* lead's page. *(A/B later: full `{contents}` clause vs dropping it and letting the live site speak — the site may sell harder than describing it.)*
- **One link, above the mobile fold.**
- **"wat zou je als eerste anders willen zien?"** — single opinion-question CTA: low-friction, curiosity-opening, and it *advances the build*. Note: at the cold-opener stage the prospect owns nothing, so this is **not** an endowment effect — it's just an easy, ego-engaging question. The real endowment/IKEA lever comes later, on the call (§5).
- **Sender ID + opt-out line** — satisfies art. 7 Tw + GDPR art. 21 *and* lowers block-rate (protects the number).
- **One emoji, "je", short sentences** — correct register for informal NL salon owners. *(Emoji effect is small; don't over-test 🙂 vs 😁 vs none.)*

### Variant B — WhatsApp / IG, weak hook tier (menu-item or city-only)
The artifact *is* the compliment; drop the flattery. **Do not assert contents that aren't certified** — these are the data-poor leads, so `{contents}` is often empty.
```
Hoi! Ik bouw websites voor salons en heb er voor {name}
alvast eentje gemaakt.{menu_clause}{contents} Kijk maar:

{mockUrl}

Benieuwd wat je ervan vindt — wat zou je graag anders zien?

Groetjes, Berend (Revivo Studios)
Liever geen berichten? Eén berichtje terug, dan hoor je niets meer van me.
```
- **`{menu_clause}`** is present *only* on the menu tier and only for a real item on the mockup, e.g. *" Met o.a. balayage erin."* On the **city-only** tier it's empty.
- **`{contents}`** stays gated (usually empty here). **Truth fix vs v1:** v1 hardcoded "jullie eigen prijzen, team en foto's erin" on exactly the leads least likely to have them — backwards. Don't.
- **Pure city-only leads should be deprioritized or not sent;** track this tier's reply rate separately and consider killing it.

### Variants C & D — Email *(DEFERRED — not for batch one)*
Batch one is WhatsApp-first at n=20. Warming a dedicated sending domain for 4–6 weeks to send a few dozen emails is **negative ROI**, and email's legal position is no better than WhatsApp's. **Stand these up only if/when email becomes a real channel (volume in the hundreds/month).** Kept here so they're ready:

- **C (link-upfront)** — requires the brand subdomain + a warmed Workspace mailbox; one body link, brand site in the *signature* not the body; opt-out line; subject `{name}, wat vind je hiervan?` (personalized + question) as an eventual A/B vs bare-name `Voor {name}`.
- **D (link-deferred teaser)** — dodges the first-touch-link spam penalty and doubles as a question-CTA: *"…heb er voor {name} al een compleet voorbeeld klaarstaan. Zal ik 'm je even sturen?"* Whether D's spam-penalty dodge nets more booked calls than C's show-don't-tell immediacy is an open question — only testable once email is live.

Both use **"Hoi!" + `{name}`** (no `{voornaam}`) and the gated `{contents}`.

**Do NOT** put price, the €999, or any urgency in a first touch on any channel. Reveal price only after the artifact lands (§4).

---

## 3. Follow-up cadence

**4 touches over ~3 weeks, each adding a *new true* thing, anchored on the still-live mockup. Then stop.** Deliberately shorter than the literature's 4–7 because of NL spam law + your truth-only brand. ~Half of replies arrive after touch 1 (the two largest datasets disagree on the exact split — treat only the *direction* as fact); the first follow-up is usually the best-ROI message you can add.

| Touch | Day | Channel | Purpose & Dutch copy |
|---|---|---|---|
| **T1** | 0 | WhatsApp (or IG) | Opener (Variant A/B). |
| **T2** | +3 | same channel | Re-surface the link + offer an edit (no unverified feature claims). *"Hoi! Heb je 'm al kunnen bekijken? De voorbeeldsite voor {name} staat nog live op {link}. Wil je iets anders — een andere kleur of een andere foto voorop? Stuur maar, dan pas ik 't zo aan."* |
| **T3** | +9 | **switch channel** (e.g. WhatsApp→IG, or →email if available) | New angle, low-pressure. *"Hoi! Ik stuur 'm ook nog even hier. De voorbeeldsite voor {name} staat klaar: {link}. Geen verplichting — gewoon benieuwd of 't wat voor je is."* |
| **T4** | +16 | whichever channel they engaged most | **True breakup** (real loss aversion). *"Laatste berichtje van mij — ik laat je demo nog tot {datum} online staan, daarna haal ik 'm offline. Geen probleem als 't nu niet past; je weet me te vinden. Groetjes, Berend."* |

> **Truth gate on T2 (fixed vs v1):** do **not** offer generic example features ("online boeken", "Google-kaart") — if the mockup's "Boek nu" is a non-functional placeholder or the map is wrong, that's a checkable falsehood. T2 above claims **no feature**; it re-surfaces the link and offers an edit. If you *do* want to name something, gate it to an element that is **genuinely present and correct on that specific lead's mockup**, with the same discipline as `{hook}`.

**The breakup is only honest if the expiry is real** → make **"auto-unpublish the mockup ~30 days after first send"** a *policy*, not a bluff (this also serves the §8 GDPR/IP posture). No "last chance", no fake countdown, no guilt — desperation markers lower status and (Gong) reduce booked meetings even when they raise raw replies.

**Rules:** space touches 3–9 days (widening), never two channels same-day, honor any "nee"/opt-out *instantly* as a hard stop. **Re-engage non-responders once, ~75–90 days after the breakup, only with a genuinely new true hook.** Still zero engagement → archive (`dropped`) and stop.

---

## 4. The call & close

The site already did ~80% of the closing (puppy-dog close + endowment). **Reframe the Cal.com booking from "sales call" to "walkthrough + go-live."** Booking reply (neutral — don't presume they loved it, since a reply can be a question or a critique):
> *"Dankje voor je bericht! Zal ik 'm even met je doorlopen — hoe 't werkt en wat 't kost? 15 minuten, kies maar een moment: {Cal.com}."*

### 15-minute structure
1. **~1 min — warm + agenda.** *"Ik hou 't kort: ik loop de site met je door, jij zegt wat je wil aanpassen, en ik vertel wat 't kost — goed?"*
2. **~6 min — walk the LIVE mockup together and invite edits.** This *is* the discovery, and **the on-call edits are the real endowment/IKEA lever** (the opener question wasn't). **Do NOT run a heavy SPIN interrogation** — over-questioning a €999 sale adds friction and signals an enterprise process. Capture edits live; they double as your asset brief. *(Note: the close-rate lift from co-creation is an untested hypothesis, and edits add per-build variance against the 5-day SLA — see capacity, §7. Treat "let them request 2 small changes" as a structured, bounded step, not an open redesign.)*
3. **~2 min — light true-yeses.** *"Herken je je salon hierin?" "Klopt dit aanbod nog?"*
4. **~2 min — price + anchor** (only now): *"De site kost eenmalig €999 — ontwerp, je eigen .nl-domein, binnen 5 werkdagen live. Geen verplicht abonnement; wil je dat ik 'm onderhoud, dan is dat €[10–15]/maand, maar dat hoeft niet."*
5. **~3 min — trial-close → confirm the "ja" → *then* the iDEAL link.**

### Price anchoring (with the caveat v1 dropped)
- **Reveal price only after they've reacted to quality** — leading with €999 invites "te goedkoop, dus niet goed?" After they've seen the output, €999 reads as a deal.
- **Anchor carefully.** A salon with no website may anchor "een website" to **free Instagram/DIY**, not "a few thousand euro" — so a seller-asserted "al gauw een paar duizend euro" can be discounted as self-serving. Stronger: point to a **neutral third-party NL pricing guide** ("kijk maar wat 'n website laten maken normaal kost") and frame €999 as **eenmalig en helemaal van jou** against the **perpetual DIY-tool subscriptions** (Wix/Squarespace) they'd otherwise pay forever. *(Do **not** anchor against "Treatwell-commissie" — that saving isn't real for our model; see the commission note above.)*
- **Introduce the €10–15/mo care plan *after* €999** so it reads as trivial.
- **Don't discount reflexively** — a fast price drop tells a Dutch buyer the €999 was fake. Prefer an honest payment split or a *true* intro-price.
- Present **BTW clearly** (incl/excl 21%).

### Objection-handling table (Dutch)
> Most of these are generic web-pitch reframes, lightly Dutchified — fine, but they carry no Revivo edge. **Your one differentiated line is "je hebt 'm trouwens al gezien — dit staat er nú al."** Lean on the live artifact; it's the only reframe nobody else can make.

| Objection | Reframe (Dutch) |
|---|---|
| **"Te duur"** | Diagnose first: *"Zit 't 'm in 't bedrag zelf of in de timing?"* Then anchor: *"Dit is eenmalig €999, en je eigen site is van jou — geen doorlopende kosten als je 't niet wil."* Hold the price. |
| **"Ik heb al Instagram"** | *"Helemaal goed, Insta houden we erin — er komt 'n knop naar je profiel. Maar Insta is geleend terrein: 't algoritme bepaalt wie je ziet, en je komt er niet mee bovenaan in Google als iemand '[behandeling] [stad]' zoekt. Je eigen site is van jou."* |
| **"Ik heb 't te druk"** | *"Snap ik, daarom doe ik 't juist volledig voor je. Jij levert wat foto's en 'n paar regels, de rest regel ik — je bent er max 'n half uur mee kwijt. En de site staat al voor 90% klaar, je hebt 'm gezien."* |
| **"Mijn neefje kan dat ook"** | *"Kan zeker! De vraag is meestal: gebeurt 't ook, blijft 't bijgehouden, en is-ie er als er iets moet veranderen? Ik lever in 5 dagen en ben er daarna ook. En je hebt 'm trouwens al gezien — dit staat er nú al."* |
| **"Ik zit vol / heb geen site nodig"** | *"Dat is juist 't beste moment: je hoeft niet te jagen op klanten, dus de site is puur je visitekaartje — hoe je eruitziet als iemand je googelt of je naam doorkrijgt. Onafhankelijk van hoe een platform je toont; van jou."* |
| **"Stuur maar info"** | Don't send a PDF. *"Eigenlijk heb je 't belangrijkste al gezien — de site zelf :) De rest is vooral: wat 't kost (€999 eenmalig), hoe snel 't live staat (5 werkdagen) en wat jij moet aanleveren. Dat leg ik je in 10 min makkelijker uit dan in 'n lap tekst. Past {dag} of {dag}?"* If they insist: 3 lines (prijs, 5 werkdagen, jouw input) + the call ask. |
| **"Ik denk er nog over na"** | Isolate, don't push: *"Helemaal goed. Even zodat ik je goed help — zit je twijfel 'm in de prijs, de timing, of in iets aan de site zelf?"* Then address only that. |
| **"Wat is de catch / waarom gratis?"** | *"Ik bouw deze als voorbeeld — kost mij weinig moeite met de tools die ik gebruik. Je betaalt alleen als je 'm wil houden en live wil hebben. Geen verplichting."* |

### Don't pitch a commission saving — it isn't true for our model
**Cut this angle entirely.** Treatwell's **35% is only the *marketplace acquisition* fee on a new client's first booking**; Treatwell is *also* the salon's booking/admin software, so their own direct & repeat bookings are already 0% — they are **not** "losing 35% of their revenue", and a Treatwell-using owner knows it. Decisive for us: **our website embeds the salon's existing Treatwell booking link**, so a Revivo site routes bookings *into* Treatwell — it creates **no** commission-free channel. *"Boek voortaan commissievrij via je eigen site"* would be a checkable falsehood that detonates trust → it violates truth-only. **Never use it.**

**The honest value props that remain (and they're enough):**
- a **professional, branded presence** — a real website vs a platform listing or no site;
- **Google-vindbaarheid** for their name and "[behandeling] [stad]" — owning their own search result;
- **ownership** — a front door that's *theirs*, not a platform's template.

The site **complements** Treatwell (which stays their booking engine); it doesn't touch its economics. Lead commercial value here, never on commission.

### Close: confirm the "ja" before pushing payment
v1 stacked trial-close → assumptive two-option → immediate iDEAL link in one breath — too forward for an audience this playbook repeatedly says distrusts hard-sell. **Separate the yes from the payment:**
- **Trial-close:** *"Zou dit zo, met die paar aanpassingen, 'n site zijn die je live wil hebben?"*
- **On a clear "ja" — then, and only then:** *"Mooi. Dan maak ik 'm voor je af en zet 'm live, binnen 5 werkdagen. Ik stuur je nu de betaallink (iDEAL); zodra die rond is, plan ik je in. Komt deze week of volgende week beter uit?"*
- **Send the iDEAL link in the moment** once they've agreed — for €999 the enemy is friction and a cooling endowment effect. Don't "mail it later."
- **True urgency only:** *"Ik bouw alles zelf en neem maar 'n paar salons per [maand/week] aan"* (only if literally true) + the genuinely-temporary preview. **Never "nog 3 plekken."**

### Legal note on terms (incl. the reflexwerking caveat v1 missed)
- **No statutory 14-day B2B cooling-off** here, so write your own **algemene voorwaarden** (scope, refund/cancellation, esp. the recurring care-plan term). The 19 Jun 2026 *herroepingsknop* is **B2C-only** → N/A to a genuine B2B care plan.
- **But "B2B" is not a blank cheque:** a small eenmanszaak buying a website (outside its expertise) can invoke **reflexwerking** to strike down *unreasonably onerous* general-terms clauses. So make the care-plan terms **fair and clearly cancellable** (reasonable notice, easy opt-out) rather than relying on "it's B2B, anything goes." Verify the care-plan buyer is contracting in a business capacity.

---

## 5. Persuasion principles applied

| Principle | Where it fires | The specific move |
|---|---|---|
| **Reciprocity** (strongest lever) | T1 opener | Unconditional, personalized gift, **no hard ask attached**. Reciprocity decays → **reply fast** when they respond. |
| **Endowment / IKEA effect** | **The call** (not the opener) | On the call, have them *choose* the hero photo and pick between two palettes — their small labour manufactures honest ownership. (Untested close-rate lift; keep it a *bounded* 2-edit step against the SLA.) The opener's opinion question is low-friction curiosity, **not** endowment — they own nothing yet. |
| **Loss aversion** | T4 breakup + temporary link | A *true* expiry. **Don't over-engineer copy around it** — the effect is real but moderated (λ≈1.3–2.0) and verbal message-framing effects are near-zero; the mockup is the moat, not the framing word. |
| **Authority by demonstration** | Whole flow | The mockup *is* the proof; demonstrated competence beats claimed authority. Add niche focus: *"ik bouw alleen voor salons."* |
| **Social proof (from zero)** | After customer #1 | Honest founding narrative now (*"ik ben net begonnen, zoek de eerste salons in {stad}"*); the moment you close #1, one named local-salon quote beats any vague "50+ salons." |
| **Anchoring** | Price reveal | €999 *after* quality, against a neutral pricing reference + "eenmalig en van jou vs. een DIY-abonnement dat doorloopt"; care plan *after* €999. **Not** against platform commission (not a real saving — §4). |
| **Foot-in-the-door** | The funnel | Click (near-zero yes) → reply → 15-min call → pay. |

**Avoid for a Dutch SMB audience (these *reduce* trust here):** fake scarcity/countdowns; door-in-the-face / pressure-closing / aggressive chasing; generic flattery; corporate "wij"-inflation (honest solo-specialist framing is *more* persuasive); attaching a hard ask to the gift; revealing price before quality; naming the platform or telling them their online presence is already strong.

---

## 6. Channel strategy

**Primary: WhatsApp when a Dutch mobile is known. Then Instagram DM. Email is a *later* channel, not a batch-one channel. Phone only as warm follow-up. Drop LinkedIn and postal entirely.**

The decision is dominated by one fact: **your payload is a clickable live link, and a raw link behaves completely differently per channel.** On WhatsApp/IG a link is native and expected (the *direction* "messaging >> email on read" is robust; the "95–98% open" figures are vendor folklore — don't quote them). In cold email, a link to `*.vercel.app` is a textbook spam signal: shared, heavily phishing-abused, domain-mismatched with your sender; filters score the *linked* domain.

### Resolve the brand-domain question FIRST
You currently have **two** domains: `revivo.nl` (infra — the mock-app comment, llm/client, fixtures reference it) and `revivostudios.io` (brand/marketing). For the link to look owned in every channel — and for any future email sender-domain alignment — **the marketing site, the mock host, and any future sending domain must share one brand domain.** The opener already links the brand site, so aligning the mock host to it (`mock.<brand-domain>/{slug}`) is the consistent move. **The point is *one* domain, picked deliberately — not assuming `revivostudios.io` while the repo still points at `revivo.nl`.** Make this call before batch one; everything below writes `mock.<brand-domain>/{slug}`.

Moving mockups off `*.vercel.app` onto that brand subdomain is worth doing — but mainly for **link credibility and isolating reputation off a phishing-abused shared host.** It is **not** the "single biggest email fix": for email, the dominant deliverability levers are **SPF/DKIM/DMARC, domain reputation, complaint rate, and warm-up**; a single clean link is a *secondary* signal. Since batch one is WhatsApp-first, the subdomain's value here is credibility, not unblocking email.

### Per-lead routing
1. **Dutch mobile present → WhatsApp.** Reaches the owner directly, no gatekeeper.
2. **No mobile, active Instagram → IG DM.** Warm 12–24h before (follow + one genuine like/comment); keep line 1 short and hook-forward so it shows in the Requests preview; check Requests *and* Hidden Requests for replies (no notification fires).
3. **Only a published business email → email fallback** (later; see deferred Variants C/D in §2).
4. **Phone** is a *follow-up* to a sent link 2–3 days later, never a cold open.

### WhatsApp number: warm it before you burn it
A brand-new number firing its first burst of near-identical "Hoi … {link}" messages to unsaved contacts is the **textbook ban profile.** Don't do 20–30/day on day one:
- **Warm-up:** use the number as a normal phone for ~1–2 weeks (real two-way chats, receive messages, save contacts).
- **Ramp:** ~5 cold sends/day → ~10 → ~20, not 20–30 from the start. **Save each prospect's number before messaging** where feasible (unsaved-contact sends are weighted heavily).
- **Expect to rotate.** Keep a spare SIM; treat the number as infrastructure you will replace.

### Instrument the BINDING risk metric (missing in v1)
Positive-reply rate is *not* what kills the channel. Track, per number/channel: **blocks, reports, and complaints per send**, plus proxy signals (WhatsApp "this number is being reported"/quality warnings, sudden delivery or blue-tick collapse, IG message restrictions). **Rule:** if block+report rate exceeds **~2–3% of sends on a number** (a starting heuristic to refine, *not* a Meta-published threshold), **pause that number, rotate, and review copy/targeting before continuing.** This counter sits alongside the funnel in §7.

### Send windows — a hypothesis, not guidance
Underlying evidence is **LOW confidence and explicitly an untested inference.** Best guess to *validate against batch-1 reply timestamps*: **Tue–Wed, late morning or quiet early afternoon between clients; likely avoid Monday (often closed) and Fri/Sat (slammed).** Batch one goes out late June (a busy stretch) — expect slower replies. Don't treat the windows as established; learn them from your own timestamps.

---

## 7. Measurement & experiment design

### The funnel (conditional rates, per channel)
`sent → delivered → mockup-click (deduped, bot-filtered) → reply → positive reply → call booked → paid`

> **"seen" is dropped as a clean stage.** Email opens are uninterpretable post-Apple Mail Privacy Protection (pixel pre-fetch inflation); WhatsApp blue ticks require read receipts on both ends. Treat WhatsApp "seen" as a *soft, manual-only* glance signal, not a logged conditional rate.

**Clicks are not clean human intent.** Per-slug URL hits are contaminated by **link-preview/prefetch bots** (WhatsApp/`facebookexternalhit`, iMessage, Slackbot, scanner GETs). At n=20 a handful of unfurl fetches can dominate and invert the inference. So: **dedupe by IP+UA, filter known bot UAs, and prefer a first-party on-page event** (scroll depth / time-on-page / an in-page interaction) over the raw redirect hit before counting a "click."

Log **per send**: `salon_id, channel, hook_tier, contents_present, send_ts, delivered, click_human, replied, reply_sentiment, call_booked, paid, opted_out, block_or_report, legal_basis`.

### The real binding constraint is capacity — derive the threshold from it, not from thin air
v1's `p0=0.10` was asserted. It should *fall out of* throughput and unit economics:
- **Build capacity:** solo, evenings/weekends → ~1–2 sites/week at the 5-day SLA (on-call edits add variance → call it ~1 reliable concurrent build/week early on).
- **Sustainable safe outreach:** ~20–30 first-touches/week (WhatsApp daily cap + warm-up + personalization + per-lead truth-verification time).
- **To keep ~1 build/week fed from ~25 sends/week**, you need **send→paid ≈ 1/25 = 4%.** Decomposing with plausible downstream (reply→call ≈ 50%, call→paid ≈ 30%): required **positive-reply ≈ 0.04/(0.5×0.3) ≈ 27%** — high, so **early on you'll likely run *under* capacity, which is expected and fine.**
- **Viability floor:** below **positive-reply ≈ 8–10%** (send→paid ≲ ~1.5%), even your full sustainable volume can't fill one build/week, and operator-time per acquired €999 customer climbs past what the margin justifies.

So **`p0 ≈ 0.10` on positive-reply rate is a *derived viability floor*** (can sustainable volume fill capacity at acceptable time-cost?), not a KPI from the air. **Recompute it** from your real per-send time and real call/close rates. The object to *manage* is **paying-customers-per-operator-hour against build capacity**; reply rate is only the leading indicator.

### Why n=20 is a debug run, not an estimate
- **Rule of three:** 0/20 still leaves the 95% upper bound at `1 − 0.05^(1/20) ≈ 13.9%` — **zero replies does not falsify the play.**
- **Posterior width (use Beta, not Wald — the normal interval is invalid at these n/p):** 3/20 gives posterior `Beta(4,18)`, mean ≈ 18%, 95% **credible** interval ≈ **[5%, 36%]**. You cannot separate a 10% from a 30% true rate.
- **Targets stated as credible-interval widths** (posterior widths, *not* a Wald `n` formula): shrinking the 95% CrI to ~±10pp around p≈0.15 needs **N ≈ 45–50**; to ~±5pp, **N ≈ 130–150**.
- **A/B power:** detecting a 15%→30% lift at 80% power / α=0.05 is **~120–150 per arm.** **So do NOT A/B copy or channel in the first batches** — hold both **fixed** and get one clean baseline.
- **The paid rate is a rare event.** At send→paid ≈ 2%, pinning it to even **±0.5pp absolute** (≈ ±25% *relative*) takes **on the order of thousands of sends** — more than your entire lifetime customer count. (v1's "±5pp on a 1.5% rate" was dimensionally incoherent: ±5pp spans [0, 6.5%].) **Never manage the paid rate by estimating it;** manage it via funnel-stage diagnostics + priors.
- **Lifetime arithmetic, made consistent:** at **send→paid ≈ 1–2.5% → ~40–100 sends per paying customer**, 50–200 lifetime customers ≈ **~2,000–10,000+ lifetime first-touches** (the figure reconciled in §8).

### What to do instead
1. **Optimize the higher-frequency signal first: bot-filtered per-slug click-through.** Clicks accrue faster than replies and **disentangle two failure modes:** low CTR → fix the *opener*; high CTR but no reply → fix the *mockup/artifact*.
2. **Model reply rate Bayesian, per channel:** posterior `Beta(1+R, 1+N−R)`; report the credible interval and `P(p > p0)`, not a point estimate. **Don't pool across channels** — their base rates differ ~4–5× (this is **heterogeneity/confounding**, not Simpson's paradox; the label in v1 was wrong, the advice is right). **Pool across batches within a channel only with care:** the number's reputation, season (batch one = busy late-June), copy, and review-tier targeting all drift between batches, so within-channel pooling assumes a stationarity you won't fully have — weight recent batches more if you see drift.
3. **Read every reply's *text*.** At this n, the qualitative objection/confusion signal is the real ROI.
4. **Watch the block/report counter (§6)** in parallel — it can force a channel/number decision *before* the reply data is conclusive.

### Decision rule for batches of ~20 (and why mixing frequentist + Bayesian is fine here)
The credible-interval *sizing* above (how many sends to estimate p) and the Bayesian *stopping* rule below answer **different questions** — precision vs. a go/no-go probability. Sequential Bayesian stopping is coherent under the likelihood principle, so **you may peek after every batch without a multiplicity penalty.** Set `p0 ≈ 0.10` (derived above). After each batch, update `Beta(1+R, 1+N−R)` on positive replies:

- **Scale (more of the same):** `P(p > p0) ≥ 0.80` **and** ≥1 reply reached the call stage → continue, same channel/copy, accumulate toward ~100–150 sends.
- **Keep going, no change:** posterior straddles `p0` and N < ~50 → data is just thin; send another batch.
- **Change the *message*:** decent **human-click** rate but `P(p > p0) ≤ 0.20` → the opener earns looks but the *artifact or CTA* isn't converting → fix mockup/CTA first.
- **Change the *channel*:** low delivered or low click rate not moving across 2 batches, **or block/report > ~2–3%** → rotate number / re-route to the next channel.
- **Rethink the *product*:** only after ~**100+ sends across ≥2 channels** where you're confident the true rate is below the viability floor **and** the qualitative replies show a consistent *value* objection (not a copy/channel one).

---

## 8. Constraints — legal, compliance & risk (NL/EU)

**Honest internal posture: "strictly, opt-in applies and our cold sends don't fit the published-for-purpose exception, so we *mitigate* — we don't pretend B2B is exempt."** This is practical guidance, not a legal opinion; the load-bearing claims and their sources are in §10.

### What's actually true (verified — §10 rows 1–6)
- **The NL spamverbod (art. 11.7 Telecommunicatiewet) is channel-neutral and covers B2B.** Email, SMS, WhatsApp and Instagram DMs are all "elektronische berichten." One manual, personalized message can already fall under it; volume only affects enforcement *priority*, not whether the rule applies.
- **The B2B carve-out is narrow and, for email, entity-neutral.** No consent is needed *only if* the contact details were **"bestemd én bekendgemaakt"** (designated *and* published) for receiving commercial messages. A salon's booking email / IG / WhatsApp is published so *customers can book*, not to receive sales pitches → it fails the test. The "BV is fine / ZZP is protected" split is mainly the *telemarketing (phone)* regime; for *email/DM* a BV and an eenmanszaak are treated the same, and cold contact to either generally falls outside the exception. **"Only email BV salons" is false comfort.**
- **Enforcement reality is benign at your flow rate.** Every ACM spam fine on record hit bulk operations (Daisycon €810k for ~2bn emails; the *smallest* fined sole operator sent millions over years and ignored a prior warning). ACM's ceiling is **€900k per violation or 1% turnover** — *not* €20M/4% (that's the GDPR/AP ceiling, a different regulator). Realistic worst case for hand-sent personalized messages: a complaint and an informal "stop." **The binding risks are platform/number bans + an annoyed owner, not a fine.**

### GDPR + IP: the genuinely harder half — don't gloss it
The SEND is governed by the spamverbod; the **scrape, store, *and publish*** is governed by GDPR (and copyright/ToS). v1 understated this. Be honest:

- **The scrape/store** of minimal public business-contact fields, for a relevant offer, is **defensible on legitimate interest** after CJEU *KNLTB* (C-621/22, 4 Oct 2024): a purely commercial interest *can* be legitimate. But the **necessity** and **balancing** prongs still apply, and cold outreach has a Recital-47 "reasonable-expectation" headwind.
- **The publish is the real residual exposure.** The mockup **publicly republishes third-party personal data** (named team members, reviewer names + review text) and **copyrighted salon photos**, on a live, potentially Google-indexable URL. That is materially *more* than "minimal public business fields," and the research flagged it as close to the "scraping-to-make-money" the AP singles out — **plus** independent **copyright** in the photos, Treatwell's **sui-generis database right**, and a likely **Treatwell ToS** breach on the scrape itself. None of these are cured by the legitimate-interest send story.
- **Mitigations that actually address the publish/IP layer:**
  1. **`noindex` + `robots: disallow` + no sitemap entry** on `mock.<domain>/{slug}`, an **unguessable slug**, and the **~30-day auto-unpublish** (see §3) — so it's a temporary, practically-private preview, not a permanent public republication. This is also why the breakup line is truthful.
  2. **Lean on the salon's *own* photos** (you're effectively handing their content back to them) and be ready to remove any image instantly on request.
  3. **Minimise stored personal data:** store only what the opener/mockup needs (salon name, city, public rating/review count, menu items, public email/phone/IG handle, photos). **Do NOT store owner personal data or build profiles.** Short retention; delete non-responders after 60–90 days.
  4. **Instant takedown/objection.** Any "haal 'm offline" → done immediately, suppressed forever.
- **Honest bottom line:** the SEND is well-mitigated; the PUBLISH/IP layer is where you carry real (if low-probability) risk. With `noindex` + instant takedown + truth-only at your scale, the practical worst case is a salon asking you to remove the page — which you do at once — not a regulator. **Don't tell yourself the public republication is "clearly fine."**

### Lifetime volume vs the "below the radar" posture (the reconciliation v1 skipped)
At ~40–100 sends per paying customer (§7) and 50–200 lifetime customers, you're looking at **~2,000–10,000+ lifetime first-touches**, spread over *years* at lifestyle pace. The "micro / below the radar" read is about **flow** (sends per unit time + complaint rate), **not cumulative total** — and what keeps you safe scales with flow, not with the lifetime count: low instantaneous volume, genuine personalization, near-zero complaint/block rate, instant opt-out, a suppression list. What *does* change at cumulative scale: **you will burn through several WhatsApp numbers** over the lifetime → treat number rotation as routine ops (spare SIMs budgeted), and **re-check the posture at a self-set trigger** (first real complaint, or any quarter >200 sends, or new AP/ACM guidance). "Send once" means *per salon* (the 4-touch cadence, no re-hitting non-responders), not "few sends ever."

### Per-channel rating

| Channel | Rating | Why | Safest way to operate |
|---|---|---|---|
| **Email** | 🟡 AMBER | Same opt-in regime, best legitimate-interest story, lowest platform risk. Main issues are *deliverability* and the *link* (§6), not law. | Real Workspace mailbox on the brand domain, plain text, **one** brand-subdomain link, sender ID + opt-out line. *(Not a batch-one channel — see §6.)* |
| **Instagram DM** | 🟡 AMBER | Same spamverbod; binding constraint is platform restriction. Often the *only* channel salons expose. | Aged real business profile, cold DMs well under ~15/day, no automation tools, personalize, check Requests *and* Hidden Requests. |
| **WhatsApp** | 🟡→🔴 | Same spamverbod *plus* Meta ToS requires opt-in; the real danger is **number bans from block/report**. | **Dedicated, warmed, burnable number** (not personal), strictly manual via wa.me, ramped volume (below), line 1 unmistakably about them, no media dump, stop on any negative signal. |
| **Phone / cold calling** | 🔴 RED | Most salons are eenmanszaak/vof = natural persons needing opt-in; regime *tightens* 1 Jul 2026. | **Never a cold open.** Phone is a warm *follow-up* to an already-sent link only. |

### The five cheap mitigations (do all)
1. **One-page LIA**, written once, reused: interest = offering NL salons a relevant low-cost site; necessity = only minimal public business fields, no profiling; balancing = single message, truth-only, instant opt-out, temporary noindex preview.
2. **A short privacy/transparency note on the brand site** (already linked in the opener): you found their public listing, what you stored, the basis, that the preview is temporary, and how to object/take it down — satisfies art. 14 cheaply.
3. **An opt-out line in every message**, e.g. *"Geen interesse of liever geen berichten meer? Eén berichtje terug en je hoort niets meer van me."*
4. **A suppression list in Supabase** keyed by salon + channel, checked before every send; any "stop" → suppressed on *all* channels, forever.
5. **A 5-column send-log**: date, salon, channel, legal basis, opt-out received. Converts a worst-case complaint into "stop doing that," not a fine.

> **The tension, stated plainly:** the legal angle's safest posture is "send once, no chasing"; the cadence angle shows follow-ups capture ~half the replies. The reconciliation (§3) is a *short* 4-touch cadence with a frictionless opt-out and a hard stop on any "no" — erring cautious, because your brand dies if a message reads as spam.

---

## 9. Prioritized next actions

### (a) Decide + infra (do first; these gate everything)
1. **Resolve the one-brand-domain question** (`revivo.nl` infra vs `revivostudios.io` brand), then host mockups at `mock.<brand-domain>/{slug}` off `*.vercel.app`. Value here is **link credibility + isolated reputation** (not "unblocking email"; auth/warmup dominate that).
2. **Add `noindex` + robots-disallow + unguessable slugs + ~30-day auto-unpublish** to every mockup — serves both the truthful breakup (§3) and the GDPR/IP posture (§8).
3. **Per-slug click tracking with dedup + bot-UA filtering + a first-party on-page event** — your earliest, highest-frequency signal (only counts *human* clicks).

### (b) Copy / code
4. **Rewrite `packages/shared/src/opener.ts`:** one link only (brand site → signature, not body), replace `"Ik hoor graag als je geïnteresseerd bent"` with the single **opinion-question CTA**, add the **opt-out line**, keep **`{contents}` gated to `realContentsClause`** (never hardcode prijzen/team, never "foto's" unless certified), route the **city-only hook tier** to Variant B or skip it, and **remove any `{voornaam}` plan** (open "Hoi!" + `{name}`).
5. **Extend the lead lifecycle** beyond `outreach_sent → replied | dropped`: add `touches_sent, last_touch_at, next_touch_at, last_channel, reengage_at, suppressed, block_or_report`. Keep `outreach_sent` through the sequence; `dropped` only *after* T4 + grace.
6. **Upgrade `build-openers` / the HTML worksheet into a daily cadence queue:** new leads + leads with `next_touch_at ≤ today`, each with the correct per-touch/channel pre-written text, a "sent" checkbox, **a "suppressed" toggle, and a block/report flag.**

### (c) Operational
7. **Dedicated WhatsApp number — warmed, then ramped** (~5/day → 10 → 20; save contacts; not your personal number; spare SIM ready).
8. **One-page LIA + privacy/transparency note (with takedown promise) + Supabase suppression list + 5-column send-log.** Proportionate — do *not* build a consent-management platform.
9. **Confirm the Cal.com "walkthrough + go-live" framing**, and have the **Stripe iDEAL link + asset-collection list** ready to paste *in the moment* after a "ja".
10. **Write fair algemene voorwaarden** (scope, refund/cancellation, *clearly cancellable* care-plan term — mind reflexwerking).
11. **Bias batch-one targeting toward higher-review, multi-staff salons** (€999 ≈ 0.4% of a staffed salon's revenue vs ~3–4.6% of a solo's) — but keep **"no owned website + owner-operated + reachable on mobile"** as the *primary* filter (bigger salons more often already have a site). Treat review count as a **weak affordability signal, not a hard gate** — the "reviews ⇒ ability to pay" link is an unverified inference.

### (d) Deliberately NOT yet
- **No cold calling** (RED) — phone is warm follow-up only.
- **No email channel, no Instantly.ai, no domain warm-up** for batch one — negative ROI at n=20; stand up only if email volume reaches the hundreds/month, and even then only for published-business-email / BV salons.
- **No copy or channel A/B in the first ~2–3 batches** — n too small; hold variables fixed.
- **No scaling past ~20–40 sends** until you have human-click + reply data and a tightening Beta posterior.
- **No fake scarcity, no platform-bashing, no second link, no price in touch 1, no `{voornaam}`, no unverified contents/feature claims.**
- **No peripheral product features** until the first ~20 paying customers — the mockup is the moat.

---

## 10. Bronnen & geverifieerde claims

The load-bearing facts behind this playbook, with the verified verdict and 1–3 key sources so you can check them yourself. "Bevestigd" = independent reviewers confirmed; "met nuance" = confirmed but with a correction you must carry.

| # | Claim (load-bearing) | Verdict | Bronnen |
|---|---|---|---|
| 1 | **Spamverbod art. 11.7 Tw is opt-IN by default and channel-neutral** — e-mail, SMS, WhatsApp en IG-DM tellen identiek; volume raakt alleen handhavingsprioriteit. | Bevestigd, met nuance (er bestaat een smalle B2B-uitzondering — rij 2) | wetten.overheid.nl/BWBR0009950 · acm.nl/…/spam-voorkomen-uw-reclame · ictrecht.nl/kennis/factsheets/regels-commerciele-communicatie |
| 2 | **De B2B-uitzondering is smal en (voor e-mail) entiteit-neutraal:** zonder toestemming mag alleen als contactgegevens **"bestemd én bekendgemaakt"** zijn voor zulke reclame — een algemeen boekings-/info-adres voldoet meestal niet. "Alleen BV's mailen" is schijnzekerheid. | Bevestigd (3/3) | inview.nl/…/telecommunicatiewet-artikel-11-7 · ictrecht.nl/blog/bedrijfsgerichte-koude-acquisitie-mag-dat · omgevingsweb.nl/…/artikel-11-7 |
| 3 | **WhatsApp/SMS/IG-DM vallen onder hetzelfde regime als e-mail;** één gepersonaliseerd bericht kan al "spam" zijn (de wet kent geen onderscheid naar medium). | Bevestigd, met nuance (de "bestemd/bekendgemaakt"-uitzondering bestaat alleen omdat de ontvanger een onderneming is) | blog.iusmentis.com/2018/02/12/hoe-verboden-is-spambericht-relatie-whatsapp/ · acm.nl/…/spam-voorkomen-uw-reclame |
| 4 | **GDPR: minimale publieke bedrijfscontactdata scrapen op grond van gerechtvaardigd belang is verdedigbaar ná CJEU KNLTB (C-621/22, 4 okt 2024)** — commercieel belang kan legitiem zijn. **Maar:** noodzaak + afweging blijven, en het **publiek republiceren van foto's/teamnamen/reviews** (+ auteursrecht, databankrecht, Treatwell-ToS) is het moeilijke deel. | Bevestigd, met sterke nuance (de scrape is verdedigbaar; de publieke publicatie is de echte restrisico) | eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62022CJ0621 · privacymatters.dlapiper.com/2024/10/…legitimate-interests… · hoganlovells.com/…/cjeu-clears-the-air-dutch-dpas-interpretation… |
| 5 | **Handhaving ACM raakt alleen bulkspammers;** plafond **€900k/overtreding of 1% omzet** (NIET €20M/4% — dat is AVG/AP, een andere toezichthouder). Realistisch risico bij 20–50 handgeschreven berichten: een klacht, geen boete. | Bevestigd, met nuance (laag boeterisico ≠ wettelijk toegestaan) | acm.nl/…/Boetebesluit-Daisycon-voor-overtreding-spamverbod · acm.nl/…/ACM-kan-hogere-boetes-opleggen · acm.nl/…/uitspraak-cbb-zaak-spamboete-daisycon |
| 6 | **Koud bellen = RED:** de meeste salons zijn eenmanszaak/vof (natuurlijke personen → opt-in vereist), en het regime **verstrengt per 1 juli 2026** (einde soft opt-in voor telemarketing). Raakt niet het e-mail/DM-spamverbod. | Bevestigd (3/3) | acm.nl/…/vanaf-1-juli-strengere-regels-voor-telemarketing… · holla.nl/nieuws/telemarketing-alleen-nog-met-toestemming… · ddma.nl/kennisbank/…wetswijziging-telemarketing/ |
| 7 | **Treatwell's 35% is alleen een *marketplace-acquisitiefee* (eerste afspraak van een níéuwe klant); directe + herhaalboekingen zijn al 0%, en Treatwell is óók de boekings-/administratiesoftware van de salon.** Revivo **embeddt de Treatwell-boekingslink** → de site routeert boekingen *naar* Treatwell en bespaart **geen** commissie → **pitch GEEN commissiebesparing** (corrigeert een eerdere versie van deze playbook). | Bevestigd, met cruciale nuance (operator-correctie) | treatwell.nl/partners/prijzen/ · help.salonized.com/…/commission-for-new-clients-treatwell |
| 8 | **Geen wettelijk 14-dagen herroepingsrecht** bij B2B-verkoop van een website aan een salon; de **herroepingsknop (19 jun 2026) is B2C** → N/A. **Maar:** een kleine eenmanszaak kan via **reflexwerking** onredelijke algemene-voorwaarden-clausules (bv. een hard care-plan-beding) aanvechten. | Bevestigd, met nuance | ondernemersplein.overheid.nl/wetten-en-regels/bedenktijd-bij-verkoop/ · kvk.nl/wetten-en-regels/consumentenrecht-geldt-soms-ook-voor-ondernemer/ · wetten.overheid.nl/BWBR0005289 (BW 6:230o/230oa) |
| 9 | **€999 valt anders per segment:** ~3–4,6% van de jaaromzet voor een ZZP-salon (~€33k) vs ~0,4% voor een salon met personeel (~€247k); ~81% van de kappersbedrijven is ZZP. | Bevestigd, met nuance (gemiddelde is rechtsscheef; "veel reviews ⇒ koopkracht" is onbewezen — gebruik als zwak signaal) | anko.nl/…/Factsheet-kappersbranche-18-augustus-2025.pdf · cbs.nl/nl-nl/cijfers/detail/83858NED |

> **How to read this:** rows 1–6 set the legal posture (mitigate, don't pretend you're exempt; the real risks are platform bans + an annoyed owner, not a fine); row 4 is the one to internalize most — the *scrape* is defensible, the *public republish* is your genuine residual exposure, which is exactly why `noindex` + 30-day expiry + instant takedown are non-negotiable. **Row 7 is a correction**: the commission-saving angle is NOT usable (our site embeds Treatwell's own booking), so lead commercial value on **brand / Google-vindbaarheid / ownership**; rows 8–9 give the affordability + terms context. Never overclaim.
