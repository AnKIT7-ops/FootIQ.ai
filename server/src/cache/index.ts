import type { Env } from "../config/env";
import { MemoryCache } from "./memory";
import { UpstashCache } from "./upstash";
import { KvCache, type KVNamespaceLike } from "./kv";
import type { CacheStore } from "./types";

export * from "./types";
export { MemoryCache } from "./memory";
export { UpstashCache } from "./upstash";
export { KvCache } from "./kv";

/**
 * Backend selection: Upstash (if configured) > Cloudflare KV binding (if
 * running on Workers with a CACHE namespace) > in-memory.
 */
export function createCache(env: Env, kvBinding?: KVNamespaceLike): CacheStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashCache(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  }
  if (kvBinding) return new KvCache(kvBinding);
  return new MemoryCache();
}
