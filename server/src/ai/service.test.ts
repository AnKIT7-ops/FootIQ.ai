import { describe, expect, it } from "vitest";
import { AiService } from "./service";
import { MockAiProvider } from "./providers/mock";
import { MemoryCache } from "../cache/memory";
import { createLogger } from "../lib/logger";
import { prompts } from "./prompts";
import { players } from "../data/demo";

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

  it("bypassCache forces regeneration", async () => {
    const provider = new MockAiProvider();
    const service = new AiService(provider, new MemoryCache(), logger);
    await service.run(prompts.scout_report(players[0], null));
    const fresh = await service.run(prompts.scout_report(players[0], null), { bypassCache: true });
    expect(fresh.cached).toBe(false);
    expect(provider.calls.length).toBe(2);
  });
});
