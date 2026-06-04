import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// The mock app does not own the variant components — it reuses the SINGLE source
// of them in the customer-template. Point `~` at customer-template/src so the
// variant Layouts (which import `~/styles/...` and `~/variants/...`) resolve
// exactly as they do in their home app. The mock app's own files use relative
// imports. (Tailwind still finds the variant utilities because each variant CSS
// self-declares its `@source` — see apps/customer-template/src/styles/*.css.)
const customerTemplateSrc = fileURLToPath(new URL("../customer-template/src", import.meta.url));

export default defineConfig({
  output: "server",
  // Vercel serverless adapter. Mockups are SSR (read Supabase per request) and
  // edge-cached via `Cache-Control: s-maxage` (see src/lib/render.ts). The custom
  // domain mock.revivo.nl is attached post-deploy; until then the *.vercel.app URL
  // serves. `site` falls back to that URL via REVIVO_MOCK_BASE_URL when set.
  adapter: vercel(),
  site: process.env.REVIVO_MOCK_BASE_URL || "https://mock.revivo.nl",
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { "~": customerTemplateSrc },
    },
    // The @revivo/* workspace packages ship raw TypeScript (exports map points at
    // ./src/index.ts) with extensionless relative imports. Under `output: "server"`
    // Astro's node adapter externalizes them, and Node's ESM resolver then can't
    // load `./site-config` (no extension, no transpile). Force Vite to inline +
    // transpile them through its own pipeline instead.
    ssr: {
      noExternal: [/^@revivo\//],
    },
  },
});
