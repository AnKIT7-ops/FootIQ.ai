import type { AiCompletion, AiProvider, AiRequest } from "../types";
import { AiProviderError } from "../types";

/** OpenAI chat completions via raw fetch — no SDK dependency needed for one call shape. */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";

  constructor(
    private apiKey: string,
    private model: string,
    // wrapped: calling a stored bare `fetch` as `this.fetchImpl()` rebinds `this`
    // to the class instance — Workers rejects that with "Illegal invocation"
    private fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async complete(request: AiRequest): Promise<AiCompletion> {
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          max_completion_tokens: request.maxTokens,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      // See gemini.ts — same class of bug: don't discard the fetch failure's
      // real cause, it's the only thing that tells key/model/network apart.
      const cause = err instanceof Error ? err.message : String(err);
      throw new AiProviderError(this.name, `Connection failed: ${cause}`, true);
    }
    if (!res.ok) {
      throw new AiProviderError(this.name, `API error ${res.status}.`, res.status === 429 || res.status >= 500);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AiProviderError(this.name, "Empty completion.", true);
    return {
      text,
      model: this.model,
      usage: body.usage
        ? { inputTokens: body.usage.prompt_tokens, outputTokens: body.usage.completion_tokens }
        : undefined,
    };
  }
}
