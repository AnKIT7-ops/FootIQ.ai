/**
 * AI provider abstraction. Every provider — Claude, OpenAI, Gemini, local
 * Ollama, the test mock — implements this one interface, so provider choice
 * is an env var, not a code change. Prompts are NOT defined here (see
 * ai/prompts): providers know how to talk to an API, never what to say.
 */

export interface AiRequest {
  /** Instructions / persona. Kept stable per task for provider-side caching. */
  system: string;
  /** The user-turn content, fully rendered by the prompt registry. */
  prompt: string;
  maxTokens: number;
}

export interface AiCompletion {
  text: string;
  model: string;
  /** Approximate token usage when the provider reports it. */
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AiProvider {
  readonly name: string;
  complete(request: AiRequest): Promise<AiCompletion>;
}

/** Thrown by providers on upstream failure; the service maps it to 502. */
export class AiProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public retryable: boolean,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "AiProviderError";
  }
}
