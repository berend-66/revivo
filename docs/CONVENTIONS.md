# Conventions

Patterns and tool-specific gotchas that save future-you from repeated stumbles.

## Workspaces (pnpm)

- Apps live under `apps/*`, shared libraries under `packages/*`.
- Workspace name pattern: `@revivo/<dir-name>` (e.g. `@revivo/marketing`).
- Reference workspaces in deps as `"@revivo/foo": "workspace:*"`.
- `pnpm-workspace.yaml` lists the glob and an `allowBuilds:` allowlist for postinstall scripts (`esbuild`, `sharp` are approved — add others case-by-case).

Run a single workspace's script with `-F`:
```bash
pnpm -F @revivo/marketing dev
pnpm -F @revivo/customer-template build
```

## TypeScript

- All workspaces extend `tsconfig.base.json` (strict, ES2022, bundler module resolution, `noUncheckedIndexedAccess`).
- App-level `tsconfig.json` adds `paths: { "~/*": ["src/*"] }` — always import internal modules via `~/*`, never relative `../../../`.
- Type-only imports: prefer `import type { Foo } from "..."` for clarity.

## Astro

- **Single page per variant.** Each variant has one entry `Layout.astro` that includes head + body + section components.
- **Section components** live under `src/variants/<variant>/sections/*.astro`. Each takes `{ config: SiteConfig }` as the only prop.
- **No client-side JS by default.** Astro ships zero JS. If you reach for `<script>` or `client:*` directives, justify it — most things should be static or CSS-only.
- **Astro frontmatter (`---` block at top of `.astro` file)** runs at build time. Use it for data fetching, imports, and computed values. Don't put heavy work in templates.
- Image paths: use absolute URLs from config, or `/path` for static assets in `public/`. Do not use Astro's `<Image>` component until you've decided on a real image source (Insta vs Unsplash vs uploaded).

## Tailwind v4 (CSS-first)

This repo uses Tailwind v4, **not** v3. Differences that bite:

- **No `tailwind.config.js`.** Theme tokens are declared in CSS via `@theme`. Example pattern in `apps/marketing/src/styles/global.css` and the per-variant stylesheets in `apps/customer-template/src/styles/`.
- **Token names generate utilities automatically.** `--color-burgundy-900: #3d0c0c` → `bg-burgundy-900`, `text-burgundy-900`, `border-burgundy-900` etc.
- **`@utility name { ... }` defines a custom utility class.** Selectors can be nested with `&`, but the whole block **cannot be nested inside `@media`**. For responsive utilities, define a plain `.class` and use `@media` around it (see `section-pad` in `apps/customer-template/src/styles/atelier.css`).
- **Plugin loaded via Vite plugin**: `@tailwindcss/vite` registered in `astro.config.mjs`, not as a PostCSS plugin.

## CSS architecture

- Each customer-template variant has its own `src/styles/<variant>.css` imported only by that variant's `Layout.astro`. **Don't share variants' CSS.** The whole point is independent design DNA.
- Brand colors come from `config.brand.colors.*` and are injected as inline CSS variables on `<html style="...">`. Variant CSS reads those via `var(--brand-primary, fallback)`.
- Marketing site brand tokens are baked into `apps/marketing/src/styles/global.css` — they are the *revivo* brand, not a customer brand.

## Component file headers

When a component has non-obvious purpose or non-trivial design intent, put one short comment block at the top explaining the *why*. Example:

```astro
---
/**
 * Decorative outlined circles inspired by the proposal PDF.
 * Used as background flourishes inside burgundy sections.
 */
---
```

Don't write multi-paragraph docstrings, JSDoc tags, or rationale that's already obvious from the code.

## Naming

- Files: kebab-case (`site-config.ts`, `load-config.ts`).
- Astro components: PascalCase (`Hero.astro`, `LocationHours.astro`).
- Types: PascalCase (`SiteConfig`, `ServiceCategory`).
- Schema constants: `<Name>Schema` (`SiteConfigSchema`).
- Workspace package names: `@revivo/<dir>`.
- JSON example configs: `<slug>.json` matching `config.slug`.

## Git

- Commit subject ≤72 chars, present tense, low-noise. Use a body for the why.
- One commit per shippable chunk; don't batch unrelated work.
- Co-author trailer for Claude: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` (when Claude wrote the code).
- Never `--no-verify`, never force-push to `main`.

## Things to never do

- Don't introduce a new package manager or build tool without checking [ARCHITECTURE.md](ARCHITECTURE.md).
- Don't add `tailwind.config.js` — v4 doesn't use it.
- Don't share CSS across customer-template variants.
- Don't put response code or framework guarantees behind defensive checks (`if (typeof window !== "undefined")`, `try/catch` around safe operations). Trust the contract.
- Don't add comments restating *what* the code does. Only the *why* if non-obvious.
- Don't generate URLs for the user — only use ones they (or this docs) gave you.
- Don't add backwards-compat shims or "deprecated" exports for code that has zero callers. Just delete.
