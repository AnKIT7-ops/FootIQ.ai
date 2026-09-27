import { describe, expect, it } from "vitest";
import { resolveMatch } from "./slugs";
import { contentLibrary } from "./repositories/content";
import { noteMeta } from "./freshness";

/**
 * Demo fixtures and the generated Intelligence library describe a fictional
 * season. On live data they contradict the real table, so they must stop
 * resolving the moment the backend reports provider data. Demo mode is set
 * explicitly: a local .env.local with VITE_API_URL would otherwise start the
 * run in "unknown" mode.
 */
describe("demo content gating", () => {
  it("serves demo fixtures and reports in demo mode, and neither on live data", () => {
    noteMeta({ source: "demo", syncedAt: new Date().toISOString() }, "/api/matches");
    expect(resolveMatch("manchester-city-vs-chelsea")?.id).toBe("mci-che");
    expect(contentLibrary().length).toBeGreaterThan(0);

    noteMeta({ source: "provider", syncedAt: new Date().toISOString() }, "/api/matches");

    expect(resolveMatch("manchester-city-vs-chelsea")).toBeNull();
    expect(resolveMatch("mci-che")).toBeNull();
    expect(contentLibrary()).toEqual([]);
  });
});
