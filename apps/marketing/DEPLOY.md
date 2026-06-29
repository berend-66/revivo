# Deploying the Revivo Studios marketing site (revivostudios.io)

The site is a **static Astro** app (no server, no env vars). Output: `dist/`.
NL is served at `/`, EN at `/en/`. `vercel.json` here pins the framework/build/output.

## One-time setup (Vercel + DNS)

1. **Create the Vercel project**
   - Vercel → **Add New… → Project** → import `berend-66/revivo`.
   - **Root Directory: `apps/marketing`** (this is the key monorepo setting).
   - Framework Preset: **Astro** (auto-detected). Build: `astro build`. Output: `dist`.
   - **Install command:** Vercel auto-runs `pnpm install` for the workspace. If the
     build can't resolve workspace deps, set it explicitly to:
     `cd ../.. && pnpm install --filter @revivo/marketing...`
   - Deploy. Confirm the `*.vercel.app` URL renders **both** `/` and `/en/`.

2. **Attach the domain**
   - Vercel → Project → **Settings → Domains** → add `revivostudios.io` **and** `www.revivostudios.io`
     (redirect www → apex, or vice-versa — pick one canonical).
   - At the registrar, point DNS as Vercel instructs:
     - Apex `revivostudios.io` → `A 76.76.21.21` (or Vercel's current apex IP / ALIAS).
     - `www` → `CNAME cname.vercel-dns.com`.
   - Wait for DNS propagation; Vercel auto-provisions TLS.

3. **Cut over from the old site** ⚠️
   - revivostudios.io currently serves Nelson's **old static HTML** (his separate
     deploy, tracking his branch — not this repo's `main`). Coordinate with Nelson to
     retire that deploy / release the domain so it points at this Vercel project.
     Otherwise you'll have two divergent sites or a DNS conflict.

4. **Activate the contact form** (one-time)
   - The form POSTs to `https://formsubmit.co/ajax/info@revivostudios.io`.
   - The **first** real submission triggers a confirmation email to that address —
     click the link once, or the form silently no-ops.

## Re-deploys

Pushes to `main` that touch `apps/marketing/**` auto-deploy once the project is connected.
No env vars or secrets are required.

## Pending assets (optional polish)

- `public/rijks.jpg` — About image (currently a licensed Unsplash Rijksmuseum shot). Swap for a custom photo anytime.
- `public/team-nelson.png`, `public/team-berend.png` — stylized placeholder avatars (DiceBear, CC0). Replace with real portraits when available.
- `public/og.png` — social share card (generated from the hero). Replace with a designed 1200×630 if desired.
