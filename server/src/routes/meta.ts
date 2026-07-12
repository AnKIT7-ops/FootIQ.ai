import { Hono } from "hono";
import type { AppEnv } from "../types";
import { ok } from "../lib/respond";
import { hasDatabase } from "../config/env";

/** Health + flags — the two endpoints everything else assumes exist. */
export function metaRoutes(startedAt: number) {
  const r = new Hono<AppEnv>();

  r.get("/health", (c) => {
    const { env, ai } = c.get("services");
    return ok(c, {
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      mode: hasDatabase(env) ? "database" : "demo",
      aiProvider: ai.providerName,
      version: "0.1.0",
    });
  });

  /** Effective flags for the caller (env > db > defaults, rollout applied). */
  r.get("/flags", async (c) => {
    const { flags } = c.get("services");
    return ok(c, await flags.all(c.get("user")?.id));
  });

  return r;
}
