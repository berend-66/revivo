# Luxe Website Template

A reusable single-page website template with a cinematic intro and a warm,
luxurious visual style. Built as plain HTML + CSS + a little vanilla JavaScript —
no build step, no dependencies. Open `index.html` in any browser and it runs.

Use this as the starting point for new sites that should share the same
"luxe" look and the same opening transition.

---

## What's included

- **Intro splash** — a full-screen logo fade-in that plays once per browser
  session, then dissolves to reveal the page.
- **Animated hero** — slow background zoom + headline rise on first paint.
- **Full design system** — colour palette, type scale, buttons, the signature
  "arch" image frames, reveal-on-scroll, sticky frosted nav, mobile menu.
- **Bilingual NL / EN toggle** — flip any text by adding `data-nl` / `data-en`.
- **All the standard sections** — hero, trust strip, about, services (tabbed),
  gallery, team, reviews, call-to-action, contact (hours + map), footer.

Everything is **placeholder content** — swap it for your own.

---

## File structure

```
luxe-website-template/
├─ index.html                     ← the whole site
├─ README.md                      ← this file
└─ assets/
   ├─ logo-splash.svg             ← intro logo (square, dark background)
   ├─ logo-footer.svg             ← footer logo (light)
   ├─ placeholder-hero.svg        ← 1600×1000
   ├─ placeholder-portrait.svg    ← 900×1100
   ├─ placeholder-square.svg      ← 600×600
   ├─ placeholder-wide.svg        ← 1200×600
   └─ placeholder-tall.svg        ← 600×900
```

---

## How to customise

Open `index.html` and search for these markers:

| Marker    | What it controls                                           |
|-----------|------------------------------------------------------------|
| `[BRAND]` | Brand name / wordmark (nav + footer credit)                |
| `[COLOR]` | Colour palette — the `:root` tokens at the top of `<style>`|
| `[FONT]`  | Font pairing (the Google Fonts link + `--serif`/`--sans`)  |
| `[IMG]`   | Image swaps — drop your files in `/assets`, keep the sizes |
| `[COPY]`  | Headlines and body text (both `data-nl` and `data-en`)     |
| `[LINK]`  | Booking, Instagram, map and review links                  |

### 1. Colours
Edit the tokens under `[COLOR]` in `:root`. Changing `--bordeaux`, `--creme`,
`--warm-white` and `--amber` re-skins the entire site. If you change the splash
background, also update `--splash-bg` **and** your splash logo's background so
they match seamlessly.

### 2. Fonts
Replace the `<fonts.googleapis.com>` link and update `--serif` / `--sans`.

### 3. Logo & images
Replace the files in `/assets` with your own, keeping the same filenames (or
update the `src` paths). Keep roughly the same aspect ratios so layouts hold.
- The splash logo should be square with a solid background equal to `--splash-bg`.

### 4. Text & translations
Each translatable element has `data-nl="…"` and `data-en="…"`. Edit both.
To add a new translatable element, give it both attributes — the toggle picks
them up automatically.

### 5. Links
Placeholder links end in `-link` (e.g. `#book-link`, `#instagram-link`,
`#map-link`). These intentionally do nothing until you replace them with real
URLs. Internal section links (`#services`, `#contact`, …) smooth-scroll and work
as-is.

---

## Tweaking the intro

In the `<script>` at the bottom of `index.html`:

- **Duration on screen** — change `setTimeout(hideSplash, 1800)` (milliseconds).
- **Replay every visit** — the intro is remembered per session via
  `sessionStorage` key `site-splash-shown-v1`. Bump the version string to force
  it to replay, or remove the `sessionStorage` guard to show it on every load.
- **Reduced motion** — visitors with "reduce motion" enabled skip the intro and
  all animations automatically.

---

## Deploying

It's static. Upload the whole `luxe-website-template/` folder to any host
(Netlify, Vercel, GitHub Pages, or plain shared hosting) and point your domain
at `index.html`. No server or build required.
