import { describe, expect, it } from "vitest";
import { teams } from "../data/teams";
import { staticPageMeta, teamPageMeta } from "./page-meta";
import { pageHead, SITE_URL } from "./seo";

describe("page meta → prerendered head", () => {
  it("keys every static entry by its own path (a mismatch would prerender the wrong page's head)", () => {
    for (const [key, meta] of Object.entries(staticPageMeta)) expect(meta.path).toBe(key);
  });

  it("builds one canonical/og:url from the path and carries JSON-LD", () => {
    const head = pageHead(teamPageMeta(teams[0]));
    expect(head.canonical).toBe(`${SITE_URL}/teams/arsenal`);
    expect(head.meta.find((m) => m.key === "og:url")?.content).toBe(head.canonical);
    expect(new Set(head.meta.map((m) => m.key)).size).toBe(head.meta.length);
    expect(JSON.parse(head.jsonLd ?? "null")).toHaveLength(2); // SportsTeam + BreadcrumbList
  });
});
