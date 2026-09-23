import { describe, expect, it } from "vitest";
import { AiService } from "./service";
import { MockAiProvider } from "./providers/mock";
import { AiProviderError, type AiProvider } from "./types";
import { MemoryCache } from "../cache/memory";
import { createLogger } from "../lib/logger";
import { prompts } from "./prompts";
import { samplePlayers as players } from "../test-fixtures";

const logger = createLogger("error");

describe("AiService", () => {
  it("runs a prompt through the provider and reports metadata", async () => {
    const provider = new MockAiProvider();
    const service = new AiService(provider, new MemoryCache(), logger);
    const result = await service.run(prompts.scout_report(players[0], null));

    expect(result.task).toBe("scout_report");
    expect(result.provider).toBe("mock");
    expect(result.cached).toBe(false);
    expect(result.text.length).toBeGreaterThan(50);
    // player data actually reached the provider
    expect(provider.calls[0].prompt).toContain(players[0].name);
  });

  it("serves the second identical request from cache (cost control)", async () => {
    const provider = new MockAiProvider();
    const service = new AiService(provider, new MemoryCache(), logger);
    const first = await service.run(prompts.scout_report(players[0], null));
    const second = await service.run(prompts.scout_report(players[0], null));

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(provider.calls.length).toBe(1); // one upstream call, two responses
  });

  it("different inputs do not collide in the cache", async () => {
    const provider = new MockAiProvider();
    const service = new AiService(provider, new MemoryCache(), logger);
    await service.run(prompts.scout_report(players[0], null));
    const other = await service.run(prompts.scout_report(players[1], null));
    expect(other.cached).toBe(false);
    expect(provider.calls.length).toBe(2);
  });

  it("a second isolate (empty memory cache) is served from the persistent tier", async () => {
    // Workers isolates don't share memory; this is what burned the Gemini quota.
    const rows = new Map<string, { result: unknown; expires_at: string }>();
    const db = {
      from: () => ({
        upsert: async (row: { key: string; result: unknown; expires_at: string }) => {
          rows.set(row.key, row);
          return { error: null };
        },
        select: () => {
          let key = "";
          const q = {
            eq: (_c: string, v: string) => ((key = v), q),
            gt: () => q,
            maybeSingle: async () => ({ data: rows.get(key) ?? null, error: null }),
          };
          return q;
        },
      }),
    } as unknown as ConstructorParameters<typeof AiService>[3];

    const provider = new MockAiProvider();
    await new AiService(provider, new MemoryCache(), logger, db).run(prompts.scout_report(players[0], null));
    const second = await new AiService(provider, new MemoryCache(), logger, db).run(prompts.scout_report(players[0], null));

    expect(second.cached).toBe(true);
    expect(provider.calls.length).toBe(1);
  });

  it("reports a provider daily cap as rate_limited, not a transient outage", async () => {
    // Gemini's free tier is 20 requests/day per model. "Try again shortly" is false.
    const capped: AiProvider = {
      name: "gemini",
      complete: async () => {
        throw new AiProviderError("gemini", "API error 429: Quota exceeded for metric …limit: 20", true);
      },
    };
    const service = new AiService(capped, new MemoryCache(), logger);
    await expect(service.run(prompts.scout_report(players[0], null))).rejects.toMatchObject({
      code: "rate_limited",
      message: expect.stringContaining("daily AI allowance"),
    });
  });

  it("bypassCache forces regeneration", async () => {
    const provider = new MockAiProvider();
    const service = new AiService(provider, new MemoryCache(), logger);
    await service.run(prompts.scout_report(players[0], null));
    const fresh = await service.run(prompts.scout_report(players[0], null), { bypassCache: true });
    expect(fresh.cached).toBe(false);
    expect(provider.calls.length).toBe(2);
  });
});
