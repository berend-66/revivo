import { defineConfig } from "vitest/config";

// Sourcing tests are pure unit tests against committed HTML fixtures — no
// network, no API keys, no browser. Node environment is all they need.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
