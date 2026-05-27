import OpenAI from "openai";
import { loadLLMSettings, type LLMSettings } from "./config";

/**
 * Provider-neutral completion interface. The mockup generator talks ONLY to
 * this — it never imports a provider SDK. Add a new provider by writing an
 * adapter that satisfies this interface and wiring it in `createLLMClient`.
 */
export interface LLMClient {
  readonly provider: string;
  readonly model: string;
  complete(opts: CompleteOptions): Promise<CompleteResult>;
}

export interface CompleteOptions {
  system: string;
  user: string;
  /** Hint the provider to return a JSON object (best-effort; we also parse defensively). */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface CompleteResult {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Adapter for any OpenAI-compatible endpoint. Covers BOTH OpenRouter and
 * OpenAI-direct — they share the wire format, differing only in base URL +
 * model slug (set via env). Native Anthropic (different wire format) would be
 * a separate adapter; not needed while we use Claude models through OpenRouter.
 */
class OpenAICompatibleClient implements LLMClient {
  readonly provider: string;
  readonly model: string;
  private sdk: OpenAI;

  constructor(settings: LLMSettings) {
    this.provider = settings.provider;
    this.model = settings.model;
    this.sdk = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseUrl,
      // OpenRouter asks for these for attribution; harmless on OpenAI-direct.
      defaultHeaders:
        settings.provider === "openrouter"
          ? { "HTTP-Referer": "https://revivo.nl", "X-Title": "revivo mockup generator" }
          : undefined,
    });
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const res = await this.sdk.chat.completions.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      response_format: opts.json ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    });

    const text = res.choices[0]?.message?.content ?? "";
    const usage = res.usage
      ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens }
      : undefined;
    return { text, usage };
  }
}

export function createLLMClient(settings: LLMSettings = loadLLMSettings()): LLMClient {
  switch (settings.provider) {
    case "openrouter":
    case "openai":
      return new OpenAICompatibleClient(settings);
    case "anthropic":
      throw new Error(
        "Native Anthropic adapter not built yet. Either use LLM_PROVIDER=openrouter with " +
          "LLM_MODEL=anthropic/claude-sonnet-4.5, or add adapters/anthropic.ts implementing LLMClient.",
      );
  }
}
