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
          generationConfig: { maxOutputTokens: request.maxTokens },
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new AiProviderError(this.name, "Connection failed.", true);
    }
    if (!res.ok) {
      throw new AiProviderError(this.name, `API error ${res.status}.`, res.status === 429 || res.status >= 500);
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new AiProviderError(this.name, "Empty completion.", true);
    return { text, model: this.model };
  }
}
