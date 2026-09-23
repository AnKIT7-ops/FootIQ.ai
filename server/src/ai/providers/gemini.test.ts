import { describe, expect, it } from "vitest";
import { GeminiProvider } from "./gemini";
import { AiProviderError } from "../types";

const reply = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const completion = (text: string, finishReason = "STOP") => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
});

const request = { system: "s", prompt: "p", maxTokens: 500 };

describe("GeminiProvider", () => {
  it("disables thinking — its tokens come out of maxOutputTokens and truncated the answer", async () => {
    let sent: Record<string, unknown> = {};
    const capture = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify(completion("ok")));
    }) as unknown as typeof fetch;

    const result = await new GeminiProvider("k", "gemini-3.8-flash", capture).complete(request);
    expect((sent.generationConfig as { thinkingConfig: unknown }).thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
  });

  it("rejects a MAX_TOKENS answer instead of caching half a sentence", async () => {
    const provider = new GeminiProvider("k", "m", reply(completion("Dortmund are favourites against an", "MAX_TOKENS")));
    await expect(provider.complete(request)).rejects.toThrow(/Truncated at maxOutputTokens/);
  });

  it("names the finishReason when nothing came back", async () => {
    const provider = new GeminiProvider("k", "m", reply({ candidates: [{ finishReason: "SAFETY" }] }));
    await expect(provider.complete(request)).rejects.toThrow(/finishReason: SAFETY/);
  });

  it("keeps the upstream error body (which quota was hit) and marks 429 retryable", async () => {
    const provider = new GeminiProvider("k", "m", reply({ error: { code: 429, message: "Quota exceeded for quota metric X" } }, 429));
    await expect(provider.complete(request)).rejects.toMatchObject({
      retryable: true,
      message: expect.stringContaining("Quota exceeded for quota metric X"),
    });
    await expect(provider.complete(request)).rejects.toBeInstanceOf(AiProviderError);
  });
});
