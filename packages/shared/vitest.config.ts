import { defineConfig } from "vitest/config";

// Pure unit tests over the shared contracts and helpers — no network, no env.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
