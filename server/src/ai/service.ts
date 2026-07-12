import type { Env } from "../config/env";
import type { CacheStore } from "../cache/types";
import { cacheKeys, TTL } from "../cache/types";
import type { Logger } from "../lib/logger";
import { ApiError } from "../lib/errors";
import type { AiResult, AiTask } from "../../../shared/contracts";
import type { AiProvider } from "./types";
import { AiProviderError } from "./types";
import type { RenderedPrompt } from "./prompts";
import { ClaudeProvider } from "./providers/claude";
import { OpenAiProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";
import { OllamaProvider } from "./providers/ollama";
import { MockAiProvider } from "./providers/mock";

/**
 * AiService = provider selection + response caching + failure mapping.
 * Callers hand it a RenderedPrompt from the registry; they never talk to a
 * provider directly. Cache-first is the cost story: a scout report for the
 * same player is generated once a day, not once per viewer.
 */
export class AiService {
  constructor(
    private provider: AiProvider,
    private cache: CacheStore,
    private logger: Logger,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  async run(rendered: RenderedPrompt, opts?: { bypassCache?: boolean }): Promise<AiResult> {
    const key = cacheKeys.ai(
      rendered.task,
      `${rendered.version}:${this.provider.name}:${await sha1(rendered.cacheSeed)}`,
    );

    if (!opts?.bypassCache) {
      const cached = await this.cache.get<AiResult>(key);
      if (cached) return { ...cached, cached: true };
    }

    const started = Date.now();
    try {
      const completion = await this.provider.complete({
        system: rendered.system,
        prompt: rendered.prompt,
        maxTokens: rendered.maxTokens,
      });
      const result: AiResult = {
        task: rendered.task,
        text: completion.text,
        provider: this.provider.name,
        model: completion.model,
        cached: false,
        generatedAt: new Date().toISOString(),
      };
      this.logger.info("ai.completion", {
        task: rendered.task,
        provider: this.provider.name,
        ms: Date.now() - started,
        inputTokens: completion.usage?.inputTokens,
        outputTokens: completion.usage?.outputTokens,
      });
      await this.cache.set(key, result, ttlFor(rendered.task));
      return result;
    } catch (err) {
      if (err instanceof AiProviderError) {
        this.logger.warn("ai.provider_error", {
          task: rendered.task,
          provider: err.provider,
          retryable: err.retryable,
          message: err.message,
        });
        throw new ApiError("upstream_error", "The AI engine is unavailable right now. Try again shortly.", {
          internal: err,
        });
      }
      throw err;
    }
  }
}

function ttlFor(task: AiTask): number {
  switch (task) {
    case "scout_report":
    case "player_comparison":
      return TTL.aiScout;
    case "news_summary":
      return TTL.aiSummary;
    default:
      return TTL.aiGeneric;
  }
}

async function sha1(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Env-driven provider selection; falls back to the mock (never crashes boot). */
export function createAiProvider(env: Env, logger: Logger): AiProvider {
  const wanted = env.AI_PROVIDER;
  if (wanted === "claude" && env.ANTHROPIC_API_KEY) {
    return new ClaudeProvider(env.ANTHROPIC_API_KEY, env.AI_MODEL);
  }
  if (wanted === "openai" && env.OPENAI_API_KEY) {
    return new OpenAiProvider(env.OPENAI_API_KEY, env.AI_MODEL);
  }
  if (wanted === "gemini" && env.GEMINI_API_KEY) {
    return new GeminiProvider(env.GEMINI_API_KEY, env.AI_MODEL);
  }
  if (wanted === "ollama" && env.OLLAMA_BASE_URL) {
    return new OllamaProvider(env.OLLAMA_BASE_URL, env.AI_MODEL);
  }
  if (wanted !== "mock") {
    logger.warn("ai.provider_fallback", {
      wanted,
      reason: "missing API key/config — using mock provider",
    });
  }
  return new MockAiProvider();
}
