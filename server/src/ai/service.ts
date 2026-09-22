import type { SupabaseClient } from "@supabase/supabase-js";
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
    /**
     * Persistent tier (ai_cache table). On Workers `cache` is per-isolate memory,
     * so without this every isolate regenerated every answer and the free
     * Gemini quota ran out (429s for all users). Null in tests / no-DB dev.
     */
    private db: SupabaseClient | null = null,
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
      const cached = (await this.cache.get<AiResult>(key)) ?? (await this.readDb(key));
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
      await this.writeDb(key, result, ttlFor(rendered.task));
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
  /** Best-effort persistent tier: a DB blip degrades to "generate again", never to an error. */
  private async readDb(key: string): Promise<AiResult | null> {
    if (!this.db) return null;
    const { data, error } = await this.db
      .from("ai_cache")
      .select("result, expires_at")
      .eq("key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) {
      this.logger.warn("ai.cache_read_failed", { message: error.message });
      return null;
    }
    if (!data) return null;
    const ttl = Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000);
    if (ttl > 0) await this.cache.set(key, data.result, ttl); // warm this isolate
    return data.result as AiResult;
  }

  private async writeDb(key: string, result: AiResult, ttlSeconds: number): Promise<void> {
    if (!this.db) return;
    const { error } = await this.db
      .from("ai_cache")
      .upsert({ key, result, expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString() });
    if (error) this.logger.warn("ai.cache_write_failed", { message: error.message });
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
