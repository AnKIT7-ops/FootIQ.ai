import { describe, expect, it } from "vitest";
import { FlagService } from "./flags";
import { MemoryCache } from "../cache/memory";
import { loadEnv } from "../config/env";
import { DEFAULT_FLAGS } from "../../../shared/contracts";

const baseEnv = (extra: Record<string, string> = {}) => loadEnv({ NODE_ENV: "test", ...extra });

describe("FlagService", () => {
  it("returns code defaults when no DB and no env overrides", async () => {
    const flags = new FlagService(baseEnv(), new MemoryCache(), null);
    expect(await flags.all()).toEqual(DEFAULT_FLAGS);
  });

  it("env override beats the default (kill switch works without deploy)", async () => {
    const flags = new FlagService(baseEnv({ FLAG_AI_SCOUT: "false" }), new MemoryCache(), null);
    expect(await flags.isEnabled("ai_scout")).toBe(false);
    const on = new FlagService(baseEnv({ FLAG_PREMIUM: "true" }), new MemoryCache(), null);
    expect(await on.isEnabled("premium")).toBe(true);
  });

  it("rollout bucketing is deterministic per user", async () => {
    // exercise the hash via two services sharing config — same user, same result
    const env = baseEnv();
    const a = new FlagService(env, new MemoryCache(), null);
    const b = new FlagService(env, new MemoryCache(), null);
    expect(await a.all("user-123")).toEqual(await b.all("user-123"));
  });
});
