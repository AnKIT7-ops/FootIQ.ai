import type { AiCompletion, AiProvider, AiRequest } from "../types";
import { AiProviderError } from "../types";

/** Google Gemini generateContent via REST. */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";

  constructor(
    private apiKey: string,
    private model: string,
    // wrapped: calling a stored bare `fetch` as `this.fetchImpl()` rebinds `this`
    // to the class instance — Workers rejects that with "Illegal invocation"
    private fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async complete(request: AiRequest): Promise<AiCompletion> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: {
            maxOutputTokens: request.maxTokens,
            /**
             * Gemini 3.x thinks by default and its thinking tokens are spent from
             * maxOutputTokens. That silently ate the answer: fixture previews
             * stopped mid-sentence ("…against an") and the 200-token scout
             * parse returned nothing at all. These are short, grounded,
             * format-constrained tasks — no reasoning budget needed.
             */
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      // Server-log only (app.ts's error handler never forwards `internal` to
      // the client) — without the cause, "Connection failed." is the same
      // message whether the key is wrong, the model id is wrong, or the
      // network genuinely stalled, and those need different fixes.
      const cause = err instanceof Error ? err.message : String(err);
      throw new AiProviderError(this.name, `Connection failed: ${cause}`, true);
    }
    if (!res.ok) {
      // Server-log only (never forwarded). A bare "429" can't tell a per-minute
      // burst from an exhausted daily quota or a model with no free tier.
      const detail = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 1000);
      throw new AiProviderError(this.name, `API error ${res.status}: ${detail}`, res.status === 429 || res.status >= 500);
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) {
      // finishReason names the cause: MAX_TOKENS (budget gone), SAFETY, RECITATION…
      throw new AiProviderError(this.name, `Empty completion (finishReason: ${candidate?.finishReason ?? "unknown"}).`, true);
    }
    // A truncated answer is a bug, not a result: it would be cached and served
    // to every viewer mid-sentence. Fail loudly so the budget gets raised.
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new AiProviderError(this.name, `Truncated at maxOutputTokens (${request.maxTokens}).`, false);
    }
    return {
      text,
      model: this.model,
      usage: {
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
