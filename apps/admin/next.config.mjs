/** @type {import('next').NextConfig} */
const nextConfig = {
  // The @revivo/* workspace packages ship raw TypeScript (exports map → ./src/index.ts)
  // with extensionless relative imports. transpilePackages makes Next compile them
  // through its own pipeline — the Next analog of the mock app's
  // vite.ssr.noExternal:[/^@revivo\//] (see apps/mockups/astro.config.mjs).
  transpilePackages: ["@revivo/db", "@revivo/shared"],
};

export default nextConfig;
