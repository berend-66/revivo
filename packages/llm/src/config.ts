/**
 * LLM provider configuration — the single place env vars become settings.
 *
 * The whole point: switching provider (OpenRouter ↔ OpenAI ↔ native Anthropic)
 * is an env change, never a code change. Generator code depends on the
 * `LLMClient` interface only, never on a provider.
 */

export type Provider = "openrouter" | "openai" | "anthropic";

export interface LLMSettings {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_BASE_URL: Record<Provider, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
  // Native Anthropic uses a different wire format (see adapters/) — base URL
  // is here for completeness but the openai-compatible adapter won't use it.
  anthropic: "https://api.anthropic.com/v1",
};

const DEFAULT_MODEL: Record<Provider, string> = {
  openrouter: "anthropic/claude-sonnet-4.5",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-6",
};

export function loadLLMSettings(env: NodeJS.ProcessEnv = process.env): LLMSettings {
  const provider = (env.LLM_PROVIDER ?? "openrouter") as Provider;
  if (!["openrouter", "openai", "anthropic"].includes(provider)) {
    throw new Error(`Unknown LLM_PROVIDER "${provider}". Use: openrouter | openai | anthropic`);
  }

  const apiKey = env.LLM_API_KEY ?? env.OPENROUTER_API_KEY ?? env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "No API key. Set LLM_API_KEY in .env (or OPENROUTER_API_KEY / OPENAI_API_KEY).",
    );
  }

  return {
    provider,
    apiKey,
    baseUrl: env.LLM_BASE_URL ?? DEFAULT_BASE_URL[provider],
    model: env.LLM_MODEL ?? DEFAULT_MODEL[provider],
  };
}
