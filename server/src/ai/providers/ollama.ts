import type { AiCompletion, AiProvider, AiRequest } from "../types";
import { AiProviderError } from "../types";

/** Local LLM via Ollama's /api/chat — for offline dev and zero-cost experiments. */
export class OllamaProvider implements AiProvider {
  readonly name = "ollama";

  constructor(
    private baseUrl: string,
    private model: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(request: AiRequest): Promise<AiCompletion> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          options: { num_predict: request.maxTokens },
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new AiProviderError(this.name, "Ollama unreachable.", true);
    }
    if (!res.ok) throw new AiProviderError(this.name, `API error ${res.status}.`, true);
    const body = (await res.json()) as { message?: { content?: string } };
    const text = body.message?.content?.trim();
    if (!text) throw new AiProviderError(this.name, "Empty completion.", true);
    return { text, model: this.model };
  }
}
