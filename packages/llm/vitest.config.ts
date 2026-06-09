import { defineConfig } from "vitest/config";

// LLM-package tests are pure unit tests: a queue-based fake LLMClient, a
// stubbed global fetch over sourcing's committed HTML fixture — no network,
// no API keys, no token spend.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
