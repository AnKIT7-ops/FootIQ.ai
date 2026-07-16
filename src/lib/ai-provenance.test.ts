import { describe, expect, it } from "vitest";
import { isDemoEngine } from "./ai-provenance";

describe("isDemoEngine", () => {
  it("flags client-generated prose (no provider ever ran)", () => {
    expect(isDemoEngine(undefined)).toBe(true);
  });

  it("flags the mock provider", () => {
    expect(isDemoEngine("mock")).toBe(true);
  });

  it("clears real providers", () => {
    expect(isDemoEngine("claude")).toBe(false);
    expect(isDemoEngine("openai")).toBe(false);
    expect(isDemoEngine("gemini")).toBe(false);
    expect(isDemoEngine("ollama")).toBe(false);
  });

  it("fails closed on an unrecognized provider", () => {
    // An unknown string is more likely a bug than a real model. Claiming
    // "real AI" wrongly breaks the honesty rule; showing the badge wrongly
    // is merely conservative.
    expect(isDemoEngine("")).toBe(true);
    expect(isDemoEngine("   ")).toBe(true);
  });
});
