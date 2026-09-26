import { describe, expect, it } from "vitest";
import { GeminiProvider, thinkingOff } from "./gemini";
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
    expect((sent.generationConfig as { thinkingConfig: unknown }).thinkingConfig).toEqual({ thinkingLevel: "minimal" });
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
  });

  it("speaks each generation's thinking dialect — Gemini 3 Flash-Lite 400s on a zero budget", () => {
    expect(thinkingOff("gemini-3.5-flash-lite")).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingOff("gemini-3.1-flash-lite")).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingOff("gemini-2.5-flash-lite")).toEqual({ thinkingBudget: 0 });
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

  it("falls through the model list on a quota 429 — free-tier quotas are per model", async () => {
    const tried: string[] = [];
    const perModel = (async (url: string) => {
      const model = url.match(/models\/([^:]+):/)![1];
      tried.push(model);
      return model === "lite-b"
        ? new Response(JSON.stringify(completion("answer")))
        : new Response(JSON.stringify({ error: { code: 429, message: "quota" } }), { status: 429 });
    }) as unknown as typeof fetch;

    const result = await new GeminiProvider("k", "lite-a, lite-b, flash", perModel).complete(request);
    expect(tried).toEqual(["lite-a", "lite-b"]);
    expect(result.model).toBe("lite-b");
  });

  it("does not fall through on non-quota errors (a bad key is bad for every model)", async () => {
    const tried: string[] = [];
    const denied = (async (url: string) => {
      tried.push(url);
      return new Response("{}", { status: 403 });
    }) as unknown as typeof fetch;
    await expect(new GeminiProvider("k", "a,b", denied).complete(request)).rejects.toThrow(/API error 403/);
    expect(tried).toHaveLength(1);
  });
});
