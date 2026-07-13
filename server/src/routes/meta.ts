import { Hono } from "hono";
import type { AppEnv } from "../types";
import type { CommunityService } from "../services/community";
import { ok } from "../lib/respond";
import { hasDatabase } from "../config/env";

/** Health + flags + public stats — the endpoints everything else assumes exist. */
export function metaRoutes(startedAt: number, cacheBackend: string, community: CommunityService) {
  const r = new Hono<AppEnv>();

  r.get("/health", async (c) => {
    const { env, ai, dataProvider, jobs } = c.get("services");
    const lastRuns = await jobs.lastRuns();
    return ok(c, {
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      mode: hasDatabase(env) ? "database" : "demo",
      aiProvider: ai.providerName,
      dataProvider: { name: dataProvider.name, available: dataProvider.available() },
      cache: cacheBackend,
      jobs: lastRuns.map((j) => ({ name: j.name, status: j.status, at: j.at, ms: j.ms })),
      version: "0.2.0",
      apiVersion: "v1",
    });
  });

  /** Public beta aggregates — counts only, no PII. Powers the /insights fleet card. */
  r.get("/stats", async (c) => {
    const { dataProvider, jobs } = c.get("services");
    const [counts, lastRuns] = await Promise.all([community.stats(), jobs.lastRuns()]);
    const lastSync = lastRuns.find((j) => j.name === "sync_standings" && j.status === "ok");
    return ok(c, {
      newsletterSubscribers: counts?.newsletterSubscribers ?? null,
      feedbackEntries: counts?.feedbackEntries ?? null,
      dataProvider: dataProvider.name,
      lastStandingsSyncAt: lastSync?.at ?? null,
    });
  });

  /** Effective flags for the caller (env > db > defaults, rollout applied). */
  r.get("/flags", async (c) => {
    const { flags } = c.get("services");
    return ok(c, await flags.all(c.get("user")?.id));
  });

  return r;
}
