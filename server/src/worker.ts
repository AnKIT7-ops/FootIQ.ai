import { loadEnv, type Env } from "./config/env";
import { createServer } from "./app";
import type { KVNamespaceLike } from "./cache/kv";
import type { Services } from "./types";

/**
 * Cloudflare Workers entrypoint. Env vars arrive per-request via the binding
 * object, so the app is built lazily on first use and reused for the
 * isolate's lifetime. `scheduled` runs the sync jobs (cron in wrangler.toml).
 */

interface WorkerBindings extends Record<string, unknown> {
  CACHE?: KVNamespaceLike;
}

let cached: { app: { fetch: (r: Request) => Response | Promise<Response> }; services: Services; env: Env } | null =
  null;

function boot(bindings: WorkerBindings) {
  if (!cached) {
    const stringVars: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(bindings)) {
      if (typeof v === "string") stringVars[k] = v;
    }
    const env = loadEnv(stringVars);
    const { app, services } = createServer(env, { kv: bindings.CACHE });
    cached = { app, services, env };
  }
  return cached;
}

export default {
  async fetch(request: Request, bindings: WorkerBindings): Promise<Response> {
    return boot(bindings).app.fetch(request);
  },

  async scheduled(_event: unknown, bindings: WorkerBindings, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    const { services } = boot(bindings);
    ctx.waitUntil(services.jobs.runAll());
  },
};
