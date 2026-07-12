import Anthropic from "@anthropic-ai/sdk";
import type { AiCompletion, AiProvider, AiRequest } from "../types";
import { AiProviderError } from "../types";

/**
 * Claude via the official SDK (fetch-based — runs on Node and Workers).
 * Default model comes from env (claude-opus-4-8). Note for future readers:
 * Opus 4.7+ rejects temperature/top_p and budget_tokens — steer with the
 * prompt, control depth with output_config.effort if ever needed.
 */
export class ClaudeProvider implements AiProvider {
  readonly name = "claude";
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2 });
  }

  async complete(request: AiRequest): Promise<AiCompletion> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens,
        system: [
          {
            type: "text",
            text: request.system,
            // task system prompts are stable — let Anthropic cache the prefix
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: request.prompt }],
      });

      if (response.stop_reason === "refusal") {
        throw new AiProviderError(this.name, "The model declined this request.", false);
      }
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (!text) throw new AiProviderError(this.name, "Empty completion.", true);

      return {
        text,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      if (err instanceof Anthropic.RateLimitError) {
        throw new AiProviderError(this.name, "Rate limited upstream.", true);
      }
      if (err instanceof Anthropic.APIError) {
        throw new AiProviderError(this.name, `API error ${err.status}.`, (err.status ?? 500) >= 500);
      }
      throw new AiProviderError(this.name, "Connection failed.", true);
    }
  }
}
