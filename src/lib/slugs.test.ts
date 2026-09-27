import { describe, expect, it } from "vitest";
import { resolveMatch } from "./slugs";
import { contentLibrary } from "./repositories/content";
import { noteMeta } from "./freshness";

/**
 * Demo fixtures and the generated Intelligence library describe a fictional
 * season. On live data they contradict the real table, so they must stop
 * resolving the moment the backend reports provider data. (No VITE_API_URL
 * under vitest, so the run starts in pure demo mode.)
 */
describe("demo content gating", () => {
  it("serves demo fixtures and reports in demo mode, and neither on live data", () => {
    expect(resolveMatch("manchester-city-vs-chelsea")?.id).toBe("mci-che");
    expect(contentLibrary().length).toBeGreaterThan(0);

    noteMeta({ source: "provider", syncedAt: new Date().toISOString() }, "/api/matches");

    expect(resolveMatch("manchester-city-vs-chelsea")).toBeNull();
    expect(resolveMatch("mci-che")).toBeNull();
    expect(contentLibrary()).toEqual([]);
  });
});
