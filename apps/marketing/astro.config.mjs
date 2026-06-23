import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Revivo Studios marketing site — static, pure CSS (no Tailwind), real per-locale
// routes for SEO (nl at /, en at /en/). See src/i18n/ for the translation dicts.
export default defineConfig({
  site: "https://revivostudios.io",
  i18n: {
    defaultLocale: "nl",
    locales: ["nl", "en"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [sitemap()],
});
