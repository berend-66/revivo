#!/usr/bin/env tsx
/**
 * measure-contrast — WCAG measurement of the studio/neon palette-robustness
 * tokens (the chroma/lightness floors written in oklch(from …)). It renders the
 * EXACT token expressions in a real Chromium, reads the computed colors, canvas-
 * normalizes them to sRGB (Chromium serializes oklch sources as oklab/oklch, so
 * we rasterize to get real sRGB), and computes WCAG ratios — against the real
 * Utrecht palette AND synthetic light / dark / pale palettes, since brand colors
 * arrive arbitrary. No app server needed (blank page + injected styles).
 *
 *   pnpm -F @revivo/verify exec tsx bin/measure-contrast.ts
 */
import { chromium } from "playwright-core";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function resolveExecutablePath(): string | undefined {
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

// Token expressions copied VERBATIM from the @supports blocks of neon.css /
// studio.css. (Kept in sync by hand; this is a spot measurement.)
const NEON_TOKENS = {
  "primary-vivid": "oklch(from var(--brand-primary) clamp(0.5, l, 0.62) max(c, 0.16) h)",
  "primary-fill": "oklch(from var(--brand-primary) clamp(0.36, l, 0.48) max(c, 0.16) h)",
  "primary-deep": "oklch(from var(--brand-primary) clamp(0.2, l, 0.32) max(c, 0.07) h)",
  "primary-on-ink": "oklch(from var(--brand-primary) max(l, 0.74) max(c, 0.15) h)",
  "primary-on-light": "oklch(from var(--brand-primary) min(l, 0.5) max(c, 0.15) h)",
  "accent-vivid": "oklch(from var(--brand-accent) clamp(0.58, l, 0.82) max(c, 0.2) h)",
  "accent-on-light": "oklch(from var(--brand-accent) min(l, 0.5) max(c, 0.19) h)",
  "on-primary": "oklch(from var(--brand-primary) 0.98 0.02 h)",
};
const STUDIO_TOKENS = {
  accent: "oklch(from var(--brand-accent) clamp(0.4, l, 0.5) max(c, 0.19) h)",
  "accent-on-light": "oklch(from var(--brand-accent) min(l, 0.5) max(c, 0.19) h)",
  "accent-on-ink": "oklch(from var(--brand-accent) max(l, 0.7) max(c, 0.17) h)",
};

// [label, foreground-token-or-literal, background-token-or-literal, AA target]
// "T:" = a token from the variant set; "#…"/"white" = literal.
type Probe = [string, string, string, number];
const NEON_PROBES: Probe[] = [
  ["pill/CTA/nav fill (white small text)", "T:on-primary", "T:primary-fill", 4.5],
  ["marquee/avatar (white large text)", "T:on-primary", "T:primary-vivid", 3.0],
  ["price/hero word (vivid large on paper)", "T:primary-vivid", "#FAF8F6", 3.0],
  ["Visit/footer ground (white text + dimmed eyebrow)", "white", "T:primary-deep", 4.5],
  ["hero rating (primary text on paper)", "T:primary-on-light", "#FAF8F6", 4.5],
  ["footer wordmark (primary on ink)", "T:primary-on-ink", "#0a0a0a", 4.5],
  ["section eyebrow (accent text on paper)", "T:accent-on-light", "#FAF8F6", 4.5],
];
const STUDIO_PROBES: Probe[] = [
  ["hover pill (surface text on accent)", "#FAFAF7", "T:accent", 4.5],
  ["section number (accent on surface)", "T:accent-on-light", "#FAFAF7", 4.5],
  ["Booking 'Boek' (accent on ink)", "T:accent-on-ink", "#0a0a0a", 4.5],
];

const PALETTES: { name: string; primary: string; accent: string; surface: string }[] = [
  { name: "Utrecht (muted brown)", primary: "#8B6F47", accent: "#C17A3F", surface: "#FAF8F6" },
  { name: "saturated (neon default)", primary: "#0028FF", accent: "#FFE600", surface: "#F5F1EA" },
  { name: "pale/light primary+accent", primary: "#F2C14E", accent: "#EADDC8", surface: "#FFFFFF" },
  { name: "dark/near-black primary+accent", primary: "#1A1A2E", accent: "#2C2620", surface: "#FAFAF7" },
  { name: "vivid pink", primary: "#E84393", accent: "#00CEC9", surface: "#FFF5FA" },
];

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function lum([r, g, b]: number[]): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function ratio(a: number[], b: number[]): number {
  const la = lum(a),
    lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: resolveExecutablePath() });
  const page = await browser.newPage();
  await page.setContent("<html><body></body></html>");

  // Resolve a token/literal to sRGB [r,g,b] under a given palette.
  async function toRGB(palette: (typeof PALETTES)[number], tokens: Record<string, string>, expr: string): Promise<number[]> {
    const literal = expr.startsWith("T:") ? `var(--x)` : expr;
    const tokenExpr = expr.startsWith("T:") ? tokens[expr.slice(2)] : null;
    return page.evaluate(
      ({ primary, accent, literal, tokenExpr }) => {
        const probe = document.createElement("span");
        probe.style.setProperty("--brand-primary", primary);
        probe.style.setProperty("--brand-accent", accent);
        if (tokenExpr) probe.style.setProperty("--x", tokenExpr);
        probe.style.color = literal;
        document.body.appendChild(probe);
        const computed = getComputedStyle(probe).color;
        probe.remove();
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#000";
        ctx.fillStyle = computed; // browser rasterizes oklch/oklab → sRGB
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      },
      { primary: palette.primary, accent: palette.accent, literal, tokenExpr },
    );
  }

  let worstAA = Infinity;
  const fails: string[] = [];
  for (const variant of [
    { name: "neon", tokens: NEON_TOKENS, probes: NEON_PROBES },
    { name: "studio", tokens: STUDIO_TOKENS, probes: STUDIO_PROBES },
  ]) {
    console.log(`\n████ ${variant.name.toUpperCase()} ████`);
    for (const palette of PALETTES) {
      console.log(`\n  ${palette.name}  (primary ${palette.primary} / accent ${palette.accent})`);
      for (const [label, fgExpr, bgExpr, target] of variant.probes) {
        const fg = await toRGB(palette, variant.tokens, fgExpr);
        const bg = await toRGB(palette, variant.tokens, bgExpr);
        const r = ratio(fg, bg);
        const ok = r >= target;
        if (!ok) fails.push(`${variant.name} · ${palette.name} · ${label}: ${r.toFixed(2)} < ${target}`);
        worstAA = Math.min(worstAA, r / target); // normalized headroom
        console.log(
          `    ${ok ? "✓" : "✗"} ${label.padEnd(38)} ${r.toFixed(2)}:1  (target ${target})  fg=${fg.join(",")} bg=${bg.join(",")}`,
        );
      }
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  if (fails.length) {
    console.log(`✗ ${fails.length} contrast FAILURE(S):`);
    fails.forEach((f) => console.log(`   - ${f}`));
  } else {
    console.log(`✓ all probes pass their WCAG target across every test palette.`);
  }
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
