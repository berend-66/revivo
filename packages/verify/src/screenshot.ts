import { chromium, type Browser, type Page } from "playwright-core";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Full-page screenshots for the verification pass — playwright-core driving the
 * Chromium that's ALREADY cached under ~/Library/Caches/ms-playwright (resolved
 * below), so this never triggers a browser download. Two surfaces are shot: the
 * rendered mockup (our SSR app) and the salon's real Treatwell page (ground truth).
 */

export type Viewport = "desktop" | "mobile";

interface ViewportSpec {
  width: number;
  height: number;
  isMobile: boolean;
  ua: string;
}

const VIEWPORTS: Record<Viewport, ViewportSpec> = {
  desktop: {
    width: 1440,
    height: 900,
    isMobile: false,
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
  mobile: {
    width: 390,
    height: 844,
    isMobile: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
};

/**
 * Resolve a cached Chromium executable so playwright-core never downloads one.
 * Prefers the newest cached headless-shell build; `PLAYWRIGHT_EXECUTABLE_PATH`
 * overrides. Returns undefined (let playwright resolve) if nothing is cached.
 */
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
    // macOS arm64 layout; override via env on other platforms.
    const p = join(cache, d, "chrome-headless-shell-mac-arm64", "chrome-headless-shell");
    if (existsSync(p)) return p;
  }
  return undefined;
}

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser) return sharedBrowser;
  sharedBrowser = await chromium.launch({
    headless: true,
    executablePath: resolveExecutablePath(),
  });
  return sharedBrowser;
}

/** Close the shared browser. Call once at the end of a run (the bin does this). */
export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export interface ScreenshotOptions {
  viewport?: Viewport;
  /** Best-effort dismiss a cookie-consent overlay (Treatwell / OneTrust / CMP). */
  dismissConsent?: boolean;
  /** Hard cap for the initial navigation. */
  timeoutMs?: number;
}

export async function screenshot(url: string, opts: ScreenshotOptions = {}): Promise<Buffer> {
  const vp = VIEWPORTS[opts.viewport ?? "desktop"];
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    userAgent: vp.ua,
    // DPR 1 keeps full-page captures small enough for the vision API's payload cap
    // (a salon page is ~5000px tall; DPR 2 PNGs blew past the 30MB image limit).
    deviceScaleFactor: 1,
    isMobile: vp.isMobile,
    locale: "nl-NL",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  try {
    // domcontentloaded + a best-effort networkidle settle: chatty third-party
    // pages (Treatwell analytics) never reach a hard networkidle, so don't block on it.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts.timeoutMs ?? 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    if (opts.dismissConsent) await dismissConsent(page);

    await autoScroll(page);
    await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
    await page.waitForTimeout(400);

    // JPEG, not PNG: a photo-heavy full-page salon site is 5-10x smaller as JPEG,
    // keeping the base64 data URL well under the vision provider's per-image cap
    // while staying legible enough for the judge to read prices/team/rating.
    return await page.screenshot({ fullPage: true, type: "jpeg", quality: 82 });
  } finally {
    await context.close();
  }
}

/** Click a cookie-consent accept button if one is present. Best-effort, never throws. */
async function dismissConsent(page: Page): Promise<void> {
  const selectors = [
    "#onetrust-accept-btn-handler",
    'button:has-text("Alles accepteren")',
    'button:has-text("Accepteer alles")',
    'button:has-text("Alles toestaan")',
    'button:has-text("Accepteren")',
    'button:has-text("Accept all")',
    'button:has-text("I accept")',
    '[data-testid="cookie-banner-accept"]',
    '[aria-label*="accept" i]',
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1_200 })) {
        await el.click({ timeout: 1_200 });
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // try the next selector
    }
  }
}

/** Scroll to the bottom in steps to trigger lazy-loaded images, then back to top. */
async function autoScroll(page: Page): Promise<void> {
  await page
    .evaluate(async () => {
      await new Promise<void>((resolve) => {
        let total = 0;
        const step = 600;
        const maxScroll = 40_000; // safety cap against infinite-scroll pages
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          total += step;
          if (total >= document.body.scrollHeight || total > maxScroll) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    })
    .catch(() => {});
  await page.waitForTimeout(500);
}
