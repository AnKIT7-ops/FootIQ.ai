import { Hono } from "hono";
import type { AppEnv } from "../types";
import { ok } from "../lib/respond";
import { hasDatabase } from "../config/env";

/** Health + flags — the two endpoints everything else assumes exist. */
export function metaRoutes(startedAt: number, cacheBackend: string) {
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

  /** Effective flags for the caller (env > db > defaults, rollout applied). */
  r.get("/flags", async (c) => {
    const { flags } = c.get("services");
    return ok(c, await flags.all(c.get("user")?.id));
  });

  return r;
}
