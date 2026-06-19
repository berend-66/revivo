#!/usr/bin/env tsx
/**
 * shoot-variants — detail-preserving screenshots of the three variants for a
 * DESIGN critique (not the fact-check verify pass). Full-page shots of a ~6000px
 * salon page downscale to mush when an LLM reads them, so this also captures
 * viewport-height BANDS at DPR2 — crisp enough to judge type, spacing, colour.
 *
 *   pnpm -F @revivo/verify tsx bin/shoot-variants.ts --base utrecht-hairstyle
 *
 * Writes packages/verify/out/critique/<slug>-<viewport>-full.png and
 * <slug>-<viewport>-band-NN.png (gitignored).
 */
import { chromium, type Browser } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { serveMockups, type MockupServer } from "../src/index";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const LAYOUTS = ["atelier", "studio", "neon"] as const;

function resolveExecutablePath(): string | undefined {
  const override = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (override) return override;
  const cache = join(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(cache)) return undefined;
  const builds = readdirSync(cache)
    .filter((d) => d.startsWith("chromium_headless_shell-"))
    .map((d) => ({ d, n: Number(d.split("-")[1]) || 0 }))
    .sort((a, b) => b.n - a.n);
  for (const { d } of builds) {
    const p = join(cache, d, "chrome-headless-shell-mac-arm64", "chrome-headless-shell");
    if (existsSync(p)) return p;
  }
  return undefined;
}

const VIEWPORTS = {
  desktop: { width: 1440, bandH: 1000, isMobile: false },
  mobile: { width: 390, bandH: 844, isMobile: true },
} as const;

async function shoot(browser: Browser, url: string, outDir: string, slug: string, vp: keyof typeof VIEWPORTS) {
  const spec = VIEWPORTS[vp];
  const ctx = await browser.newContext({
    viewport: { width: spec.width, height: spec.bandH },
    deviceScaleFactor: 2,
    isMobile: spec.isMobile,
    locale: "nl-NL",
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    // Scroll through to trigger reveal-on-scroll + lazy images, then back to top.
    await page
      .evaluate(async () => {
        await new Promise<void>((res) => {
          let y = 0;
          const t = setInterval(() => {
            window.scrollBy(0, 700);
            y += 700;
            if (y >= document.body.scrollHeight || y > 40_000) {
              clearInterval(t);
              window.scrollTo(0, 0);
              res();
            }
          }, 80);
        });
      })
      .catch(() => {});
    await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
    await page.waitForTimeout(500);

    // Overview (full-page, DPR2 — big but kept for composition/flow).
    await page.screenshot({ path: join(outDir, `${slug}-${vp}-full.png`), fullPage: true });

    // Detail bands: scroll to each screenful and capture the viewport (clip can't
    // combine with fullPage, and a bare clip is limited to the current viewport).
    const H = await page.evaluate(() => document.body.scrollHeight);
    const n = Math.min(14, Math.ceil(H / spec.bandH));
    for (let i = 0; i < n; i++) {
      const y = i * spec.bandH;
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(160);
      await page.screenshot({
        path: join(outDir, `${slug}-${vp}-band-${String(i).padStart(2, "0")}.png`),
      });
    }
    console.log(`  ${slug} ${vp}: full + ${n} bands (page ${H}px)`);
  } finally {
    await ctx.close();
  }
}

(async () => {
  const argv = process.argv.slice(2);
  let base = "utrecht-hairstyle";
  let port = 4401;
  let serverUrl: string | null = null; // reuse an already-running server if given
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") base = argv[++i];
    else if (argv[i] === "--port") port = Number(argv[++i]);
    else if (argv[i] === "--server-url") serverUrl = argv[++i].replace(/\/$/, "");
  }
  const outDir = resolve(REPO_ROOT, "packages/verify/out/critique");
  mkdirSync(outDir, { recursive: true });

  let server: MockupServer | null = null;
  let browser: Browser | null = null;
  try {
    let urlFor: (slug: string) => string;
    if (serverUrl) {
      console.log(`Using running server at ${serverUrl}`);
      urlFor = (slug) => `${serverUrl}/${slug}`;
    } else {
      console.log(`Serving apps/mockups on :${port} …`);
      server = await serveMockups({ port, repoRoot: REPO_ROOT });
      urlFor = (slug) => server!.url(slug);
    }
    browser = await chromium.launch({ headless: true, executablePath: resolveExecutablePath() });
    for (const layout of LAYOUTS) {
      const slug = `${base}-${layout}`;
      console.log(`[${layout}] ${slug}`);
      for (const vp of ["desktop", "mobile"] as const) {
        await shoot(browser, urlFor(slug), outDir, slug, vp);
      }
    }
    console.log(`\nWrote screenshots → ${outDir}`);
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
})().catch((err) => {
  console.error(`shoot-variants failed: ${err.message}`);
  process.exit(1);
});
