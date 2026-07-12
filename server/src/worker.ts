import { loadEnv, type Env } from "./config/env";
import { createApp } from "./app";
import type { KVNamespaceLike } from "./cache/kv";

/**
 * Cloudflare Workers entrypoint. Env vars arrive per-request via the binding
 * object, so the app is built lazily on first fetch and reused for the
 * isolate's lifetime.
 */

interface WorkerBindings extends Record<string, unknown> {
  CACHE?: KVNamespaceLike;
}

let cached: { app: ReturnType<typeof createApp>; env: Env } | null = null;

export default {
  async fetch(request: Request, bindings: WorkerBindings): Promise<Response> {
    if (!cached) {
      const stringVars: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(bindings)) {
        if (typeof v === "string") stringVars[k] = v;
      }
      const env = loadEnv(stringVars);
      cached = { app: createApp(env, { kv: bindings.CACHE }), env };
    }
    return cached.app.fetch(request);
  },
};
