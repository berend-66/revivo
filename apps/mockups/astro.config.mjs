import { defineConfig } from "astro/config";
import node from "@astrojs/node";
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
  adapter: node({ mode: "standalone" }),
  site: process.env.REVIVO_MOCK_BASE_URL || "https://mock.revivo.nl",
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { "~": customerTemplateSrc },
    },
  },
});
