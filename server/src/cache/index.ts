import type { Env } from "../config/env";
import { MemoryCache } from "./memory";
import { UpstashCache } from "./upstash";
import { KvCache, type KVNamespaceLike } from "./kv";
import { TieredCache } from "./tiered";
import type { CacheStore } from "./types";

export * from "./types";
export { MemoryCache } from "./memory";
export { UpstashCache } from "./upstash";
export { KvCache } from "./kv";
export { TieredCache } from "./tiered";

/** Which backend createCache picked — surfaced in /health. */
export function cacheBackendName(env: Env, kvBinding?: KVNamespaceLike): string {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) return "upstash+memory";
  if (kvBinding) return "kv+memory";
  return "memory";
}

/**
 * Backend selection: Upstash (if configured) > Cloudflare KV binding (if
 * running on Workers with a CACHE namespace) > in-memory. Remote backends
 * get an in-memory front (TieredCache) so hot reads skip the network.
 */
export function createCache(env: Env, kvBinding?: KVNamespaceLike): CacheStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new TieredCache(new UpstashCache(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN));
  }
  if (kvBinding) return new TieredCache(new KvCache(kvBinding));
  return new MemoryCache();
}
