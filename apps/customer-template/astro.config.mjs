import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // `site` is overridden per-customer at build time via env var.
  site: process.env.REVIVO_SITE_URL || "https://example.revivo.nl",
  vite: {
    plugins: [tailwindcss()],
  },
});
