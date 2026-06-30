# Deploying the Revivo Studios marketing site (revivostudios.io)

The site is a **static Astro** app (no server, no env vars). Output: `dist/`.
NL is served at `/`, EN at `/en/`. `vercel.json` here pins the framework/build/output.

**Images always ship.** Everything in `apps/marketing/public/` (`rijks.jpg`, the
two `team-*.png` avatars, `og.png`, `favicon.svg`) is copied verbatim into `dist/`
by `astro build`, and Vercel serves `dist/`. So as long as a file is committed,
it's in the deploy — verified by a clean build (all references resolve to a real
`dist/` file). The old revivostudios.io broken image was a *different* deploy that
referenced `/rijks.png` while never including the file; this build cannot have that
gap. Step 5 below is the post-deploy check that confirms it.

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

3. **Cut over from the old site** ✅ done (Nelson)
   - Nelson's Vercel project (`revivostudios` · `prj_IkKU2L3o5mmiAdckJbNYbvPgHtSo`,
     team `nvandommele-timelessnls-projects`) has been reconfigured:
     - Root Directory set to `apps/marketing` via Vercel API.
     - Production deployment rebuilt from `main` — new Astro build with all images.
       Confirmed: `/rijks.jpg`, `/og.png`, `/team-*.png` all return `200` on the
       deployment alias.
   - **If the domain still shows the old HTML:** Vercel's team plan is **Hobby** —
     adding Berend as a member is blocked. To take over serving:
     1. Berend creates his own Vercel project → import `berend-66/revivo` →
        Root Directory: `apps/marketing`.
     2. Berend adds `revivostudios.io` to his project in Vercel Dashboard.
     3. Nelson removes `revivostudios.io` from `prj_IkKU2L3o5mmiAdckJbNYbvPgHtSo`
        (Vercel Dashboard → Settings → Domains → Remove).
     4. DNS propagates (minutes). Berend's project takes over.

4. **Activate the contact form** (one-time)
   - The form POSTs to `https://formsubmit.co/ajax/info@revivostudios.io`.
   - The **first** real submission triggers a confirmation email to that address —
     click the link once, or the form silently no-ops.

5. **Verify after deploy — including the images** ✅
   Run against the deployed URL (the `*.vercel.app` preview first, then the live
   domain after cutover). Every line must be `200`:
   ```bash
   BASE=https://<your-deploy>           # e.g. revivo-marketing.vercel.app, then revivostudios.io
   for p in / /en/ /rijks.jpg /team-nelson.png /team-berend.png /og.png /favicon.svg; do
     curl -s -o /dev/null -w "%{http_code}  $p\n" "$BASE$p"
   done
   ```
   A `404` on any image means that asset isn't in the deploy — do **not** consider
   the deploy done until all are `200`. Also open the page and confirm the About
   photo and both founder avatars actually render.

## Re-deploys

Pushes to `main` that touch `apps/marketing/**` auto-deploy once the project is connected.
No env vars or secrets are required.

## Site assets (all committed + shipping — swap anytime)

These are real and deploy with the site today; replacing them is a drop-in (same filename):

- `public/rijks.jpg` — About image. Licensed **Unsplash** Rijksmuseum (reflecting-pond) photo — free for commercial use, no attribution required. Swap for a custom photo anytime.
- `public/team-nelson.png`, `public/team-berend.png` — stylized **avataaars** founder avatars (free for commercial use). Replace with real portraits when available.
- `public/og.png` — social share card (1200×630, generated from the hero). Replace with a designed one if desired.
